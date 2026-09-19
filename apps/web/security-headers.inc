# Cabeceras de seguridad del contenedor `web`.
#
# Van en un include porque Nginx NO hereda `add_header` del bloque `server` en
# ningún `location` que declare su propio `add_header` (por ejemplo el
# Cache-Control de index.html y de /assets/). Con las cabeceras sólo en
# `server`, el HTML de la aplicación —justo la respuesta que más las necesita—
# salía sin CSP ni X-Frame-Options (verificado en producción el 17/09/2026).
# Se incluye en `server` Y en cada `location` que añade cabeceras propias.
#
# `always` es imprescindible: sin él, Nginx omite estas cabeceras en las
# respuestas de error (4xx/5xx), que son justo donde más falta hacen.
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Resource-Policy "same-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" always;

# Content-Security-Policy.
#
# `style-src 'unsafe-inline'` es una concesión consciente: React inyecta
# estilos en línea y quitarlo exigiría nonces por respuesta, que con una SPA
# servida como fichero estático no es trivial. NO se concede 'unsafe-inline' a
# script-src, que es donde de verdad importa.
#
# connect-src incluye wss: para Socket.IO ('self' no cubre el esquema wss).
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests" always;
