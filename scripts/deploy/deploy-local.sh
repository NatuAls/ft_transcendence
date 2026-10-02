#!/usr/bin/env bash
# =============================================================================
#  Despliegue local — HelpDesk Lite
#
#  Hace EN EL SERVIDOR lo que hace el job `build-and-deploy` de
#  .github/workflows/deploy-staging.yml y deploy-prod.yml, sin gastar minutos
#  de GitHub Actions y sin pasar por GHCR:
#
#      1. comprueba que el checkout está limpio y calcula el SHA a desplegar
#      2. construye las dos imágenes de producción con las MISMAS etiquetas
#         (ghcr.io/<owner>/helpdesk-{api,web}-<entorno>:<sha>) y los mismos
#         build-args (GIT_COMMIT, BUILD_TIME, APP_VERSION)
#      3. ejecuta scripts/deploy/remote-deploy.sh en modo local: copia previa,
#         .env, arranque, healthchecks, smoke test y ROLLBACK automático
#
#      scripts/deploy/deploy-local.sh staging
#      scripts/deploy/deploy-local.sh prod
#      make deploy-staging   /   make deploy-prod
#
#  Opciones:
#      --env-file <ruta>  de dónde salen los secretos del entorno. Por defecto
#                         se reutiliza el .env que ya hay en /opt/helpdesk/
#                         <entorno>/, leído POR EL USUARIO deployer: quien
#                         lanza el script no llega a ver esos valores.
#      --skip-build       no reconstruye: redespliega imágenes ya presentes
#                         (útil para probar un rollback a un SHA anterior).
#      --sha <commit>     SHA a desplegar con --skip-build (por defecto HEAD).
#      --yes              no preguntar (para producción hay que escribirlo).
#
#  LO QUE ESTE CAMINO NO TIENE, y por qué sólo vale para probar:
#      · no ejecuta el CI (lánzalo antes: scripts/ci/run-local.sh)
#      · no pasa por la puerta de producción (scripts/ci/prod-gate.mjs), que
#        exige PR aprobada por otra persona. En local no hay nadie a quien
#        pedírselo: por eso producción pide confirmación escrita.
#      · las imágenes no quedan en GHCR, así que sólo existen en este host.
#  El despliegue "de verdad" sigue siendo el de Actions. Ver la guía DevOps del equipo, apartado «CI y despliegues en local».
# =============================================================================
set -euo pipefail

ENV_NAME="${1:-}"; shift || true
ENV_FILE=""
SKIP_BUILD=0
ASSUME_YES=0
SHA_OVERRIDE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --env-file) ENV_FILE="${2:?--env-file necesita una ruta}"; shift 2 ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    --sha) SHA_OVERRIDE="${2:?--sha necesita un commit}"; shift 2 ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    *) echo "Opción desconocida: $1" >&2; exit 2 ;;
  esac
done

case "$ENV_NAME" in
  staging|prod) ;;
  *) echo "Uso: $0 <staging|prod> [--env-file R] [--skip-build] [--sha C] [--yes]" >&2; exit 2 ;;
esac

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

log()  { printf '\n\033[0;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[0;33m[aviso] %s\033[0m\n' "$*"; }
fail() { printf '\033[0;31m%s\033[0m\n' "$*" >&2; exit 1; }

DEPLOY_DIR="/opt/helpdesk/${ENV_NAME}"
DEPLOY_USER="${DEPLOY_USER:-deployer}"
GHCR_OWNER="${GHCR_OWNER:-$(git config --get remote.origin.url | sed -E 's#.*[:/]([^/]+)/[^/]+(\.git)?$#\1#' | tr '[:upper:]' '[:lower:]')}"
[ -n "$GHCR_OWNER" ] || fail "No he podido deducir GHCR_OWNER; pásalo por entorno."

# -----------------------------------------------------------------------------
# 1. Commit a desplegar. Las imágenes se etiquetan con él, así que un árbol
#    sucio produciría una etiqueta que miente sobre lo que contiene.
# -----------------------------------------------------------------------------
if [ -n "$SHA_OVERRIDE" ]; then
  GIT_SHA="$(git rev-parse "$SHA_OVERRIDE")"
