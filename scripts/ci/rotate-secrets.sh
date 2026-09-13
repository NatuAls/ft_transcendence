#!/usr/bin/env bash
# =============================================================================
#  Generador de secretos de rotación para HelpDesk Lite.
#
#  Imprime un juego completo de valores nuevos, listos para pegar en
#  GitHub -> Settings -> Secrets and variables -> Actions.
#
#  Cuándo usarlo:
#    · Un secreto ha aparecido en un commit, un log, una captura o una
#      transcripción de chat. Da igual que se haya borrado después: si estuvo
#      en un repositorio público un solo minuto, hay que darlo por quemado.
#    · Rotación periódica.
#    · Alguien deja el equipo.
#
#  Uso:
#      bash scripts/ci/rotate-secrets.sh staging
#      bash scripts/ci/rotate-secrets.sh prod
#
#  NO escribe nada en disco a propósito: los valores salen por pantalla, se
#  pegan en GitHub y se cierra el terminal. Nada de ficheros intermedios que
#  luego alguien commitea sin querer.
# =============================================================================
set -euo pipefail

ENV_NAME="${1:-}"
case "$ENV_NAME" in
  staging) PREFIX=STAGING ;;
  prod)    PREFIX=PROD ;;
  *) echo "uso: rotate-secrets.sh <staging|prod>" >&2; exit 1 ;;
esac

command -v openssl > /dev/null || { echo "hace falta openssl" >&2; exit 1; }

cat <<EOF

===============================================================================
 Secretos nuevos para el entorno: ${ENV_NAME}
 Pégalos en: Settings -> Secrets and variables -> Actions -> pestaña Secrets
===============================================================================

${PREFIX}_DB_PASSWORD
$(openssl rand -hex 24)

${PREFIX}_JWT_SECRET
$(openssl rand -hex 48)

${PREFIX}_JWT_REFRESH_SECRET
$(openssl rand -hex 48)

${PREFIX}_PEPPER
$(openssl rand -hex 32)

-------------------------------------------------------------------------------
 DESPUÉS de actualizarlos en GitHub:

 1. Lanza el despliegue del entorno. El script reescribe el .env del servidor
    con los valores nuevos y recrea los contenedores.

 2. La contraseña de PostgreSQL NO se cambia sola: el volumen ya existe y la
    imagen sólo aplica POSTGRES_PASSWORD al inicializar una base vacía.
    Hay que cambiarla a mano ANTES de desplegar:

        cd /opt/helpdesk/${ENV_NAME}
        docker compose -f compose.prod.yml exec -T db \\
          psql -U "\$DB_USER" -d postgres \\
          -c "ALTER USER \\"\$DB_USER\\" WITH PASSWORD '<la nueva>';"

 3. Cambiar PASSWORD_PEPPER invalida TODAS las contraseñas existentes: el hash
    guardado se calculó con el pepper viejo y ya no va a coincidir. En staging
    da igual. En producción con usuarios reales, o se mantiene el pepper, o
    hay que forzar un restablecimiento de contraseña para todo el mundo.

 4. Cambiar los secretos JWT invalida las sesiones abiertas. Los usuarios
    tendrán que volver a entrar. Eso es lo deseable tras una filtración.
-------------------------------------------------------------------------------

EOF
