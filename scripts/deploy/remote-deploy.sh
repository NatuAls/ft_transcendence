#!/usr/bin/env bash
# =============================================================================
#  Despliegue en el servidor — HelpDesk Lite
#
#  Se ejecuta EN la instancia de Oracle Cloud, invocado por SSH desde
#  .github/workflows/deploy-staging.yml y deploy-prod.yml. Los dos entornos
#  comparten este mismo script; lo único que cambia son las variables.
#
#  Secuencia (tarea DevOps 7):
#      1. descargar los ficheros de despliegue del commit exacto
#      2. copia de seguridad previa (si ya hay algo desplegado)
#      3. escribir el .env del entorno con permisos 600
#      4. traer las imágenes inmutables etiquetadas con el SHA
#      5. levantar la pila (las migraciones las aplica el CMD de la API)
#      6. esperar a que el contenedor esté sano
#      7. smoke test contra el entorno recién levantado
#      8. si algo falla -> ROLLBACK al SHA anterior y salir con error
#
#  Variables obligatorias (las pasa la acción de SSH con `envs:`):
#      ENV_NAME DEPLOY_DIR GH_REPO GH_TOKEN GH_ACTOR GHCR_OWNER GIT_SHA
#      DB_USER DB_PASSWORD DB_NAME
#      JWT_ACCESS_SECRET JWT_REFRESH_SECRET PASSWORD_PEPPER
#  Opcionales:
#      CORS_ORIGINS SMTP_HOST SMTP_PORT MAIL_FROM APP_VERSION LOG_LEVEL
#      BACKUP_RETENTION_DAYS HEALTH_TIMEOUT BACKUP_ENCRYPTION_KEY RCLONE_REMOTE METRICS_TOKEN
#      BOOTSTRAP_ADMIN_EMAIL DB_APP_USER DB_APP_PASSWORD (rol sin privilegios; ver B4)
#      BOOTSTRAP_ADMIN_USERNAME BOOTSTRAP_ADMIN_PASSWORD BOOTSTRAP_ADMIN_DISPLAY_NAME
#      BOOTSTRAP_ADMIN_ROTATE (primer administrador: ver modules/admin/bootstrap-admin.ts)
#      DOCS_ACCESS DOCS_GATEWAY_TOKEN DOCS_HTPASSWD (documentación de la API)
#
#  MODO LOCAL (sin GitHub Actions; ver scripts/deploy/deploy-local.sh y la guía
#  DevOps del equipo, apartado «CI y despliegues en local»). Dos variables
#  opcionales cambian de dónde salen los ficheros y las imágenes; todo lo demás
#  —copia previa, .env, healthchecks, smoke test y rollback— recorre
#  exactamente el mismo camino:
#      DEPLOY_SOURCE_DIR   copia compose.prod.yml, scripts/backup.sh y
#                          smoke.mjs de ese checkout en lugar de descargarlos
#                          de la API de GitHub (GH_REPO/GH_TOKEN dejan de ser
#                          obligatorias).
#      IMAGES_LOCAL=1      las imágenes ya están construidas en ESTE host: no
#                          hay `docker login` ni `docker compose pull`.
# =============================================================================
set -euo pipefail

require() {
  for name in "$@"; do
    if [ -z "${!name:-}" ]; then
      echo "ERROR: falta la variable obligatoria $name" >&2
      exit 1
    fi
  done
}

DEPLOY_SOURCE_DIR="${DEPLOY_SOURCE_DIR:-}"
IMAGES_LOCAL="${IMAGES_LOCAL:-0}"

require ENV_NAME DEPLOY_DIR GHCR_OWNER GIT_SHA \
        DB_USER DB_PASSWORD DB_NAME \
        BACKUP_ENCRYPTION_KEY METRICS_TOKEN \
        JWT_ACCESS_SECRET JWT_REFRESH_SECRET PASSWORD_PEPPER

