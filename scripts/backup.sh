#!/bin/sh
# =============================================================================
#  Copia de seguridad de HelpDesk Lite: volcado de PostgreSQL + adjuntos.
#
#  Lo ejecuta el servicio `backup` de compose.prod.yml (cron diario a las 00:00)
#  y también el pipeline de despliegue justo antes de aplicar migraciones.
#
#  Variables (las inyecta compose desde el .env del servidor):
#    POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB   obligatorias
#    BACKUP_RETENTION_DAYS                             opcional, por defecto 14
#    BACKUP_LABEL                                      opcional, sufijo del
#                                                      directorio (p. ej. el
#                                                      SHA que se va a desplegar)
#
#  Falla en cuanto algo va mal (`set -e`): una copia a medias que se da por
#  buena es peor que no tener copia.
# =============================================================================
set -eu

for var in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB; do
  eval "value=\${$var:-}"
  if [ -z "$value" ]; then
    echo "ERROR: falta la variable $var; no se puede hacer la copia." >&2
    exit 1
  fi
done

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
LABEL="${BACKUP_LABEL:-}"
DATE="$(date +'%Y-%m-%d_%H-%M-%S')"
[ -n "$LABEL" ] && DATE="${DATE}_${LABEL}"
BACKUP_DIR="/backups/${DATE}"

mkdir -p "$BACKUP_DIR"

# --- 1. Base de datos --------------------------------------------------------
echo "[backup] volcando PostgreSQL en ${BACKUP_DIR}/database.dump"
export PGPASSWORD="$POSTGRES_PASSWORD"
# -h db  = nombre del servicio en la red interna de Compose.
# -F c   = formato custom, restaurable con pg_restore y ya comprimido.
pg_dump -h db -U "$POSTGRES_USER" -F c -d "$POSTGRES_DB" -f "${BACKUP_DIR}/database.dump"

# Un dump vacío tiene ~100 bytes; se comprueba para no dar por buena una copia
# que en realidad falló contra una base inaccesible.
if [ ! -s "${BACKUP_DIR}/database.dump" ]; then
  echo "ERROR: el volcado de la base de datos está vacío." >&2
  exit 1
fi

# --- 2. Adjuntos -------------------------------------------------------------
echo "[backup] comprimiendo adjuntos en ${BACKUP_DIR}/uploads.tar.gz"
tar -czf "${BACKUP_DIR}/uploads.tar.gz" -C / uploads

# --- 3. Manifiesto -----------------------------------------------------------
{
  echo "fecha=${DATE}"
  echo "base_de_datos=${POSTGRES_DB}"
  echo "etiqueta=${LABEL}"
  echo "dump_bytes=$(wc -c < "${BACKUP_DIR}/database.dump")"
  echo "uploads_bytes=$(wc -c < "${BACKUP_DIR}/uploads.tar.gz")"
} > "${BACKUP_DIR}/MANIFEST"

# --- 4. Retención ------------------------------------------------------------
# Sin esto el volumen de copias crece hasta llenar el disco de la instancia.
echo "[backup] eliminando copias de más de ${RETENTION_DAYS} días"
find /backups -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -exec rm -rf {} + 2>/dev/null || true

echo "[backup] copia completada en ${BACKUP_DIR}"
