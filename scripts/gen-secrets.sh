#!/usr/bin/env bash
# =============================================================================
#  Generador de .env — HelpDesk Lite   (v2)
#
#  Owner original: Israel Torrico (WS8). Nunca escribe un secreto en un fichero
#  versionado.
#
#  QUÉ CAMBIA RESPECTO A LA v1
#
#  La v1 rellenaba cinco variables (usuario, base, contraseña de Postgres y los
#  dos secretos JWT) y dejaba el resto de la plantilla tal cual. Con el
#  .env.example ampliado eso ya no basta: faltaban METRICS_TOKEN,
#  BACKUP_ENCRYPTION_KEY y todo el bloque de servidor (ENV_NAME, GHCR_OWNER,
#  GITHUB_SHA, APP_VERSION, DB_*, CORS_ORIGINS, RCLONE_REMOTE). Esta versión:
#
#    1. Genera TODOS los secretos aleatorios, incluidos los nuevos.
#    2. DEDUCE del repositorio lo que se puede deducir —propietario en GHCR,
#       SHA del commit, versión— en vez de pedirlo a mano.
#    3. Deriva CORS_ORIGINS del dominio del entorno.
#    4. Deja RCLONE_REMOTE vacío y explica de dónde sale (es el único valor que
#       hay que ir a buscar fuera; ver `--rclone-help`).
#    5. Imprime, al terminar, el bloque EXACTO de secretos y variables que hay
#       que pegar en GitHub Actions, con los mismos valores que acaba de
#       escribir en el .env. Así el fichero local y el pipeline no se
#       desincronizan, que es como se llega a «en staging funciona y en
#       producción no».
#
#  USO
#      bash scripts/gen-secrets.sh                    # entorno dev (por defecto)
#      bash scripts/gen-secrets.sh --env staging
#      bash scripts/gen-secrets.sh --env prod --force # sobrescribe (hace copia)
#      bash scripts/gen-secrets.sh --env prod --github-only   # sólo imprimir
#      bash scripts/gen-secrets.sh --rclone-help
#
#  OPCIONES
#      --env <dev|staging|prod>   qué entorno se genera. Por defecto: dev
#      --domain <dominio>         base para CORS_ORIGINS y MAIL_FROM.
#                                 Por defecto: helpdesklite.me
#      --force                    sobrescribe un .env existente (guarda copia
#                                 con marca de tiempo antes)
#      --github-only              no toca el .env; sólo imprime el bloque de
#                                 GitHub a partir del .env que ya existe
#      --rclone-help              explica de dónde sacar RCLONE_REMOTE y las
#                                 credenciales de rclone.conf
#      --write-rclone             intenta construir rclone.conf usando la CLI
#                                 de OCI si está instalada y configurada
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"
TEMPLATE="$ROOT/.env.example"

ENV_NAME="dev"
DOMAIN="helpdesklite.me"
FORCE=0
GITHUB_ONLY=0
WRITE_RCLONE=0