# Los ficheros se descargan de GitHub salvo que venga un checkout local.
[ -n "$DEPLOY_SOURCE_DIR" ] || require GH_REPO GH_TOKEN
# El registro sólo hace falta si hay que traer las imágenes de GHCR.
[ "$IMAGES_LOCAL" = "1" ] || require GH_TOKEN GH_ACTOR

# CORS_ORIGINS se exige aparte y con mensaje propio. Si llega vacía, la lista
# de orígenes permitidos queda vacía y la API rechaza cualquier petición con
# credenciales que no sea del mismo origen: hoy funciona de rebote porque el
# Nginx de la web hace de proxy, pero es una bomba de relojería. Vale más
# romper el despliegue con una instrucción clara que desplegar mal en silencio.
if [ -z "${CORS_ORIGINS:-}" ]; then
  cat >&2 <<'MSG'
ERROR: CORS_ORIGINS está vacía.

  Defínela en GitHub -> Settings -> Secrets and variables -> Actions
  -> pestaña "Variables" -> New repository variable:

      STAGING_CORS_ORIGINS = https://staging.tudominio.com
      PROD_CORS_ORIGINS    = https://tudominio.com

  Es el dominio EXACTO por el que el navegador abre la aplicación (con
  https://, sin barra final). Varios orígenes se separan por comas.
MSG
  exit 1
fi

HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-240}"
COMPOSE="docker compose -f compose.prod.yml"

# Cerrojo compartido con el temporizador de auto-recuperación
# (scripts/ops/ensure-stack.sh): mientras dure el despliegue, el temporizador
# no toca la pila. /run/lock es escribible por todos; el fichero lo crea el
# primero que llega (0666) y los demás sólo lo abren para bloquearlo.
DEPLOY_LOCK="/run/lock/helpdesk-deploy-${ENV_NAME}.lock"
[ -e "$DEPLOY_LOCK" ] || ( umask 000 && : > "$DEPLOY_LOCK" ) 2>/dev/null || true
exec 9<"$DEPLOY_LOCK"
flock -w 900 9 || { echo "ERROR: otro despliegue o el temporizador tienen la pila bloqueada desde hace 15 min." >&2; exit 1; }

log()  { printf '\n\033[0;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[0;33m[aviso] %s\033[0m\n' "$*"; }

# -----------------------------------------------------------------------------
# 0. Comprobaciones previas del entorno.
#
#    Este script se ejecuta como un usuario SIN sudo (`deployer`), cuyo único
#    privilegio es pertenecer al grupo `docker`. Las tres cosas que necesita
#    —el demonio de Docker, el plugin Compose V2 y un directorio de despliegue
#    donde pueda escribir— se comprueban aquí y no a mitad del despliegue, con
#    mensajes que dicen exactamente qué comando ejecutar en el servidor.
# -----------------------------------------------------------------------------
log "Comprobaciones previas del servidor"
echo "Usuario: $(id -un)  ·  grupos: $(id -Gn)"

if ! docker info > /dev/null 2>&1; then
  cat >&2 <<MSG
ERROR: este usuario no puede hablar con el demonio de Docker.

  En el servidor, como administrador:
      sudo usermod -aG docker $(id -un)
  y después cierra y reabre la sesión SSH (el grupo se aplica al iniciar sesión).
MSG
  exit 1
fi

if ! docker compose version > /dev/null 2>&1; then
  echo "ERROR: falta el plugin Docker Compose V2 (docker compose). Instálalo con el paquete docker-compose-plugin." >&2
  exit 1
fi

# /opt pertenece a root: `mkdir -p /opt/helpdesk/...` falla para un usuario sin
# sudo si el administrador no ha creado y cedido el directorio antes.
if ! mkdir -p "$DEPLOY_DIR" 2>/dev/null || [ ! -w "$DEPLOY_DIR" ]; then
  cat >&2 <<MSG
