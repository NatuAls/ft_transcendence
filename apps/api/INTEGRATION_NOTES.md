# Integración del backend

La implementación añadida en esta carpeta procede de:

`/home/elerazo-/trascenda_felipe_comu/apps/api/`

Se conserva la estructura base del monorepo (`apps/api`, `apps/database` y
`packages/contracts`). La aplicación se organiza por módulos:

- `src/modules/auth`: registro, login, sesiones, tokens y contraseñas.
- `src/modules/users`: perfiles, preferencias, avatares y administración.
- `src/modules/organizations`: organizaciones, miembros y categorías.
- `src/modules/tickets`: tickets, comentarios, estados e historial.
- `src/modules/friendship`: amistades, conversaciones y mensajes.
- `src/modules/notifications`: notificaciones y lecturas.
- `src/modules/files`: adjuntos y miniaturas.
- `src/modules/gdpr`: exportación y eliminación de datos.
- `src/modules/realtime`: Socket.IO y eventos en tiempo real.
- `src/modules/public-api`: API keys y endpoints públicos.
- `src/common` y `src/rbac`: middleware, errores, paginación, rate limiting y
  permisos.

El esquema y las migraciones proceden de:

`/home/elerazo-/trascenda_felipe_comu/apps/api/prisma/`

Las extensiones PostgreSQL añadidas proceden de:

`/home/elerazo-/trascenda_felipe_comu/apps/database/conf/01-extensions.sql`

Los contratos compartidos proceden de:

`/home/elerazo-/trascenda_felipe_comu/packages/contracts/src/`

El `docker-compose.yml` y el `Makefile` del repositorio actual no se han
reemplazado durante esta integración.