c_ok()   { printf '\033[0;32m%s\033[0m\n' "$*"; }
c_warn() { printf '\033[0;33m%s\033[0m\n' "$*"; }
c_head() { printf '\n\033[0;36m%s\033[0m\n' "$*"; }
die()    { printf '\033[0;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

# -----------------------------------------------------------------------------
#  Ayuda de rclone. Está arriba y sale antes de tocar nada porque es la única
#  parte del proceso que NO se puede automatizar del todo: hay que crear un
#  bucket y unas credenciales en la consola de Oracle.
# -----------------------------------------------------------------------------
rclone_help() {
  cat <<'MSG'

===============================================================================
 RCLONE_REMOTE — el único valor que hay que ir a buscar fuera
===============================================================================

Todo lo demás lo genera o lo deduce este script. RCLONE_REMOTE no, porque
depende de un bucket que todavía no existe y de unas credenciales que sólo
emite la consola de Oracle Cloud.

El formato del valor es:

    RCLONE_REMOTE=<nombre-del-remoto>:<nombre-del-bucket>/<ruta>

donde <nombre-del-remoto> es el nombre que TÚ le pongas a la sección de
rclone.conf. Recomendado:

    RCLONE_REMOTE=objectstorage:helpdesk-backups/prod
    RCLONE_REMOTE=objectstorage:helpdesk-backups/staging

-------------------------------------------------------------------------------
 PASO 1 · Crear el bucket   (consola de Oracle Cloud, 2 minutos)
-------------------------------------------------------------------------------
  Menú ☰ → Storage → Object Storage & Archive Storage → Buckets
  → Create Bucket
      Name:            helpdesk-backups
      Default Storage: Standard
      Visibility:      Private        ← IMPORTANTE
      Encryption:      Oracle-managed keys
  El bucket entra en la capa Always Free (20 GB).

-------------------------------------------------------------------------------
 PASO 2 · Credenciales S3-compatibles   (Customer Secret Key)
-------------------------------------------------------------------------------
  Esquina superior derecha → tu perfil → My profile
  → Customer secret keys (menú lateral, «Resources»)
  → Generate secret key
      Name: rclone-helpdesk-backups

  Te da DOS datos:
    · Access Key   — visible siempre en la lista
    · Secret Key   — SE MUESTRA UNA SOLA VEZ. Cópiala ya.

-------------------------------------------------------------------------------
 PASO 3 · Namespace y región
-------------------------------------------------------------------------------
  El "namespace" es un identificador de tu tenancy, tipo "axhkjs4hs2ab".

  Con la CLI de OCI instalada, sale con un comando:

      oci os ns get --query 'data' --raw-output

  Sin CLI, en la consola:
      Perfil (arriba a la derecha) → Tenancy: <nombre>
      → campo «Object Storage Namespace»

  La región es la de tu instancia; se lee en la esquina superior de la consola
  (p. ej. eu-madrid-1, eu-frankfurt-1). Desde el propio servidor:

      curl -s http://169.254.169.254/opc/v2/instance/ -H 'Authorization: Bearer Oracle' \
        | grep -o '"canonicalRegionName"[^,]*'

-------------------------------------------------------------------------------
 PASO 4 · Escribir rclone.conf EN EL SERVIDOR
-------------------------------------------------------------------------------
  Va en /opt/helpdesk/<entorno>/rclone/rclone.conf, que compose.prod.yml monta
  en sólo lectura dentro del contenedor `backup`:

      mkdir -p /opt/helpdesk/prod/rclone
      cat > /opt/helpdesk/prod/rclone/rclone.conf <<'EOF'
      [objectstorage]
      type = s3
      provider = Other
      env_auth = false
      access_key_id = <ACCESS KEY del paso 2>
      secret_access_key = <SECRET KEY del paso 2>
      region = <región del paso 3>
      endpoint = https://<NAMESPACE del paso 3>.compat.objectstorage.<región>.oraclecloud.com
      acl = private
      no_check_bucket = true
      EOF
      chmod 600 /opt/helpdesk/prod/rclone/rclone.conf

  Ejemplo de endpoint ya montado:
      https://axhkjs4hs2ab.compat.objectstorage.eu-madrid-1.oraclecloud.com

-------------------------------------------------------------------------------
 PASO 5 · Comprobar
-------------------------------------------------------------------------------
      rclone --config /opt/helpdesk/prod/rclone/rclone.conf \
             lsd objectstorage:helpdesk-backups

  Si lista el bucket sin error, ya puedes poner el valor en el .env y en la
  variable de repositorio PROD_RCLONE_REMOTE / STAGING_RCLONE_REMOTE.

-------------------------------------------------------------------------------
 ALTERNATIVA sin Oracle: Backblaze B2 (10 GB gratis)
-------------------------------------------------------------------------------
      [b2]
      type = b2
      account = <keyID>
      key = <applicationKey>
  → RCLONE_REMOTE=b2:helpdesk-backups/prod

  Las claves salen de: backblaze.com → App Keys → Add a New Application Key,
  restringida al bucket helpdesk-backups.

===============================================================================
 Mientras RCLONE_REMOTE esté vacío, backup.sh SIGUE FUNCIONANDO: hace la copia
 cifrada local y avisa por pantalla de que no hay copia externa. No rompe el
 despliegue. Lo que no cumple es el subpunto «almacenamiento fuera del host»
 de la tarea 8.
===============================================================================

MSG
}

# -----------------------------------------------------------------------------
#  Argumentos
# -----------------------------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --env)         ENV_NAME="${2:-}"; shift 2 ;;
    --domain)      DOMAIN="${2:-}"; shift 2 ;;
    --force)       FORCE=1; shift ;;
    --github-only) GITHUB_ONLY=1; shift ;;
    --write-rclone) WRITE_RCLONE=1; shift ;;
    --rclone-help) rclone_help; exit 0 ;;
    -h|--help)     sed -n '2,50p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) die "opción desconocida: $1  (usa --help)" ;;
  esac
