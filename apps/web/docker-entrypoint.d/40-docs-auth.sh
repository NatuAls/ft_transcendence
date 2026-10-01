#!/bin/sh
# =============================================================================
#  Coloca el fichero de contraseñas de la documentación donde Nginx pueda leerlo
#
#  El secreto llega montado de sólo lectura en /run/docs/.htpasswd (ver
#  compose.prod.yml). En el disco del servidor ese fichero es 600 y pertenece al
#  usuario del despliegue: así ningún otro usuario de la máquina lo lee. Pero
#  `auth_basic_user_file` NO lo abre el proceso maestro de Nginx (que es root),
#  sino los procesos de trabajo, que corren como `nginx` (uid 101) — y para
#  ellos un 600 de otro usuario es "Permission denied". Nginx responde 500, y
#  con el error_page configurado eso acaba siendo un 404 desconcertante.
#
#  Por eso el entrypoint —que sí corre como root, antes de arrancar Nginx— hace
#  aquí la única copia que hace falta: la deja dentro del contenedor, legible
#  sólo por el usuario de los trabajos, en un sistema de ficheros efímero que
#  desaparece con el contenedor.
#
#  El secreto sigue sin estar en el repositorio ni en la imagen: este script no
#  contiene ninguna credencial, sólo la mueve de sitio. Si no hay nada montado,
#  no hace nada, y la documentación se queda con la configuración inofensiva
#  que la imagen trae de serie (auth_basic off + la API negando por su cuenta).
# =============================================================================
set -eu

MOUNTED=/run/docs/.htpasswd
TARGET=/etc/nginx/.htpasswd

if [ ! -f "$MOUNTED" ]; then
  exit 0
fi

cat "$MOUNTED" > "$TARGET"
chown nginx:nginx "$TARGET"
chmod 400 "$TARGET"

if [ -s "$TARGET" ]; then
  echo "40-docs-auth.sh: fichero de contraseñas de la documentación instalado"
else
  # Un fichero vacío es lo que escribe el despliegue cuando no hay secreto: en
  # ese caso docs-auth.inc lleva `deny all` y nadie llega a consultarlo.
  echo "40-docs-auth.sh: el fichero de contraseñas montado está vacío"
fi
