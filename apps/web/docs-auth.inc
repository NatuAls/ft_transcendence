# =============================================================================
#  Puerta 1 de la documentación: autenticación del proxy
#
#  Este fichero es el que se MONTA sobre-escrito en el servidor (ver
#  compose.prod.yml y scripts/deploy/remote-deploy.sh). La versión que viaja en
#  la imagen deja la puerta abierta a propósito: en desarrollo no hay secreto
#  que montar, y en producción el despliegue sustituye este fichero por uno con
#
#      auth_basic            "HelpDesk Lite - internal documentation";
#      auth_basic_user_file  /etc/nginx/.htpasswd;
#
#  El `.htpasswd` se escribe en el disco del servidor desde un secreto de
#  GitHub en cada despliegue: nunca está en el repositorio ni dentro de la
#  imagen, que es donde un fichero de contraseñas no debe estar jamás. Se monta
#  en /run/docs y el entrypoint de la imagen (docker-entrypoint.d/40-docs-auth.sh)
#  lo instala donde los procesos de trabajo de Nginx puedan leerlo.
#
#  Y si ese secreto no llega, el despliegue escribe aquí `return 404;`: sin
#  contraseña que comprobar, la documentación no se sirve. Cerrado por defecto.
# =============================================================================
auth_basic off;