done

case "$ENV_NAME" in
  dev|staging|prod) ;;
  *) die "--env debe ser dev, staging o prod (recibido: '$ENV_NAME')" ;;
esac

command -v openssl > /dev/null || die "hace falta openssl."
command -v python3 > /dev/null || die "hace falta python3."

# -----------------------------------------------------------------------------
#  Utilidades
# -----------------------------------------------------------------------------
# hex, no base64: el hexadecimal es alfanumérico puro. Un valor en base64 puede
# contener '+', '/' y '=', y aunque docker compose los lee bien, cualquier
# copia-pega a un `docker run -e` o a un YAML sin comillas acaba en un fallo
# incomprensible. Con 48 bytes (96 caracteres hex) la entropía sobra.
rand() { openssl rand -hex "${1:-32}"; }

replace() { # replace <clave> <valor>  — sobre $ENV_FILE
  local key="$1" value="$2"
  python3 - "$ENV_FILE" "$key" "$value" <<'PY'
import sys, re
path, key, value = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path, encoding='utf-8') as fh:
    text = fh.read()
# La sustitución va por lambda y NO por f-string: en el reemplazo de re.sub,
# una barra invertida o una secuencia \g<...> dentro del valor se interpretaría
# como referencia a un grupo. Con lambda, el valor se inserta literal. Es un
# fallo latente de la v1 que no se manifestaba sólo porque los valores eran
# hexadecimales.
pattern = re.compile(rf'(?m)^{re.escape(key)}=.*$')
if not pattern.search(text):
    sys.stderr.write(f"AVISO: la clave {key} no está en la plantilla; se añade al final.\n")
    text = text.rstrip('\n') + f'\n{key}={value}\n'
else:
    text = pattern.sub(lambda _m: f'{key}={value}', text, count=0)
with open(path, 'w', encoding='utf-8') as fh:
    fh.write(text)
PY
}

read_env() { # read_env <clave>  — lee un valor del .env ya escrito
  sed -n "s/^$1=//p" "$ENV_FILE" | head -1
}

# -----------------------------------------------------------------------------
#  Valores DEDUCIDOS del repositorio.
#
#  Estas tres no son secretos ni hay que inventarlas: están en el propio git.
#  En el servidor las reescribe remote-deploy.sh en cada despliegue; en local
#  sirven para que `docker compose -f compose.prod.yml` no falle por variables
#  vacías cuando hay que depurar la pila de producción en la propia máquina.
# -----------------------------------------------------------------------------
detect_ghcr_owner() {
  local url owner
  if command -v gh > /dev/null 2>&1 && gh repo view --json owner > /dev/null 2>&1; then
    owner="$(gh repo view --json owner --jq .owner.login 2>/dev/null || true)"
  fi
  if [ -z "${owner:-}" ] && git -C "$ROOT" rev-parse --git-dir > /dev/null 2>&1; then
    url="$(git -C "$ROOT" remote get-url origin 2>/dev/null || true)"
    # Cubre las dos formas: git@github.com:Owner/repo.git y https://github.com/Owner/repo
    owner="$(printf '%s' "$url" | sed -E 's#^.*github\.com[:/]([^/]+)/.*$#\1#')"
    [ "$owner" = "$url" ] && owner=""
  fi
  # GHCR exige el propietario en MINÚSCULAS; el de GitHub no siempre lo está
  # (NatuAls -> natuals). Es un fallo clásico: la imagen se sube y luego el
  # `docker compose pull` del servidor no la encuentra.
  printf '%s' "${owner:-}" | tr '[:upper:]' '[:lower:]'
}