ERROR: no puedo escribir en $DEPLOY_DIR como $(id -un).

  Preparación de una sola vez en el servidor, como administrador:
      sudo mkdir -p /opt/helpdesk/staging /opt/helpdesk/prod
      sudo chown -R $(id -un):$(id -gn) /opt/helpdesk
      sudo chmod 750 /opt/helpdesk
MSG
  exit 1
fi

# -----------------------------------------------------------------------------
# 1. Ficheros de despliegue, descargados del commit EXACTO que se despliega.
#    Se usa la API de GitHub con Bearer token: funciona igual con el repositorio
#    público o privado, y garantiza que compose y scripts corresponden al mismo
#    commit que las imágenes.
# -----------------------------------------------------------------------------
mkdir -p "$DEPLOY_DIR/scripts/deploy" "$DEPLOY_DIR/backups"
cd "$DEPLOY_DIR"

fetch() { # fetch <ruta-en-el-repo> <destino-local>
  if [ -n "$DEPLOY_SOURCE_DIR" ]; then
    # Modo local: el checkout ya está en este host y es el que se ha
    # construido. Se copia en vez de descargar, comprobando que el fichero
    # existe para no dejar un compose a medias.
    [ -f "$DEPLOY_SOURCE_DIR/$1" ] || {
      echo "ERROR: $DEPLOY_SOURCE_DIR/$1 no existe (¿checkout incompleto?)" >&2
      exit 1
    }
    cp "$DEPLOY_SOURCE_DIR/$1" "$2"
    return
  fi
  curl -sS -f -L \
    -H "Authorization: Bearer ${GH_TOKEN}" \
    -H "Accept: application/vnd.github.v3.raw" \
    -o "$2" \
    "https://api.github.com/repos/${GH_REPO}/contents/$1?ref=${GIT_SHA}"
}

if [ -n "$DEPLOY_SOURCE_DIR" ]; then
  log "Copiando ficheros de despliegue de $DEPLOY_SOURCE_DIR (${GIT_SHA:0:7})"
else
  log "Descargando ficheros de despliegue (${GIT_SHA:0:7})"
fi
fetch compose.prod.yml            compose.prod.yml
# backup.sh se monta como FICHERO en el servicio `backup`. Si no existiera,
# Docker crearía un directorio con ese nombre y el cron de copias moriría en
# cada arranque sin que nadie se enterase.
fetch scripts/backup.sh           scripts/backup.sh
fetch scripts/deploy/smoke.mjs    scripts/deploy/smoke.mjs
chmod 0755 scripts/backup.sh

# -----------------------------------------------------------------------------
# 2. SHA actualmente desplegado: es el destino del rollback si algo va mal.
# -----------------------------------------------------------------------------
PREVIOUS_SHA=""
if [ -f .env ]; then
  PREVIOUS_SHA="$(grep -m1 '^GITHUB_SHA=' .env | cut -d= -f2- || true)"
fi
if [ -n "$PREVIOUS_SHA" ]; then
  log "Versión actualmente desplegada: ${PREVIOUS_SHA:0:7}"
else
  warn "No hay despliegue previo en $DEPLOY_DIR (primer despliegue: no habrá rollback disponible)"
fi

# -----------------------------------------------------------------------------
# 3. Copia de seguridad ANTES de tocar nada. Las migraciones de Prisma se
#    aplican en el arranque de la API, así que ésta es la última foto del
#    esquema anterior.
# -----------------------------------------------------------------------------
if [ -n "$PREVIOUS_SHA" ] && docker ps -a --format '{{.Names}}' | grep -qx "helpdesk-db-${ENV_NAME}"; then
  log "Copia de seguridad previa al despliegue"
  if $COMPOSE run --rm --no-deps \
      -e POSTGRES_USER="$DB_USER" \
      -e POSTGRES_PASSWORD="$DB_PASSWORD" \
      -e POSTGRES_DB="$DB_NAME" \
      -e BACKUP_LABEL="predeploy-${GIT_SHA:0:7}" \
      -e BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}" \
      --entrypoint "sh /backup.sh" backup; then
    echo "Copia previa completada."
  else
    echo "ERROR: la copia de seguridad previa ha fallado; se aborta el despliegue." >&2
    exit 1
  fi