else
  GIT_SHA="$(git rev-parse HEAD)"
  if [ -n "$(git status --porcelain)" ]; then
    if [ "${ALLOW_DIRTY:-0}" = "1" ]; then
      warn "El árbol tiene cambios sin commitear y ALLOW_DIRTY=1: las imágenes NO corresponden a $GIT_SHA."
    else
      fail "El árbol tiene cambios sin commitear. Haz commit (o exporta ALLOW_DIRTY=1 si sabes lo que haces)."
    fi
  fi
fi

APP_VERSION="${APP_VERSION:-$(git rev-parse --abbrev-ref HEAD)-local}"
BUILD_TIME="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
API_IMAGE="ghcr.io/${GHCR_OWNER}/helpdesk-api-${ENV_NAME}:${GIT_SHA}"
WEB_IMAGE="ghcr.io/${GHCR_OWNER}/helpdesk-web-${ENV_NAME}:${GIT_SHA}"

command -v docker > /dev/null || fail "Hace falta Docker."
docker info > /dev/null 2>&1 || fail "El demonio de Docker no responde (¿estás en el grupo docker?)."

cat <<RESUMEN

  Entorno ........ ${ENV_NAME}
  Directorio ..... ${DEPLOY_DIR}  (como ${DEPLOY_USER})
  Commit ......... ${GIT_SHA:0:7}  ($(git log -1 --format='%s' "$GIT_SHA" | cut -c1-60))
  Versión ........ ${APP_VERSION}
  Imágenes ....... helpdesk-{api,web}-${ENV_NAME}:${GIT_SHA:0:7}  (sólo en este host)
  Arquitectura ... $(uname -m)
RESUMEN

if [ "$ENV_NAME" = prod ] && [ "$ASSUME_YES" -ne 1 ]; then
  printf '\n\033[0;31mEsto despliega en PRODUCCIÓN, sin pasar por la puerta de PR aprobada.\033[0m\n'
  printf 'Escribe "desplegar prod" para continuar: '
  read -r answer
  [ "$answer" = "desplegar prod" ] || fail "Cancelado."
elif [ "$ASSUME_YES" -ne 1 ]; then
  printf '\n¿Continuar? [y/N]: '
  read -r answer
  case "$answer" in y|Y|s|S) ;; *) fail "Cancelado." ;; esac
fi

# -----------------------------------------------------------------------------
# 2. Imágenes. Se construyen para la arquitectura de este host; en el servidor
#    de Oracle (Ampere) eso es arm64, exactamente lo que publica el workflow.
# -----------------------------------------------------------------------------
if [ "$SKIP_BUILD" -eq 1 ]; then
  log "Saltando la construcción (--skip-build)"
  for image in "$API_IMAGE" "$WEB_IMAGE"; do
    docker image inspect "$image" > /dev/null 2>&1 || fail "No existe la imagen $image en este host."
  done
else
  log "Construyendo la imagen de la API"
  docker build -f apps/api/Dockerfile.prod \
    --build-arg GIT_COMMIT="$GIT_SHA" \
    --build-arg BUILD_TIME="$BUILD_TIME" \
    --build-arg APP_VERSION="$APP_VERSION" \
    -t "$API_IMAGE" .

  log "Construyendo la imagen de la web"
  docker build -f apps/web/Dockerfile.prod -t "$WEB_IMAGE" .
fi

# -----------------------------------------------------------------------------
# 3. Despliegue. El script de siempre (remote-deploy.sh) en modo local.
#
#    Los secretos NO pasan por la línea de órdenes ni por el entorno de quien
#    lanza esto: el bloque de abajo se ejecuta como `deployer`, que es quien
#    puede leer el .env del entorno, y ahí dentro se exporta lo que hace falta.
#    Con --env-file se puede usar otro fichero (primer despliegue de un entorno
#    nuevo), y entonces sí lo lee el usuario actual.
# -----------------------------------------------------------------------------
SOURCE_ENV="${ENV_FILE:-$DEPLOY_DIR/.env}"