# `--verify` es imprescindible: sin él, `git rev-parse HEAD` en un repositorio
# recién iniciado, o con HEAD apuntando a una rama que no existe todavía,
# imprime la cadena literal "HEAD" y devuelve 0. El `||` no salta, y acabas con
# GITHUB_SHA=HEAD en el .env y un `docker compose pull` buscando la etiqueta
# :HEAD en GHCR.
detect_sha() {
  git -C "$ROOT" rev-parse --verify --quiet HEAD 2>/dev/null \
    || echo "0000000000000000000000000000000000000000"
}
detect_short() {
  git -C "$ROOT" rev-parse --verify --quiet --short HEAD 2>/dev/null || echo "local"
}
detect_branch() {
  local b
  b="$(git -C "$ROOT" symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
  [ -n "$b" ] || b="detached"
  printf '%s' "$b"
}

# -----------------------------------------------------------------------------
#  Bloque de GitHub Actions
# -----------------------------------------------------------------------------
print_github_block() {
  local prefix
  case "$ENV_NAME" in
    staging) prefix=STAGING ;;
    prod)    prefix=PROD ;;
    *) c_warn "El entorno 'dev' no se despliega: no hay nada que pegar en GitHub."; return 0 ;;
  esac

  cat <<EOF

===============================================================================
 GitHub -> Settings -> Secrets and variables -> Actions
 Entorno: ${ENV_NAME}   ·   generado el $(date -u +'%Y-%m-%d %H:%M UTC')
===============================================================================

--- Pestaña SECRETS (valores sensibles) -------------------------------------

${prefix}_DB_USER
$(read_env DB_USER)

${prefix}_DB_PASSWORD
$(read_env DB_PASSWORD)

${prefix}_DB_NAME
$(read_env DB_NAME)

${prefix}_JWT_SECRET
$(read_env JWT_ACCESS_SECRET)

${prefix}_JWT_REFRESH_SECRET
$(read_env JWT_REFRESH_SECRET)

${prefix}_PEPPER
$(read_env PASSWORD_PEPPER)

${prefix}_BACKUP_KEY
$(read_env BACKUP_ENCRYPTION_KEY)

${prefix}_METRICS_TOKEN
$(read_env METRICS_TOKEN)

--- Pestaña VARIABLES (no sensibles, visibles en los logs) -------------------

${prefix}_CORS_ORIGINS
$(read_env CORS_ORIGINS)

${prefix}_SMTP_HOST
$(read_env SMTP_HOST)

${prefix}_SMTP_PORT
$(read_env SMTP_PORT)

${prefix}_MAIL_FROM
$(read_env MAIL_FROM | tr -d '"')

${prefix}_RCLONE_REMOTE
$(read_env RCLONE_REMOTE || true)$( [ -z "$(read_env RCLONE_REMOTE || true)" ] && printf '<-- VACÍO: ver  bash scripts/gen-secrets.sh --rclone-help' || true )

--- No dependen del entorno (se definen una sola vez) ------------------------

ORACLE_HOST          IP pública de la instancia          [secret]
ORACLE_SSH_KEY       clave privada del usuario deployer  [secret]

===============================================================================
 AVISO: estos valores son los que acaba de escribir el script en tu .env.
 Si cambias uno en GitHub, cámbialo también aquí, o tendrás un entorno que
 funciona en local y falla en el servidor sin ningún mensaje que lo explique.
===============================================================================

EOF
}

if [ "$GITHUB_ONLY" -eq 1 ]; then
  [ -f "$ENV_FILE" ] || die "no existe $ENV_FILE; genera uno primero."
  print_github_block
  exit 0
fi

