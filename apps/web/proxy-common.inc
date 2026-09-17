# Cabeceras comunes de todas las rutas que hacen de proxy hacia la API.
# Se extrae a un fichero para que no se dupliquen (y no se desincronicen) en
# los cuatro bloques `location` que las necesitan.
proxy_http_version 1.1;
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
# El esquema REAL con el que llegó la petición al borde. La API lo usa para
# construir los enlaces de los correos de verificación: si se fija a "https"
# a mano, en desarrollo se generan enlaces rotos.
proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
proxy_set_header X-Forwarded-Host  $host;
# Correlación extremo a extremo: si el borde ya asignó un id, se respeta.
proxy_set_header X-Request-Id      $http_x_request_id;

# Que la API no reciba la cabecera de conexión del cliente tal cual.
proxy_set_header Connection "";

# La API (helmet) pone sus propias cabeceras de documento. Nginx ya las añade
# a TODAS las respuestas (security-headers.inc), así que se ocultan las del
# upstream para no servirlas dos veces con valores distintos (helmet manda
# X-Frame-Options: SAMEORIGIN y Nginx DENY; Referrer-Policy también difiere).
# Si la API se consulta sin pasar por este proxy, helmet sigue protegiéndola.
# HSTS NO se oculta: la pone helmet y aquí no hay TLS con el que justificarla.
proxy_hide_header X-Frame-Options;
proxy_hide_header Referrer-Policy;
proxy_hide_header Cross-Origin-Opener-Policy;
proxy_hide_header Cross-Origin-Resource-Policy;
proxy_hide_header X-Content-Type-Options;
