# =============================================================================
#  Puerta 2 de la documentación: prueba de haber pasado por el proxy
#
#  Nginx REESCRIBE esta cabecera en cada petición (no la reenvía si el cliente
#  la manda), así que sólo puede llevar el valor bueno una petición que haya
#  pasado la autenticación de arriba. La API la compara en tiempo constante
#  contra DOCS_GATEWAY_TOKEN y, si no cuadra, responde 404.
#
#  La versión de la imagen manda el valor vacío: en desarrollo la API va en
#  modo `public` y no lo mira. El despliegue sustituye este fichero por uno con
#  el token real, igual que con el `.htpasswd`.
# =============================================================================
proxy_set_header X-Docs-Gateway "";