# El .env del entorno trae ENV_NAME, GHCR_OWNER, APP_VERSION y el GITHUB_SHA
# ANTERIOR. Al cargarlo pisaría los valores de este despliegue, así que los de
# ahora viajan con nombres TARGET_* y se colocan DESPUÉS de cargarlo.
INNER_SCRIPT='
set -euo pipefail
if [ ! -r "$SOURCE_ENV" ]; then
  cat >&2 <<MSG
ERROR: $(id -un) no puede leer $SOURCE_ENV.

  Es el .env que dejó el último despliegue de este entorno, y de ahí salen las
  credenciales. Si es el primer despliegue de este entorno, pásalas con
  --env-file <ruta> a un fichero con: DB_USER DB_PASSWORD DB_NAME
  JWT_ACCESS_SECRET JWT_REFRESH_SECRET PASSWORD_PEPPER BACKUP_ENCRYPTION_KEY
  METRICS_TOKEN CORS_ORIGINS (opcionales: SMTP_HOST SMTP_PORT MAIL_FROM
  RCLONE_REMOTE DB_APP_USER DB_APP_PASSWORD BOOTSTRAP_ADMIN_EMAIL
  BOOTSTRAP_ADMIN_USERNAME BOOTSTRAP_ADMIN_PASSWORD BOOTSTRAP_ADMIN_DISPLAY_NAME
  BOOTSTRAP_ADMIN_ROTATE DOCS_HTPASSWD DOCS_GATEWAY_TOKEN DOCS_ACCESS).

  Ese fichero lo genera entero  bash scripts/gen-secrets.sh --env <entorno>
  (escribe un .env en la raíz del repositorio; muévelo o pásalo con
  --env-file). Sin las tres últimas, la documentación de la API queda cerrada;
  sin las de BOOTSTRAP_ADMIN, el entorno arranca sin administrador.
MSG
  exit 1
fi
set -a
. "$SOURCE_ENV"
set +a
unset GITHUB_SHA
export ENV_NAME="$TARGET_ENV_NAME"
export DEPLOY_DIR="$TARGET_DEPLOY_DIR"
export GHCR_OWNER="$TARGET_GHCR_OWNER"
export GIT_SHA="$TARGET_GIT_SHA"
export APP_VERSION="$TARGET_APP_VERSION"
export DEPLOY_SOURCE_DIR="$TARGET_ROOT"
export IMAGES_LOCAL=1
exec bash "$TARGET_ROOT/scripts/deploy/remote-deploy.sh"
'

log "Desplegando ${ENV_NAME} (${GIT_SHA:0:7})"

if [ "$(id -un)" = "$DEPLOY_USER" ]; then
  SOURCE_ENV="$SOURCE_ENV" \
  TARGET_ENV_NAME="$ENV_NAME" TARGET_DEPLOY_DIR="$DEPLOY_DIR" \
  TARGET_GHCR_OWNER="$GHCR_OWNER" TARGET_GIT_SHA="$GIT_SHA" \
  TARGET_APP_VERSION="$APP_VERSION" TARGET_ROOT="$ROOT" \
    bash -c "$INNER_SCRIPT"
else
  command -v sudo > /dev/null || fail "Lánzalo como $DEPLOY_USER (o con sudo disponible)."
  # `deployer` tiene que poder leer el checkout: de ahí copia compose.prod.yml,
  # backup.sh y smoke.mjs.
  sudo -u "$DEPLOY_USER" test -r "$ROOT/compose.prod.yml" || fail \
    "El usuario $DEPLOY_USER no puede leer $ROOT. Deja el checkout en un sitio legible por él (p. ej. /srv/helpdesk-src) y repite."
  # `env` en vez de asignaciones sueltas: sudo no propaga variables nuevas.
  # Los secretos NO viajan aquí; los lee deployer del .env del entorno.
  sudo -u "$DEPLOY_USER" env \
    SOURCE_ENV="$SOURCE_ENV" \
    TARGET_ENV_NAME="$ENV_NAME" TARGET_DEPLOY_DIR="$DEPLOY_DIR" \
    TARGET_GHCR_OWNER="$GHCR_OWNER" TARGET_GIT_SHA="$GIT_SHA" \
    TARGET_APP_VERSION="$APP_VERSION" TARGET_ROOT="$ROOT" \
    bash -c "$INNER_SCRIPT"
fi
