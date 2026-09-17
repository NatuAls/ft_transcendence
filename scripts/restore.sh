#!/usr/bin/env bash
# =============================================================================
#  Restauración de HelpDesk Lite — ensayo y recuperación real
#
#  Cubre el punto de la tarea 8 que no estaba: "probar periódicamente una
#  restauración completa en un entorno aislado y registrar RPO/RTO".
#
#  DOS MODOS:
#
#    --drill   (por defecto)  ENSAYO. Levanta un PostgreSQL efímero en una red
#              aparte, restaura ahí la copia, cuenta filas, comprueba que las
#              migraciones de Prisma están todas aplicadas y que cada adjunto
#              de la base existe en el tar. No toca producción. Mide y registra
#              el RTO real. Es lo que ejecuta el workflow semanal.
#
#    --production   RECUPERACIÓN DE VERDAD. Para la API y la web, restaura
#              sobre la base en uso y vuelve a levantar. Exige escribir
#              literalmente RESTAURAR para continuar.
#
#  USO
#      bash scripts/restore.sh --drill                       # última copia
#      bash scripts/restore.sh --drill  backups/2026-09-10_00-00-00
#      bash scripts/restore.sh --production backups/2026-09-10_00-00-00_predeploy-16ad0d0
#
#  Se ejecuta EN el servidor, desde /opt/helpdesk/<entorno>, con el .env
#  del entorno presente (de ahí salen DB_USER, DB_NAME y la clave de cifrado).
# =============================================================================
set -euo pipefail

MODE="--drill"
BACKUP_PATH=""
for arg in "$@"; do
  case "$arg" in
    --drill|--production) MODE="$arg" ;;
    -*) echo "opción desconocida: $arg" >&2; exit 2 ;;
    *) BACKUP_PATH="$arg" ;;
  esac
done

