#!/usr/bin/env bash
# =============================================================================
#  Crea los roles helpdesk_app (aplicación, sólo DML) y helpdesk_monitor
#  (exportador, sólo pg_monitor) en la base de un entorno.   (auditoría B4)
#
#  Uso (en el servidor):  sudo bash scripts/ops/create-app-role.sh prod|staging
#
#  Genera las contraseñas con openssl, ejecuta scripts/ops/create-app-role.sql
#  dentro del contenedor de PostgreSQL con las credenciales del propietario
#  (las lee del .env del entorno) y las imprime UNA vez por pantalla. No las
#  guarda en ningún fichero: van a GitHub (PROD_DB_APP_PASSWORD) y al .env de
#  la observabilidad (PROD_DB_USER=helpdesk_monitor / PROD_DB_PASSWORD=…).
# =============================================================================
set -euo pipefail
ENV_NAME="${1:-}"
case "$ENV_NAME" in prod|staging) ;; *) echo "uso: $0 prod|staging" >&2; exit 1 ;; esac
SQL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/create-app-role.sql"
ENVFILE="/opt/helpdesk/$ENV_NAME/.env"
[ -r "$ENVFILE" ] || { echo "no puedo leer $ENVFILE (¿sudo?)" >&2; exit 1; }
DB_USER="$(grep -m1 '^DB_USER=' "$ENVFILE" | cut -d= -f2-)"
DB_NAME="$(grep -m1 '^DB_NAME=' "$ENVFILE" | cut -d= -f2-)"
APP_PW="$(openssl rand -hex 24)"
MON_PW="$(openssl rand -hex 24)"

# Si los roles ya existen, el SQL les cambiaría la contraseña y la API (o el
# exportador) que ya conecta con ellos dejaría de poder reconectar. Se para
# aquí salvo que se pida explícitamente (FORCE_ROTATE=1).
existing=$(docker exec "helpdesk-db-$ENV_NAME" sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Atc \"select string_agg(rolname, ', ') from pg_roles where rolname in ('helpdesk_app','helpdesk_monitor')\"")
if [ -n "$existing" ] && [ "${FORCE_ROTATE:-0}" != "1" ]; then
  echo "Ya existen en $ENV_NAME: $existing. La contraseña vigente está en /opt/helpdesk/$ENV_NAME/.env (DB_APP_PASSWORD)" >&2
  echo "y en /opt/helpdesk/observability/.env (${ENV_NAME^^}_DB_PASSWORD). Para rotarlas a propósito: FORCE_ROTATE=1 $0 $ENV_NAME" >&2
  exit 2
fi

docker exec -i -e APP_PW="$APP_PW" -e MON_PW="$MON_PW" "helpdesk-db-$ENV_NAME" \
  sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
           -v DBNAME="$POSTGRES_DB" \
           -v app_password="'"'"'$APP_PW'"'"'" \
           -v monitor_password="'"'"'$MON_PW'"'"'"' < "$SQL"

# Con SECRETS_OUT=<fichero>, las contraseñas se escriben ahí (600, root) en
# vez de imprimirse: útil cuando el script lo lanza una sesión cuya salida
# queda registrada (asistente, CI). Sin la variable, se imprimen una vez.
if [ -n "${SECRETS_OUT:-}" ]; then
  # Cada línea lleva el nombre exacto que consume su destino: la primera es
  # el secreto de GitHub; las otras dos van tal cual al .env de observabilidad
  # (compose.observability.yml lee ${ENV}_DB_USER / ${ENV}_DB_PASSWORD).
  # Temporal nuevo (umask 077) + chmod + mv atómico: si SECRETS_OUT ya
  # existiera con 644, una redirección directa conservaría esos permisos.
  umask 077
  tmp=$(mktemp "${SECRETS_OUT}.XXXXXX")
  printf '# GitHub → Secrets\n%s_DB_APP_PASSWORD=%s\n# /opt/helpdesk/observability/.env\n%s_DB_USER=helpdesk_monitor\n%s_DB_PASSWORD=%s\n' \
    "${ENV_NAME^^}" "$APP_PW" "${ENV_NAME^^}" "${ENV_NAME^^}" "$MON_PW" > "$tmp"
  chmod 600 "$tmp" && mv -f "$tmp" "$SECRETS_OUT"
  echo "Roles creados en $DB_NAME ($ENV_NAME). Contraseñas escritas en $SECRETS_OUT (600), con el nombre que espera cada destino."
  exit 0
fi

cat <<MSG

Roles creados en $DB_NAME ($ENV_NAME) por $DB_USER. Copia AHORA estos valores
(no se guardan en ningún sitio):

  GitHub → Secrets → ${ENV_NAME^^}_DB_APP_PASSWORD
      $APP_PW

  /opt/helpdesk/observability/.env → ${ENV_NAME^^}_DB_USER=helpdesk_monitor
                                    ${ENV_NAME^^}_DB_PASSWORD=$MON_PW
  (después: docker compose -f compose.observability.yml up -d postgres-exporter-$ENV_NAME)

Siguiente despliegue de $ENV_NAME: la API arrancará como helpdesk_app.
Comprobación: docker exec helpdesk-api-$ENV_NAME sh -c 'echo \$DATABASE_URL' | sed 's/:[^:@]*@/:***@/'
MSG
