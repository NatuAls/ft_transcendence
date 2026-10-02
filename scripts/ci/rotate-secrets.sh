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

# Mismos generadores que scripts/gen-secrets.sh, para que un secreto rotado
# aquí valga exactamente igual que uno recién generado allí.
password() { printf 'Hd-%s-A1!' "$(openssl rand -hex 12)"; }
DOCS_PASS="$(password)"
ADMIN_PASS="$(password)"

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

${PREFIX}_METRICS_TOKEN
$(openssl rand -hex 32)

${PREFIX}_BACKUP_KEY
$(openssl rand -hex 48)

${PREFIX}_DOCS_GATEWAY_TOKEN
$(openssl rand -hex 32)

${PREFIX}_DOCS_HTPASSWD
docs:$(openssl passwd -6 "$DOCS_PASS")

${PREFIX}_BOOTSTRAP_ADMIN_PASSWORD
${ADMIN_PASS}

-------------------------------------------------------------------------------
 LAS DOS CONTRASEÑAS EN CLARO (apúntalas: no salen de ningún otro sitio)

   documentación de la API .... docs / ${DOCS_PASS}
   administrador principal .... ${ADMIN_PASS}

 De la primera, GitHub sólo guarda el hash de arriba; de la segunda, el valor
 en claro (lo necesita la API para crear la cuenta).
-------------------------------------------------------------------------------

 QUÉ NO ROTA ESTE SCRIPT

   ${PREFIX}_DB_APP_PASSWORD   la genera el servidor:
                               sudo bash scripts/ops/create-app-role.sh ${ENV_NAME}
   ${PREFIX}_BOOTSTRAP_ADMIN_USERNAME
                               el nombre del administrador no se rota por
                               rotar: cambiarlo deja la cuenta anterior ahí y
                               crea otra. Si hay que cambiarlo, hazlo a
                               conciencia y borra la vieja desde el panel.
   ORACLE_HOST / ORACLE_SSH_KEY
                               infraestructura: la clave, con
                               ssh-keygen -t ed25519, y hay que copiar la
                               pública a /home/deployer/.ssh/authorized_keys
                               ANTES de cambiar el secreto.

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

 5. BACKUP_KEY: guarda la ANTERIOR. Las copias ya subidas se cifraron con
    ella y sin ella son ruido irrecuperable.

 6. La contraseña del administrador principal no se aplica sola: hay que poner
    la variable ${PREFIX}_BOOTSTRAP_ADMIN_ROTATE a 1, desplegar y devolverla a
    0. El despliegue la fija y revoca las sesiones de esa cuenta.
-------------------------------------------------------------------------------

EOF