log()  { printf '\n\033[0;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '  \033[0;32m✔\033[0m %s\n' "$*"; }
bad()  { printf '  \033[0;31m✘\033[0m %s\n' "$*"; }
die()  { echo "ERROR: $*" >&2; exit 1; }

[ -f .env ] || die "no encuentro .env; ejecuta este script desde /opt/helpdesk/<entorno>."
# El .env es de Compose, no de bash: `MAIL_FROM=HelpDesk Lite <no-reply@…>`
# sin comillas es sintaxis inválida para `source` (el primer ensayo, 17/09,
# murió con "syntax error near unexpected token newline"). Se leen sólo las
# claves necesarias, línea a línea, sin interpretar nada.
env_get() { # env_get <clave>
  grep -m1 "^$1=" .env | cut -d= -f2-
}
DB_USER="$(env_get DB_USER)"
DB_PASSWORD="$(env_get DB_PASSWORD)"
DB_NAME="$(env_get DB_NAME)"
BACKUP_ENCRYPTION_KEY="$(env_get BACKUP_ENCRYPTION_KEY)"
ENV_NAME="$(env_get ENV_NAME)"
GHCR_OWNER="$(env_get GHCR_OWNER)"
GITHUB_SHA="$(env_get GITHUB_SHA)"
export DB_USER DB_PASSWORD DB_NAME BACKUP_ENCRYPTION_KEY ENV_NAME GHCR_OWNER GITHUB_SHA

: "${DB_USER:?falta DB_USER en .env}"
: "${DB_PASSWORD:?falta DB_PASSWORD en .env}"
: "${DB_NAME:?falta DB_NAME en .env}"
: "${BACKUP_ENCRYPTION_KEY:?falta BACKUP_ENCRYPTION_KEY en .env}"

# Última copia si no se ha indicado ninguna.
if [ -z "$BACKUP_PATH" ]; then
  BACKUP_PATH="$(find backups -mindepth 1 -maxdepth 1 -type d -name '20*' | sort | tail -1)"
  [ -n "$BACKUP_PATH" ] || die "no hay ninguna copia en backups/."
fi
[ -f "$BACKUP_PATH/database.dump.enc" ] || die "no existe $BACKUP_PATH/database.dump.enc"

STARTED_AT=$(date +%s)
FAILURES=0
REPORT="${BACKUP_PATH}/RESTORE-DRILL-$(date +%Y%m%d-%H%M%S).txt"

log "Copia seleccionada: $BACKUP_PATH  ·  modo: $MODE"
cat "$BACKUP_PATH/MANIFEST" 2>/dev/null || true

# -----------------------------------------------------------------------------
# 1. Integridad antes de tocar nada: las huellas del MANIFEST.
# -----------------------------------------------------------------------------
log "Verificando huellas SHA-256"
if [ -f "$BACKUP_PATH/MANIFEST" ]; then
  expected_db=$(grep -m1 '^dump_sha256=' "$BACKUP_PATH/MANIFEST" | cut -d= -f2- || true)
  actual_db=$(sha256sum "$BACKUP_PATH/database.dump.enc" | cut -d' ' -f1)
  if [ -n "$expected_db" ] && [ "$expected_db" != "$actual_db" ]; then
    bad "la huella del dump NO coincide: la copia está corrupta."
    FAILURES=$((FAILURES + 1))
  else
    ok "huella del dump correcta"
  fi
else
  bad "sin MANIFEST: no se puede verificar la integridad"
  FAILURES=$((FAILURES + 1))
fi

decrypt() { # decrypt <fichero.enc>  -> stdout
  openssl enc -d -aes-256-cbc -md sha512 -pbkdf2 -iter 250000 \
    -pass env:BACKUP_ENCRYPTION_KEY -in "$1"
}
export BACKUP_ENCRYPTION_KEY

# =============================================================================
#  MODO ENSAYO
# =============================================================================
if [ "$MODE" = "--drill" ]; then
  DRILL_NET="helpdesk-drill-net-$$"
  DRILL_DB="helpdesk-drill-db-$$"
  DRILL_PASS="drill_$(head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n')"

  cleanup() {
    docker rm -f "$DRILL_DB" > /dev/null 2>&1 || true
    docker network rm "$DRILL_NET" > /dev/null 2>&1 || true
  }
  trap cleanup EXIT

  log "Levantando PostgreSQL efímero AISLADO (red propia, sin puertos publicados)"
  # --internal: la red no tiene salida. El ensayo no puede, ni por error de
  # configuración, hablar con la base de producción ni con internet.
  docker network create --internal "$DRILL_NET" > /dev/null
  docker run -d --name "$DRILL_DB" --network "$DRILL_NET" \
    -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD="$DRILL_PASS" \
    -e POSTGRES_DB="$DB_NAME" \
    --tmpfs /var/lib/postgresql/data:rw,size=2g \
    postgres:15-alpine > /dev/null

  printf '  esperando a que arranque'
  for _ in $(seq 1 60); do
    if docker exec "$DRILL_DB" pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
      printf ' listo\n'; break
    fi
    printf '.'; sleep 2
  done
  docker exec "$DRILL_DB" pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1 \
    || die "el PostgreSQL del ensayo no arrancó."

  log "Restaurando el dump"
  # --no-privileges: el dump lleva los GRANT al rol helpdesk_app (mínimo
  # privilegio, scripts/ops/create-app-role.sql) y ese rol no existe en el
  # PostgreSQL efímero del ensayo; sin esta opción pg_restore contaba 77
  # errores por "role does not exist" y el ensayo salía FALLIDO (17/09).
  # En una recuperación real (--production) los roles sí existen y los
  # permisos se restauran; si no existieran, create-app-role.sh los rehace.
  if decrypt "$BACKUP_PATH/database.dump.enc" \
      | docker exec -i -e PGPASSWORD="$DRILL_PASS" "$DRILL_DB" \
          pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --no-privileges \
      2> "${BACKUP_PATH}/.restore.log"; then
    ok "pg_restore terminó sin errores"
  else
    # pg_restore devuelve != 0 por avisos benignos (DROP de algo inexistente).
    # Se distingue el aviso del fallo real leyendo el log.
    if grep -qiE '^pg_restore: error' "${BACKUP_PATH}/.restore.log"; then
      bad "pg_restore ha fallado:"; tail -20 "${BACKUP_PATH}/.restore.log"
      FAILURES=$((FAILURES + 1))
    else
      ok "pg_restore terminó con avisos benignos"
    fi
  fi

  q() { docker exec -e PGPASSWORD="$DRILL_PASS" "$DRILL_DB" \
          psql -U "$DB_USER" -d "$DB_NAME" -tAc "$1" 2>/dev/null || echo "ERR"; }

  log "Comprobaciones sobre la base restaurada"
  for table in users organizations tickets ticket_comments attachments; do
    count=$(q "SELECT count(*) FROM ${table};")
    if [ "$count" = "ERR" ]; then
      bad "la tabla ${table} no existe en la copia restaurada"
      FAILURES=$((FAILURES + 1))
    else
      ok "${table}: ${count} filas"
    fi
  done

  # Migraciones de Prisma: una copia buena tiene el mismo historial aplicado
  # que producción, y ninguna a medias.
  pending=$(q "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL;")
  applied=$(q "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;")
  if [ "$pending" = "ERR" ]; then
    bad "no existe la tabla _prisma_migrations: la copia no viene de esta aplicación"
    FAILURES=$((FAILURES + 1))
  elif [ "$pending" != "0" ]; then
    bad "hay ${pending} migraciones sin terminar en la copia"
    FAILURES=$((FAILURES + 1))
  else
    ok "migraciones de Prisma: ${applied} aplicadas, 0 a medias"
  fi

  # Coherencia base <-> adjuntos: cada storageKey vivo debe estar en el tar.
  # Es la comprobación que justifica el orden dump-antes-que-uploads.
  log "Coherencia entre la base y el archivo de adjuntos"
  if [ -f "$BACKUP_PATH/uploads.tar.gz.enc" ]; then
    decrypt "$BACKUP_PATH/uploads.tar.gz.enc" | tar -tzf - > /tmp/drill-uploads.txt 2>/dev/null \
      || { bad "el archivo de adjuntos no se puede descifrar/abrir"; FAILURES=$((FAILURES + 1)); }
    keys=$(q "SELECT \"storageKey\" FROM attachments WHERE \"deletedAt\" IS NULL;")
    missing=0; total=0
    if [ "$keys" != "ERR" ] && [ -n "$keys" ]; then
      while IFS= read -r key; do
        [ -n "$key" ] || continue
        total=$((total + 1))
        grep -qF -- "$key" /tmp/drill-uploads.txt || missing=$((missing + 1))
      done <<< "$keys"
    fi
    if [ "$missing" -gt 0 ]; then
      bad "${missing} de ${total} adjuntos vivos NO están en el archivo"
      FAILURES=$((FAILURES + 1))
    else
      ok "los ${total} adjuntos vivos están presentes en el archivo"
    fi
    rm -f /tmp/drill-uploads.txt
  else
    bad "no hay uploads.tar.gz.enc en esta copia"
    FAILURES=$((FAILURES + 1))
  fi

  ELAPSED=$(( $(date +%s) - STARTED_AT ))
  log "RTO medido en este ensayo: ${ELAPSED}s (objetivo: 3600s)"

  {
    echo "ensayo_de_restauracion=$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
    echo "copia=${BACKUP_PATH}"
    echo "rto_medido_segundos=${ELAPSED}"
    echo "rto_objetivo_segundos=3600"
    echo "comprobaciones_fallidas=${FAILURES}"
    echo "resultado=$([ "$FAILURES" -eq 0 ] && echo CORRECTO || echo FALLIDO)"
  } > "$REPORT"
  echo
  cat "$REPORT"

  # Métrica para Prometheus: alerta si el último ensayo correcto es antiguo.
  METRICS_FILE="${BACKUP_METRICS_FILE:-/opt/helpdesk/${ENV_NAME:-prod}/backups/metrics/restore.prom}"
  mkdir -p "$(dirname "$METRICS_FILE")"
  # Misma etiqueta `env` que backup.sh: prod y staging comparten node-exporter.
  l="{env=\"${ENV_NAME:-prod}\"}"
  {
    echo "# HELP helpdesk_restore_drill_last_timestamp_seconds Último ensayo de restauración."
    echo "# TYPE helpdesk_restore_drill_last_timestamp_seconds gauge"
    echo "helpdesk_restore_drill_last_timestamp_seconds${l} $(date +%s)"
    echo "# HELP helpdesk_restore_drill_failures Comprobaciones fallidas del último ensayo."
    echo "# TYPE helpdesk_restore_drill_failures gauge"
    echo "helpdesk_restore_drill_failures${l} ${FAILURES}"
    echo "# HELP helpdesk_restore_drill_duration_seconds RTO medido en el último ensayo."
    echo "# TYPE helpdesk_restore_drill_duration_seconds gauge"
    echo "helpdesk_restore_drill_duration_seconds${l} ${ELAPSED}"
  } > "${METRICS_FILE}.tmp" && mv "${METRICS_FILE}.tmp" "$METRICS_FILE"

  [ "$FAILURES" -eq 0 ] || exit 1
  exit 0
fi

# =============================================================================
#  MODO PRODUCCIÓN
# =============================================================================
COMPOSE="docker compose -f compose.prod.yml"

cat <<MSG

  ⚠  RESTAURACIÓN SOBRE ${DB_NAME} (entorno ${ENV_NAME:-desconocido}).

     Esto DESTRUYE el contenido actual de la base y lo sustituye por el de
     ${BACKUP_PATH}. Todo lo escrito después de esa copia se pierde.

     Antes de continuar se hace una copia de emergencia del estado actual.

MSG
read -r -p '  Escribe RESTAURAR para continuar: ' answer
[ "$answer" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }

log "Copia de emergencia del estado ACTUAL (por si la restauración es el error)"
$COMPOSE run --rm --no-deps \
  -e POSTGRES_USER="$DB_USER" -e POSTGRES_PASSWORD="$DB_PASSWORD" \
  -e POSTGRES_DB="$DB_NAME" -e BACKUP_LABEL="pre-restore" \
  -e BACKUP_ENCRYPTION_KEY="$BACKUP_ENCRYPTION_KEY" \
  --entrypoint "sh /backup.sh" backup

log "Parando API y web (la base sigue en pie)"
$COMPOSE stop api web

log "Restaurando la base de datos"
decrypt "$BACKUP_PATH/database.dump.enc" \
  | $COMPOSE exec -T -e PGPASSWORD="$DB_PASSWORD" db \
      pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner \
  || echo "  (pg_restore ha devuelto avisos; revísalos arriba)"

if [ -f "$BACKUP_PATH/uploads.tar.gz.enc" ]; then
  log "Restaurando los adjuntos"
  # Se restauran DENTRO del contenedor de backup, que monta el volumen uploads.
  # Nota: el volumen se monta :ro en compose.prod.yml; para esta operación se
  # usa un contenedor efímero con el volumen en lectura-escritura.
  decrypt "$BACKUP_PATH/uploads.tar.gz.enc" \
    | docker run --rm -i -v "uploads_${ENV_NAME:-prod}:/uploads" \
        postgres:15-alpine sh -c 'tar -xzf - -C / --overwrite'
fi

log "Levantando de nuevo la pila"
$COMPOSE up -d

log "Restauración terminada en $(( $(date +%s) - STARTED_AT ))s. Comprueba /api/health/ready."
