#!/bin/sh
# =============================================================================
#  Copia de seguridad CIFRADA de HelpDesk Lite — v2
#
#  Sustituye a scripts/backup.sh. Cambios respecto a la v1:
#
#    1. CIFRADO en origen (AES-256-CBC + PBKDF2, `openssl enc`; `enc` no hace
#       GCM). El dump nunca toca el disco en claro: pg_dump escribe a una
#       tubería que ya sale cifrada. Cumple "copias cifradas" de la tarea 8.
#    2. COPIA FUERA DEL HOST (rclone a un bucket S3-compatible). Una copia que
#       vive en el mismo disco que la base de datos no protege del único fallo
#       que de verdad importa: perder la instancia.
#    3. HUELLAS SHA-256 en el MANIFEST, para detectar corrupción silenciosa
#       antes de necesitar la copia.
#    4. MÉTRICAS para Prometheus (textfile collector de node_exporter), de modo
#       que "el backup lleva 2 días sin correr" dispare una alerta en vez de
#       descubrirse el día del desastre.
#    5. Salida de error EXPLÍCITA en cada fase: una copia a medias que se da
#       por buena es peor que no tener copia.
#
#  ORDEN DELIBERADO: primero la base, después los adjuntos.
#      dump(T0) -> tar(T1). Un fichero subido entre T0 y T1 queda en el tar
#      pero no en el dump: al restaurar es un fichero huérfano, basura inocua.
#      Al revés (tar primero) quedaría una fila en la base apuntando a un
#      fichero que no existe: un 404 permanente. Se prefiere basura a datos
#      rotos.
#
#  Variables (las inyecta compose desde el .env del servidor):
#    OBLIGATORIAS
#      POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
#      BACKUP_ENCRYPTION_KEY   frase de cifrado (>= 32 caracteres).
#                              Generar con: openssl rand -base64 48
#    OPCIONALES
#      BACKUP_RETENTION_DAYS   por defecto 14
#      BACKUP_LABEL            sufijo del directorio (p. ej. el SHA a desplegar)
#      BACKUP_METRICS_FILE     por defecto /backups/metrics/backup.prom
#      RCLONE_REMOTE           p. ej. "objectstorage:helpdesk-backups/prod".
#                              Si está vacío se OMITE la copia externa y se
#                              avisa por pantalla (no es un error fatal, para
#                              no romper el despliegue en un entorno de
#                              pruebas sin bucket).
#      RCLONE_CONFIG           por defecto /rclone/rclone.conf (montado :ro)
#
#  RPO / RTO acordados (ver doc/DEVOPS_CICD.md §10):
#      RPO 24 h  — copia programada diaria a las 00:00 + copia previa a cada
#                  despliegue. Pérdida máxima teórica: un día de tickets.
#      RTO  1 h  — objetivo de restauración completa verificada con
#                  scripts/restore.sh sobre una instancia limpia.
# =============================================================================
set -eu

log()  { echo "[backup] $*"; }
die()  { echo "ERROR: $*" >&2; exit 1; }

# --- 0. Requisitos -----------------------------------------------------------
for var in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB BACKUP_ENCRYPTION_KEY; do
  eval "value=\${$var:-}"
  [ -n "$value" ] || die "falta la variable $var; no se puede hacer la copia."
done

# Etiqueta `env` de las métricas: prod y staging comparten el node-exporter y
# sin ella sus series serían indistinguibles (y colisionarían).
ENV_LABEL="${BACKUP_ENV:-${ENV_NAME:-unknown}}"
LABEL="${BACKUP_LABEL:-}"
METRICS_FILE="${BACKUP_METRICS_FILE:-/backups/metrics/backup.prom}"
DATE="$(date +'%Y-%m-%d_%H-%M-%S')"
[ -n "$LABEL" ] && DATE="${DATE}_${LABEL}"
BACKUP_DIR="/backups/${DATE}"
STARTED_AT="$(date +%s)"

mkdir -p "$BACKUP_DIR" "$(dirname "$METRICS_FILE")"