# -----------------------------------------------------------------------------
#  Protección del .env existente
# -----------------------------------------------------------------------------
if [ -f "$ENV_FILE" ]; then
  if [ "$FORCE" -eq 0 ]; then
    c_warn "  .env ya existe: no se toca (usa --force para regenerar, o bórralo)."
    c_warn "  Para ver el bloque de GitHub del .env actual:"
    c_warn "      bash scripts/gen-secrets.sh --env ${ENV_NAME} --github-only"
    exit 0
  fi
  BACKUP="$ENV_FILE.bak.$(date +%Y%m%d-%H%M%S)"
  cp "$ENV_FILE" "$BACKUP"
  chmod 600 "$BACKUP"
  c_warn "  .env anterior guardado en $(basename "$BACKUP")"
fi

[ -f "$TEMPLATE" ] || die "no encuentro $TEMPLATE"
cp "$TEMPLATE" "$ENV_FILE"
chmod 600 "$ENV_FILE"

# -----------------------------------------------------------------------------
#  Valores por entorno
# -----------------------------------------------------------------------------
case "$ENV_NAME" in
  dev)
    PG_USER="helpdesk_admin"; PG_DB="helpdesk_dev"
    ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
    MAIL="HelpDesk Lite <no-reply@helpdesk.local>"
    NODE_ENVIRONMENT="development"; LOGLEVEL="debug"; SEED="true"
    ;;
  staging)
    PG_USER="helpdesk_admin"; PG_DB="helpdesk_staging"
    ORIGINS="https://staging.${DOMAIN}"
    MAIL="HelpDesk Lite <no-reply@staging.${DOMAIN}>"
    NODE_ENVIRONMENT="production"; LOGLEVEL="debug"; SEED="false"
    ;;
  prod)
    PG_USER="helpdesk_admin"; PG_DB="helpdesk_prod"
    ORIGINS="https://${DOMAIN}"
    MAIL="HelpDesk Lite <no-reply@${DOMAIN}>"
    NODE_ENVIRONMENT="production"; LOGLEVEL="info"; SEED="false"
    ;;
esac

PG_PASS="$(rand 24)"

# -----------------------------------------------------------------------------
#  A) Bloque de desarrollo (compose.dev.yml)
# -----------------------------------------------------------------------------
replace NODE_ENV          "$NODE_ENVIRONMENT"
replace POSTGRES_USER     "$PG_USER"
replace POSTGRES_DB       "$PG_DB"
replace POSTGRES_PASSWORD "$PG_PASS"
# La URL se construye con las variables reales, sin incoherencias.
replace DATABASE_URL      "postgresql://${PG_USER}:${PG_PASS}@db:5432/${PG_DB}?schema=public"

# Access y refresh SIEMPRE distintos. Que hoy el refresh no se use (son bytes
# opacos, no JWT) no es motivo para reutilizar el mismo valor: el día que se
# use, un único secreto comprometido abriría las dos puertas.
replace JWT_ACCESS_SECRET  "$(rand 48)"
replace JWT_REFRESH_SECRET "$(rand 48)"
replace PASSWORD_PEPPER    "$(rand 32)"

replace CORS_ORIGINS "$ORIGINS"
replace SMTP_HOST    "mailpit"
replace SMTP_PORT    "1025"
replace MAIL_FROM    "\"${MAIL}\""
replace LOG_LEVEL    "$LOGLEVEL"
replace SEED_ON_BOOT "$SEED"

# NUEVO (tarea 9). Sin token, /api/metrics responde 404 y /api/health/status
# sólo devuelve el semáforo público.
replace METRICS_TOKEN "$(rand 32)"

# -----------------------------------------------------------------------------
#  B) Bloque de servidor (compose.prod.yml)
# -----------------------------------------------------------------------------
GHCR_OWNER_VALUE="$(detect_ghcr_owner)"
if [ -z "$GHCR_OWNER_VALUE" ]; then
  GHCR_OWNER_VALUE="cambia-esto"
  c_warn "  No he podido deducir GHCR_OWNER (¿sin remoto 'origin'?). Puesto a 'cambia-esto'."
  c_warn "  Sale de: git remote get-url origin  ->  la parte entre github.com/ y /repo, en minúsculas."
fi