else
  warn "Sin base de datos previa: se omite la copia de seguridad"
fi

# -----------------------------------------------------------------------------
# 4. Fichero de entorno. Se escribe entero en cada despliegue para que el
#    servidor no acumule variables de versiones anteriores.
# -----------------------------------------------------------------------------
# -----------------------------------------------------------------------------
# 3 bis. Puertas de la documentación de la API.
#
#     El fichero de contraseñas y el token del proxy sólo existen en el disco
#     de este servidor: llegan como secretos del despliegue, se escriben con
#     permisos 600 y se montan de sólo lectura en el contenedor `web` (ver
#     compose.prod.yml). Nunca están en el repositorio ni dentro de la imagen.
#
#     Y por defecto se cierra: sin DOCS_HTPASSWD no hay documentación servida,
#     en vez de quedar abierta por descuido.
# -----------------------------------------------------------------------------
log "Puertas de la documentación"
mkdir -p nginx
umask 077
if [ -n "${DOCS_HTPASSWD:-}" ]; then
  printf '%s\n' "$DOCS_HTPASSWD" > nginx/.htpasswd
  chmod 600 nginx/.htpasswd
  cat > nginx/docs-auth.inc <<'AUTH'
auth_basic            "HelpDesk Lite - internal documentation";
auth_basic_user_file  /etc/nginx/.htpasswd;
AUTH
  echo "Autenticación del proxy activada para /api/v1/docs."
else
  : > nginx/.htpasswd
  chmod 600 nginx/.htpasswd
  # 404 y no `deny all` (403): la misma respuesta que da la API cuando niega la
  # documentación. Un 403 confirmaría que ahí hay algo cerrado con llave.
  printf 'return 404;\n' > nginx/docs-auth.inc
  warn "DOCS_HTPASSWD no definido: la documentación queda CERRADA (404)."
  DOCS_ACCESS="${DOCS_ACCESS:-disabled}"
fi
printf 'proxy_set_header X-Docs-Gateway "%s";\n' "${DOCS_GATEWAY_TOKEN:-}" > nginx/docs-gateway.inc
# docs-gateway.inc lleva el token dentro, así que se queda en 600: los ficheros
# de configuración los lee el proceso MAESTRO de Nginx, que es root. El
# .htpasswd, en cambio, lo leen los procesos de trabajo (uid 101): sigue en 600
# y es el entrypoint de la imagen quien lo coloca donde ellos puedan leerlo.
chmod 600 nginx/docs-gateway.inc
chmod 644 nginx/docs-auth.inc
umask 022