# --- Métricas: se escriben SIEMPRE, también al fallar ------------------------
# node_exporter (--collector.textfile.directory) las publica y Prometheus
# alerta sobre helpdesk_backup_last_exit_code y *_last_success_timestamp.
write_metrics() { # write_metrics <exit_code> <db_bytes> <uploads_bytes>
  now="$(date +%s)"
  tmp="${METRICS_FILE}.tmp"
  l="{env=\"${ENV_LABEL}\"}"
  {
    echo "# HELP helpdesk_backup_last_run_timestamp_seconds Última ejecución del backup."
    echo "# TYPE helpdesk_backup_last_run_timestamp_seconds gauge"
    echo "helpdesk_backup_last_run_timestamp_seconds${l} ${now}"
    echo "# HELP helpdesk_backup_last_exit_code Código de salida de la última copia (0 = correcta)."
    echo "# TYPE helpdesk_backup_last_exit_code gauge"
    echo "helpdesk_backup_last_exit_code${l} $1"
    echo "# HELP helpdesk_backup_duration_seconds Duración de la última copia."
    echo "# TYPE helpdesk_backup_duration_seconds gauge"
    echo "helpdesk_backup_duration_seconds${l} $((now - STARTED_AT))"
    if [ "$1" -eq 0 ]; then
      echo "# HELP helpdesk_backup_last_success_timestamp_seconds Última copia correcta."
      echo "# TYPE helpdesk_backup_last_success_timestamp_seconds gauge"
      echo "helpdesk_backup_last_success_timestamp_seconds${l} ${now}"
      echo "# HELP helpdesk_backup_database_bytes Tamaño del dump cifrado."
      echo "# TYPE helpdesk_backup_database_bytes gauge"
      echo "helpdesk_backup_database_bytes${l} $2"
      echo "# HELP helpdesk_backup_uploads_bytes Tamaño del archivo de adjuntos cifrado."
      echo "# TYPE helpdesk_backup_uploads_bytes gauge"
      echo "helpdesk_backup_uploads_bytes${l} $3"
    fi
  } > "$tmp" && mv "$tmp" "$METRICS_FILE"
}

on_error() {
  code=$?
  echo "ERROR: la copia ha fallado (código ${code}). Directorio parcial: ${BACKUP_DIR}" >&2
  write_metrics "$code" 0 0
  exit "$code"
}
# El trap se instala ANTES de instalar herramientas: la copia de staging del
# 17/09 falló en `apk add openssl` y, con el trap más abajo, no dejó métrica
# y la alerta BackupFallido no pudo verlo.
trap on_error EXIT INT TERM

# La imagen postgres:15-alpine no garantiza traer el binario `openssl`, sólo la
# biblioteca. Se instala una vez por contenedor; en un cron diario el coste es
# irrelevante y evita mantener una imagen propia sólo para esto. Tres intentos
# con espera: un fallo puntual del espejo de Alpine a las 00:00 no debe dejar
# una noche sin copia.
install_pkg() { # install_pkg <paquete>
  for attempt in 1 2 3; do
    apk add --no-cache "$1" > /dev/null 2>&1 && return 0
    sleep $((attempt * 10))
  done
  return 1
}
if ! command -v openssl > /dev/null 2>&1; then
  log "instalando openssl…"
  install_pkg openssl || die "no se pudo instalar openssl."
fi

# ${#var} es POSIX y no depende del formato de salida de wc (BSD lo rellena con
# espacios; la versión anterior se saltaba la comprobación en ese caso).
[ "${#BACKUP_ENCRYPTION_KEY}" -ge 32 ] \
  || die "BACKUP_ENCRYPTION_KEY debe tener al menos 32 caracteres (tiene ${#BACKUP_ENCRYPTION_KEY})."

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

# --- 1. Base de datos, cifrada al vuelo --------------------------------------
# `pg_dump | openssl` en tubería: el volcado en claro NUNCA se escribe a disco.
# -F c   formato custom (comprimido, restaurable con pg_restore selectivo)
# -Z 6   compresión antes de cifrar (cifrar comprime mal por definición)
log "volcando y cifrando PostgreSQL -> ${BACKUP_DIR}/database.dump.enc"
export PGPASSWORD="$POSTGRES_PASSWORD"
# shellcheck disable=SC2086
pg_dump -h db -U "$POSTGRES_USER" -F c -Z 6 -d "$POSTGRES_DB" \
  | openssl enc -aes-256-cbc -md sha512 -pbkdf2 -iter 250000 -salt \
      -pass env:BACKUP_ENCRYPTION_KEY \
      -out "${BACKUP_DIR}/database.dump.enc"

# `set -o pipefail` no existe en sh POSIX: se comprueba el resultado a mano.
# Un dump vacío o ridículamente pequeño significa que pg_dump falló y openssl
# cifró la nada tan contento.
DB_BYTES="$(wc -c < "${BACKUP_DIR}/database.dump.enc")"
[ "$DB_BYTES" -gt 1024 ] || die "el volcado cifrado son ${DB_BYTES} bytes: la copia no es válida."