replace ENV_NAME    "$ENV_NAME"
replace GHCR_OWNER  "$GHCR_OWNER_VALUE"
replace GITHUB_SHA  "$(detect_sha)"
replace APP_VERSION "$(detect_branch)-$(detect_short)"

# En el servidor, DB_* son los que de verdad usa la aplicación. En dev se
# rellenan igualmente para que compose.prod.yml se pueda validar en local.
replace DB_USER     "$PG_USER"
replace DB_PASSWORD "$PG_PASS"
replace DB_NAME     "$PG_DB"

replace BACKUP_RETENTION_DAYS "14"
# NUEVO (tarea 8). Cifra el dump y los adjuntos. Sin ella el servicio `backup`
# no arranca, y eso es deliberado: mejor no tener copia que tener una copia en
# claro con datos personales en el disco de la instancia.
replace BACKUP_ENCRYPTION_KEY "$(rand 48)"

# ÚNICO valor que este script no puede rellenar: depende de un bucket que hay
# que crear y de unas credenciales que emite la consola de Oracle.
replace RCLONE_REMOTE ""

# -----------------------------------------------------------------------------
#  rclone.conf, si la CLI de OCI está disponible
# -----------------------------------------------------------------------------
if [ "$WRITE_RCLONE" -eq 1 ]; then
  if command -v oci > /dev/null 2>&1; then
    NS="$(oci os ns get --query 'data' --raw-output 2>/dev/null || true)"
    REG="${OCI_REGION:-$(oci iam region-subscription list --query 'data[0]."region-name"' --raw-output 2>/dev/null || true)}"
    if [ -n "$NS" ] && [ -n "$REG" ]; then
      mkdir -p "$ROOT/rclone"
      cat > "$ROOT/rclone/rclone.conf" <<EOF
# Generado por gen-secrets.sh. Namespace y región deducidos con la CLI de OCI.
# FALTAN las dos claves: consola -> My profile -> Customer secret keys
# -> Generate secret key. La secreta se muestra UNA sola vez.
[objectstorage]
type = s3
provider = Other
env_auth = false
access_key_id = PEGA_AQUI_EL_ACCESS_KEY
secret_access_key = PEGA_AQUI_EL_SECRET_KEY
region = ${REG}
endpoint = https://${NS}.compat.objectstorage.${REG}.oraclecloud.com
acl = private
no_check_bucket = true
EOF
      chmod 600 "$ROOT/rclone/rclone.conf"
      c_ok "  rclone.conf creado con namespace='${NS}' y region='${REG}'."
      c_warn "  Faltan las dos claves; ver los pasos con --rclone-help."
    else
      c_warn "  La CLI de OCI está pero no devuelve namespace/región (¿sin 'oci setup config'?)."
      c_warn "  Usa --rclone-help para hacerlo a mano."
    fi
  else
    c_warn "  La CLI de OCI no está instalada; no puedo deducir el endpoint."
    c_warn "  Usa --rclone-help para los pasos manuales."
  fi
fi

# -----------------------------------------------------------------------------
#  Cierre
# -----------------------------------------------------------------------------
chmod 600 "$ENV_FILE"
c_ok "  .env creado para el entorno '${ENV_NAME}' con secretos generados (modo 600)."

c_head "Valores DEDUCIDOS (no son secretos, se pueden regenerar en cualquier momento)"
printf '  %-22s %s\n' "GHCR_OWNER"  "$(read_env GHCR_OWNER)"
printf '  %-22s %s\n' "GITHUB_SHA"  "$(read_env GITHUB_SHA)"
printf '  %-22s %s\n' "APP_VERSION" "$(read_env APP_VERSION)"
printf '  %-22s %s\n' "CORS_ORIGINS" "$(read_env CORS_ORIGINS)"

c_head "PENDIENTE de rellenar a mano"
c_warn "  RCLONE_REMOTE está vacío. Es el único valor que no se puede generar:"
c_warn "  depende de un bucket y de unas credenciales de Oracle Object Storage."
c_warn "  Pasos exactos:  bash scripts/gen-secrets.sh --rclone-help"

print_github_block