log "Escribiendo .env del entorno ${ENV_NAME}"
umask 077
cat > .env <<EOF
ENV_NAME=${ENV_NAME}
GHCR_OWNER=${GHCR_OWNER}
GITHUB_SHA=${GIT_SHA}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
# Rol sin privilegios para la aplicación. Sólo se activa si llega su
# contraseña (secreto *_DB_APP_PASSWORD); si no, las dos quedan vacías y
# compose.prod.yml cae a DB_USER/DB_PASSWORD, como antes.
DB_APP_USER=${DB_APP_PASSWORD:+${DB_APP_USER:-helpdesk_app}}
DB_APP_PASSWORD=${DB_APP_PASSWORD:-}
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
PASSWORD_PEPPER=${PASSWORD_PEPPER}
CORS_ORIGINS=${CORS_ORIGINS}
# Si no se define un servidor de correo, se dejan los mismos valores por
# defecto que usa env.ts. El host "mailpit" no existe en este entorno, así que
# verifyMail() falla, /api/health/ready marca el correo como "degraded" (es
# opcional, no bloquea) y mail.service.ts se traga el error sin romper ninguna
# petición. Resultado: la aplicación funciona, sólo que los correos de
# verificación y de recuperación no salen a ninguna parte.
SMTP_HOST=${SMTP_HOST:-mailpit}
SMTP_PORT=${SMTP_PORT:-1025}
MAIL_FROM=${MAIL_FROM:-HelpDesk Lite <no-reply@helpdesk.local>}
APP_VERSION=${APP_VERSION:-1.0.0}
BACKUP_ENCRYPTION_KEY=${BACKUP_ENCRYPTION_KEY}
RCLONE_REMOTE=${RCLONE_REMOTE:-}
METRICS_TOKEN=${METRICS_TOKEN}
BOOTSTRAP_ADMIN_EMAIL=${BOOTSTRAP_ADMIN_EMAIL:-}
BOOTSTRAP_ADMIN_USERNAME=${BOOTSTRAP_ADMIN_USERNAME:-}
BOOTSTRAP_ADMIN_PASSWORD=${BOOTSTRAP_ADMIN_PASSWORD:-}
BOOTSTRAP_ADMIN_DISPLAY_NAME=${BOOTSTRAP_ADMIN_DISPLAY_NAME:-}
BOOTSTRAP_ADMIN_ROTATE=${BOOTSTRAP_ADMIN_ROTATE:-0}
DOCS_ACCESS=${DOCS_ACCESS:-gateway}
DOCS_GATEWAY_TOKEN=${DOCS_GATEWAY_TOKEN:-}
# Interfaz de Mailpit: 8025 en prod, 8026 en staging (mismo host).
MAILPIT_UI_PORT=$([ "$ENV_NAME" = "prod" ] && echo 8025 || echo 8026)
LOG_LEVEL=${LOG_LEVEL:-info}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-14}
EOF
chmod 600 .env

# -----------------------------------------------------------------------------
# 5. Imágenes inmutables + arranque.
# -----------------------------------------------------------------------------
# `pull_images` es lo único que distingue el despliegue desde Actions del
# despliegue local: en local las imágenes se acaban de construir en este mismo
# host (scripts/deploy/deploy-local.sh) y no hay registro de por medio.
pull_images() { # pull_images <sha>
  local sha="${1:-$GIT_SHA}"
  if [ "$IMAGES_LOCAL" = "1" ]; then
    local missing=0 image
    for image in "ghcr.io/${GHCR_OWNER}/helpdesk-api-${ENV_NAME}:${sha}" \
                 "ghcr.io/${GHCR_OWNER}/helpdesk-web-${ENV_NAME}:${sha}"; do
      if ! docker image inspect "$image" > /dev/null 2>&1; then
        echo "ERROR: la imagen $image no está en este host." >&2
        missing=1
      fi
    done
    if [ "$missing" -ne 0 ]; then
      echo "  Constrúyelas con scripts/deploy/deploy-local.sh, o quita IMAGES_LOCAL=1 para traerlas de GHCR." >&2
      return 1
    fi
    echo "Imágenes locales ${sha:0:7} verificadas (sin descarga)."
    return 0
  fi
  log "Autenticando contra GHCR"
  echo "$GH_TOKEN" | docker login ghcr.io -u "$GH_ACTOR" --password-stdin
  log "Descargando imágenes ${sha:0:7}"
  $COMPOSE pull
}

log "Preparando imágenes ${GIT_SHA:0:7}"
pull_images "$GIT_SHA"

# -----------------------------------------------------------------------------
# 6. Esperar a que la API esté sana (el healthcheck de Compose manda).
# -----------------------------------------------------------------------------
wait_healthy() { # wait_healthy <contenedor> <segundos>
  local container="$1" timeout="$2" elapsed=0 state
  while [ "$elapsed" -lt "$timeout" ]; do
    state="$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo missing)"
    case "$state" in
      healthy) echo "$container: healthy (${elapsed}s)"; return 0 ;;
      missing) echo "$container: aún no existe…" ;;
      *)       echo "$container: $state (${elapsed}s)" ;;
    esac
    sleep 5
    elapsed=$((elapsed + 5))
  done
  echo "ERROR: $container no llegó a healthy en ${timeout}s" >&2
  return 1
}