# --- 2. Adjuntos, cifrados ---------------------------------------------------
log "comprimiendo y cifrando adjuntos -> ${BACKUP_DIR}/uploads.tar.gz.enc"
tar -czf - -C / uploads \
  | openssl enc -aes-256-cbc -md sha512 -pbkdf2 -iter 250000 -salt \
      -pass env:BACKUP_ENCRYPTION_KEY \
      -out "${BACKUP_DIR}/uploads.tar.gz.enc"
UPLOADS_BYTES="$(wc -c < "${BACKUP_DIR}/uploads.tar.gz.enc")"
[ "$UPLOADS_BYTES" -gt 0 ] || die "el archivo de adjuntos cifrado está vacío."

# --- 3. Manifiesto con huellas ----------------------------------------------
# Las huellas se calculan sobre el fichero CIFRADO: es lo que se copia fuera y
# lo que hay que poder verificar sin descifrar nada (y por tanto sin tener la
# clave a mano).
log "escribiendo manifiesto"
{
  echo "fecha=${DATE}"
  echo "base_de_datos=${POSTGRES_DB}"
  echo "etiqueta=${LABEL}"
  echo "cifrado=aes-256-cbc/pbkdf2-250k"
  echo "dump_bytes=${DB_BYTES}"
  echo "uploads_bytes=${UPLOADS_BYTES}"
  echo "dump_sha256=$(sha256sum "${BACKUP_DIR}/database.dump.enc" | cut -d' ' -f1)"
  echo "uploads_sha256=$(sha256sum "${BACKUP_DIR}/uploads.tar.gz.enc" | cut -d' ' -f1)"
  echo "orden=dump_antes_que_uploads"
  echo "rpo_horas=24"
  echo "rto_objetivo_minutos=60"
} > "${BACKUP_DIR}/MANIFEST"

# --- 4. Verificación inmediata ----------------------------------------------
# Descifrar la cabecera y comprobar que pg_restore la reconoce como archivo
# custom válido. Cuesta un segundo y convierte "hay un fichero" en "hay una
# copia restaurable". Sin esto, una clave mal escrita produce 200 MB de ruido
# que nadie descubre hasta el día del incidente.
log "verificando que el dump cifrado se puede abrir"
openssl enc -d -aes-256-cbc -md sha512 -pbkdf2 -iter 250000 \
    -pass env:BACKUP_ENCRYPTION_KEY -in "${BACKUP_DIR}/database.dump.enc" \
  | pg_restore --list > "${BACKUP_DIR}/toc.txt" 2>/dev/null \
  || die "el dump cifrado no se puede descifrar o no es un archivo pg_dump válido."
[ -s "${BACKUP_DIR}/toc.txt" ] || die "el índice del dump está vacío."
log "verificación correcta ($(wc -l < "${BACKUP_DIR}/toc.txt") objetos en el índice)"

# --- 5. Copia FUERA del host -------------------------------------------------
# Requisito explícito de la tarea 8. Sin esto, perder la instancia de Oracle
# significa perder a la vez la base de datos y todas sus copias.
if [ -n "${RCLONE_REMOTE:-}" ]; then
  if ! command -v rclone > /dev/null 2>&1; then
    log "instalando rclone…"
    install_pkg rclone || die "no se pudo instalar rclone."
  fi
  log "copiando a ${RCLONE_REMOTE}/${DATE}"
  rclone --config "${RCLONE_CONFIG:-/rclone/rclone.conf}" \
    copy "$BACKUP_DIR" "${RCLONE_REMOTE}/${DATE}" \
    --exclude 'toc.txt' --transfers 2 --retries 3 \
    || die "la copia externa ha fallado."
  # Retención en el destino remoto, independiente de la local.
  rclone --config "${RCLONE_CONFIG:-/rclone/rclone.conf}" \
    delete "${RCLONE_REMOTE}" --min-age "${RETENTION_DAYS}d" --rmdirs \
    > /dev/null 2>&1 || log "aviso: no se pudo aplicar retención remota."
  log "copia externa completada."
else
  log "AVISO: RCLONE_REMOTE sin definir -> la copia se queda SÓLO en este host."
  log "       Un fallo de la instancia se lleva por delante datos y copias."
fi

# --- 6. Retención local ------------------------------------------------------
log "eliminando copias locales de más de ${RETENTION_DAYS} días"
find /backups -mindepth 1 -maxdepth 1 -type d -name '20*' \
  -mtime "+${RETENTION_DAYS}" -exec rm -rf {} + 2>/dev/null || true

# --- 7. Cierre ---------------------------------------------------------------
trap - EXIT INT TERM
write_metrics 0 "$DB_BYTES" "$UPLOADS_BYTES"
log "copia completada en ${BACKUP_DIR} ($(( $(date +%s) - STARTED_AT ))s)"