# -----------------------------------------------------------------------------
# 7. Verificación + rollback.
# -----------------------------------------------------------------------------
rollback() {
  if [ -z "$PREVIOUS_SHA" ] || [ "$PREVIOUS_SHA" = "$GIT_SHA" ]; then
    echo "No hay una versión anterior a la que volver. La pila queda como está." >&2
    return 1
  fi
  log "ROLLBACK a ${PREVIOUS_SHA:0:7}"
  sed -i "s/^GITHUB_SHA=.*/GITHUB_SHA=${PREVIOUS_SHA}/" .env
  if ! pull_images "$PREVIOUS_SHA"; then
    echo "ERROR: no hay imágenes de ${PREVIOUS_SHA:0:7} a las que volver. Intervención manual necesaria." >&2
    return 1
  fi
  $COMPOSE up -d --remove-orphans
  if wait_healthy "helpdesk-api-${ENV_NAME}" "$HEALTH_TIMEOUT"; then
    echo "Rollback completado: sirviendo de nuevo ${PREVIOUS_SHA:0:7}." >&2
  else
    echo "ERROR: el rollback tampoco levanta. Intervención manual necesaria." >&2
  fi
  # Aviso importante: esto revierte la APLICACIÓN, no el ESQUEMA. Si el
  # despliegue fallido aplicó una migración destructiva, hay que restaurar el
  # dump de /opt/helpdesk/<entorno>/backups (ver la guía DevOps del equipo, apartado «Rollback»).
  echo "AVISO: el rollback revierte la imagen, no las migraciones ya aplicadas." >&2
  return 1
}

deploy_failed() {
  echo "::error::Despliegue fallido en ${ENV_NAME}: $1"
  echo "----- últimas líneas del log de la API -----"
  $COMPOSE logs --tail 120 api || true
  rollback || true
  exit 1
}

# `up -d` sale con error si un servicio con `depends_on: service_healthy`
# (la web) no llega a arrancar porque su dependencia (la API) está unhealthy.
# Con `set -e` eso abortaba el script AQUÍ, antes del rollback y sin volcar
# el log de la API: en el despliegue #30 de staging (17/09) la API murió al
# arrancar por una variable de entorno y staging se quedó caído sin volver a
# la versión anterior. Ahora un `up` fallido pasa por deploy_failed.
log "Levantando la pila"
$COMPOSE up -d --remove-orphans || deploy_failed "docker compose up ha fallado (¿la API no arranca?)"

log "Esperando a que los contenedores estén sanos"
wait_healthy "helpdesk-api-${ENV_NAME}" "$HEALTH_TIMEOUT" || deploy_failed "la API no llegó a estar sana"
wait_healthy "helpdesk-web-${ENV_NAME}" 120 || deploy_failed "la web no llegó a estar sana"

log "Smoke test"
$COMPOSE cp scripts/deploy/smoke.mjs api:/tmp/smoke.mjs \
  || deploy_failed "no se pudo copiar el smoke test al contenedor"
$COMPOSE exec -T -e EXPECTED_SHA="$GIT_SHA" api node /tmp/smoke.mjs \
  || deploy_failed "el smoke test no ha pasado"

# -----------------------------------------------------------------------------
# 8. Limpieza: sólo imágenes colgadas de este host, nunca `system prune -a`.
# -----------------------------------------------------------------------------
log "Limpiando imágenes huérfanas"
docker image prune -f > /dev/null || true

log "Despliegue de ${ENV_NAME} completado en ${GIT_SHA:0:7}"
$COMPOSE ps
