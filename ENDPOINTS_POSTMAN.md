# Endpoints del backend — guía para Postman

Documentación generada a partir de los routers del backend (`apps/api/src/modules/**/**.router.ts`).

## 1. Configuración en Postman

Con Docker Compose, el backend queda publicado en el puerto `5000`:

```text
BASE_URL=http://localhost:5000
API_URL={{BASE_URL}}/api/v1
```

Si se ejecuta el backend directamente, el puerto por defecto es `3000`, salvo que se configure `PORT`.

### Autenticación por sesión

1. Ejecuta `POST {{API_URL}}/auth/register` o `POST {{API_URL}}/auth/login`.
2. Guarda el campo `accessToken` de la respuesta.
3. En las rutas protegidas añade:

# Si no quedo claro
Una forma menos complicada para probar en el postman seria :

POST http://localhost:5000/auth/register

  Pero debe ser:

  POST http://localhost:5000/api/v1/auth/register

  Configuración recomendada en Postman:

  BASE_URL = http://localhost:5000
  API_URL  = {{BASE_URL}}/api/v1

  Petición:

  POST {{API_URL}}/auth/register
  Content-Type: application/json


```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

El login/registro también devuelve una cookie HttpOnly `hd_refresh`, usada por `POST /auth/refresh`. En Postman se puede conservar automáticamente con el Cookie Manager. Si el entorno local usa HTTP y la cookie `Secure` no se guarda, copia manualmente el valor de `hd_refresh` en la petición de refresh:

```http
Cookie: hd_refresh=<refresh-token>
```

### Autenticación de API pública

Las rutas bajo `/public` no usan Bearer token. Requieren:

```http
X-API-Key: hdl_live_<prefix>.<secret>
```

La clave se crea con `POST /organizations/:organizationId/api-keys`; el secreto completo se devuelve una sola vez. Los scopes disponibles son:

```text
tickets:read, tickets:write, comments:read, comments:write,
categories:read, categories:write, stats:read
```

### Variables recomendadas

```text
BASE_URL     http://localhost:5000
API_URL      {{BASE_URL}}/api/v1
ACCESS_TOKEN token recibido en login/register
API_KEY      clave hdl_live_...
ORG_ID       UUID de organización
USER_ID      UUID de usuario
TICKET_ID    UUID de ticket
CATEGORY_ID  UUID de categoría
COMMENT_ID   UUID de comentario
```

Todas las rutas protegidas aplican rate limit. Las respuestas sin contenido normalmente son `204 No Content`. Los errores tienen un formato común con `statusCode`, `code`, `message`, `details`, `requestId` y `path`.

## 2. Health, versión y raíz

Estas rutas son públicas y no llevan `/api/v1`:

| Método | Ruta | Uso | Respuesta habitual |
|---|---|---|---|
| GET | `/` | Información básica de la API | 200 |
| GET | `/api/health` | Liveness; confirma que el proceso está vivo | 200 |
| GET | `/api/health/ready` | Readiness; comprueba DB, Redis, correo y almacenamiento | 200 |
| GET | `/api/health/status` | Estado público detallado de servicios | 200 |
| GET | `/api/version` | Versión, commit y versión de Node | 200 |

## 3. Autenticación — Bearer salvo indicación contraria

| Método | Ruta | Body |
|---|---|---|
| POST | `/auth/register` | `email`, `username`, `password`, `confirmPassword`, `firstName`, `lastName`, `acceptTerms: true`, `locale` opcional (`EN\|ES\|AR`) |
| POST | `/auth/login` | `email`, `password` |
| POST | `/auth/refresh` | Sin body; requiere cookie `hd_refresh` |
| POST | `/auth/logout` | Sin body; requiere Bearer y, si existe, cookie refresh |
| POST | `/auth/logout-all` | Sin body |
| GET | `/auth/me` | — |
| POST | `/auth/verify-email` | `token` |
| POST | `/auth/forgot-password` | `email` |
| POST | `/auth/reset-password` | `token`, `password`, `confirmPassword` |
| POST | `/auth/change-password` | `currentPassword`, `password`, `confirmPassword` |
| GET | `/auth/sessions` | — |
| DELETE | `/auth/sessions/:id` | — |

Contraseña: mínimo 10 caracteres, con minúscula, mayúscula, número y símbolo.

## 4. Usuarios

| Método | Ruta | Body / query / permisos |
|---|---|---|
| GET | `/users/search?q=texto` | Bearer; autocompletado |
| GET | `/users` | Bearer + `GLOBAL_ADMIN`; query: `page`, `take`, `cursor`, `q`, `globalRole`, `isActive`, `sort`, `order` |
| PATCH | `/users/me` | `firstName`, `lastName`, `displayName`, `bio`, `jobTitle` opcionales |
| PATCH | `/users/me/preferences` | `locale`, `timezone`, `theme` (`light\|dark\|system`) y flags `notifyOn...` opcionales |
| PUT | `/users/me/avatar` | `multipart/form-data`, campo de archivo `file`; máximo 5 MB |
| DELETE | `/users/me/avatar` | — |
| GET | `/users/avatars/:key` | Público; `key` debe ser un UUID terminado en `.webp` |
| GET | `/users/:username` | Bearer; perfil público |
| PATCH | `/users/:id` | Bearer + `GLOBAL_ADMIN`; `firstName`, `lastName`, `isActive` |
| PATCH | `/users/:id/status` | Bearer + `GLOBAL_ADMIN`; `{ "isActive": true }` |
| PATCH | `/users/:id/role` | Bearer + `GLOBAL_ADMIN`; `{ "globalRole": "USER" }` o `GLOBAL_ADMIN` |
| DELETE | `/users/:id` | Bearer + `GLOBAL_ADMIN`; borrado lógico |

## 5. Organizaciones, miembros y categorías

| Método | Ruta | Body / permisos |
|---|---|---|
| GET | `/organizations` | Bearer; organizaciones del usuario |
| POST | `/organizations` | `{ "name": "Soporte", "slug": "soporte", "description": "..." }` |
| GET | `/organizations/:organizationId` | Bearer + miembro de la organización |
| PATCH | `/organizations/:organizationId` | Bearer + `ORG_ADMIN`; `name`, `description` |
| DELETE | `/organizations/:organizationId` | Bearer + `ORG_ADMIN` |
| GET | `/organizations/:organizationId/members` | Bearer + miembro |
| POST | `/organizations/:organizationId/members` | Bearer + `ORG_ADMIN`; `{ "identifier": "usuario_o_email", "role": "MEMBER\|AGENT\|ORG_ADMIN" }` |
| PATCH | `/organizations/:organizationId/members/:userId` | Bearer + `ORG_ADMIN`; `{ "role": "MEMBER\|AGENT\|ORG_ADMIN" }` |
| DELETE | `/organizations/:organizationId/members/:userId` | Bearer + `ORG_ADMIN` |
| POST | `/organizations/:organizationId/leave` | Bearer + miembro |
| GET | `/organizations/:organizationId/categories` | Bearer + miembro |
| POST | `/organizations/:organizationId/categories` | Bearer + `ORG_ADMIN`; `name`, `description` opcional, `color` opcional `#RRGGBB` |
| PATCH | `/organizations/:organizationId/categories/:categoryId` | Bearer + `ORG_ADMIN`; campos de categoría y `isActive` |
| DELETE | `/organizations/:organizationId/categories/:categoryId` | Bearer + `ORG_ADMIN` |
| GET | `/organizations/:organizationId/stats` | Bearer + miembro |

### Gestión de API keys

Estas rutas usan Bearer y requieren ser `ORG_ADMIN` de la organización:

| Método | Ruta | Body |
|---|---|---|
| GET | `/organizations/:organizationId/api-keys` | — |
| POST | `/organizations/:organizationId/api-keys` | `{ "name": "Integración Postman", "scopes": ["tickets:read", "tickets:write"], "expiresInDays": 30 }` |
| DELETE | `/organizations/:organizationId/api-keys/:id` | —; revoca la clave |

## 6. Tickets

### Rutas de la aplicación — Bearer

| Método | Ruta | Body / query |
|---|---|---|
| GET | `/tickets` | Query de búsqueda: `page`, `take`, `cursor`, `q`, `organizationId`, `status`, `priority`, `categoryId`, `assignedToId`, `createdById`, `hasAttachments`, fechas `createdFrom/createdTo/updatedFrom/updatedTo`, `sort`, `order`. Los valores múltiples se separan por comas. |
| POST | `/tickets` | `organizationId`, `title`, `description`, `priority` (`LOW\|MEDIUM\|HIGH`), `categoryId` opcional |
| GET | `/tickets/:id` | — |
| PATCH | `/tickets/:id` | Uno o más: `title`, `description`, `priority`, `categoryId` (puede ser `null`) |
| PATCH | `/tickets/:id/status` | `status` (`OPEN\|IN_PROGRESS\|RESOLVED\|CLOSED`), `resolution` obligatorio al resolver (mín. 20), `note` opcional |
| PATCH | `/tickets/:id/assignee` | `{ "assigneeId": "UUID" }` o `{ "assigneeId": null }` |
| DELETE | `/tickets/:id` | — |
| GET | `/tickets/:id/history` | — |
| GET | `/tickets/:id/comments` | — |
| POST | `/tickets/:id/comments` | `{ "body": "Comentario", "isInternal": false }` |
| PATCH | `/tickets/:id/comments/:commentId` | `{ "body": "Comentario editado" }` |
| DELETE | `/tickets/:id/comments/:commentId` | — |

Transiciones permitidas: `OPEN → IN_PROGRESS/CLOSED`, `IN_PROGRESS → RESOLVED`, `RESOLVED → CLOSED/IN_PROGRESS`, `CLOSED → IN_PROGRESS`.

## 7. Amigos y conversaciones

Todas requieren Bearer.

| Método | Ruta | Body / query |
|---|---|---|
| GET | `/friends` | — |
| GET | `/friends/requests` | — |
| POST | `/friends/requests` | `{ "userId": "UUID" }` o `{ "username": "usuario" }` |
| PATCH | `/friends/requests/:id` | `{ "action": "ACCEPT" }` o `{ "action": "DECLINE" }` |
| DELETE | `/friends/:userId` | — |
| GET | `/conversations` | — |
| POST | `/conversations` | `{ "userId": "UUID" }` |
| GET | `/conversations/:id/messages?page=1&take=30` | `page` y `take` opcionales; `take` máximo 100 |
| POST | `/conversations/:id/messages` | `{ "body": "Mensaje" }` |
| PATCH | `/conversations/:id/read` | — |

## 8. Notificaciones

Todas requieren Bearer.

| Método | Ruta | Body / query |
|---|---|---|
| GET | `/notifications` | Query: `page`, `take`, `cursor`, `unread=true\|false`, `entity`, `action` |
| GET | `/notifications/unread-count` | — |
| PATCH | `/notifications/read-all` | — |
| PATCH | `/notifications/:id/read` | — |
| DELETE | `/notifications/:id` | — |

## 9. Archivos y adjuntos

Todas requieren Bearer. Para subir archivos usa `Body → form-data`, clave `file`, tipo `File`.

| Método | Ruta | Detalle |
|---|---|---|
| GET | `/attachments/limits` | Límites y MIME permitidos |
| POST | `/tickets/:ticketId/attachments` | `multipart/form-data`, archivo en `file` |
| POST | `/tickets/:ticketId/comments/:commentId/attachments` | `multipart/form-data`, archivo en `file` |
| GET | `/attachments/:id` | Descarga el archivo |
| GET | `/attachments/:id/thumbnail` | Devuelve thumbnail WebP si existe |
| DELETE | `/attachments/:id` | Elimina el adjunto |

Límite del middleware de subida: 12 MB; la configuración funcional por defecto es 10 MB por archivo y 5 adjuntos por ticket. MIME permitido: PNG, JPEG, WebP, GIF, PDF, ZIP, texto plano, Markdown, CSV y JSON.

## 10. GDPR / privacidad

Todas requieren Bearer.

| Método | Ruta | Body / detalle |
|---|---|---|
| GET | `/gdpr/requests` | Lista solicitudes del usuario |
| POST | `/gdpr/export` | Solicita exportación; devuelve token/enlace de confirmación |
| POST | `/gdpr/export/confirm` | `{ "token": "token_recibido" }` |
| GET | `/gdpr/export/:id/download` | Descarga una exportación completada |
| POST | `/gdpr/delete` | Solicita eliminación; devuelve token/enlace de confirmación |
| POST | `/gdpr/delete/confirm` | `{ "token": "token_recibido", "confirmUsername": "mi_usuario" }` |

## 11. API pública mediante API key

Prefijo completo: `{{API_URL}}/public`. Todas requieren `X-API-Key` y el scope indicado.

| Método | Ruta | Scope |
|---|---|---|
| GET | `/public/me` | Ninguno adicional |
| GET | `/public/tickets` | `tickets:read`; admite los filtros de búsqueda de tickets |
| GET | `/public/tickets/:id` | `tickets:read` |
| POST | `/public/tickets` | `tickets:write`; body de creación sin necesidad de `organizationId` (se toma de la key) |
| PUT | `/public/tickets/:id` | `tickets:write`; body de actualización |
| PATCH | `/public/tickets/:id` | `tickets:write`; body de actualización |
| DELETE | `/public/tickets/:id` | `tickets:write` |
| GET | `/public/tickets/:id/comments` | `comments:read` |
| POST | `/public/tickets/:id/comments` | `comments:write`; `body`, `isInternal` opcional |
| GET | `/public/categories` | `categories:read` |
| POST | `/public/categories` | `categories:write`; `name`, `description`, `color` |
| PUT | `/public/categories/:id` | `categories:write`; actualización de categoría |
| DELETE | `/public/categories/:id` | `categories:write` |
| GET | `/public/organizations/:id/stats` | `stats:read`; `:id` debe ser la organización asociada a la key |

Ejemplo de creación de ticket por API key:

```http
POST {{API_URL}}/public/tickets
X-API-Key: {{API_KEY}}
Content-Type: application/json

{
  "title": "No puedo acceder al panel",
  "description": "El usuario recibe un error al iniciar sesión.",
  "priority": "HIGH"
}
```

## 12. Administración global

Ambas requieren Bearer de un usuario con `globalRole: GLOBAL_ADMIN`.

| Método | Ruta | Query |
|---|---|---|
| GET | `/admin/audit-logs` | `page`, `take`, `cursor`, `entity`, `entityId`, `actorId`, `action`, `from`, `to` |
| GET | `/admin/stats` | — |

## 13. Ejemplos rápidos de requests

### Login

```http
POST {{API_URL}}/auth/login
Content-Type: application/json

{
  "email": "usuario@ejemplo.com",
  "password": "Password123!"
}
```

### Crear organización

```http
POST {{API_URL}}/organizations
Authorization: Bearer {{ACCESS_TOKEN}}
Content-Type: application/json

{
  "name": "Soporte técnico",
  "slug": "soporte-tecnico",
  "description": "Organización de soporte"
}
```

### Crear ticket

```http
POST {{API_URL}}/tickets
Authorization: Bearer {{ACCESS_TOKEN}}
Content-Type: application/json

{
  "organizationId": "{{ORG_ID}}",
  "title": "Error al iniciar sesión",
  "description": "El usuario no puede acceder después de introducir sus credenciales.",
  "priority": "MEDIUM"
}
```

### Buscar tickets

```http
GET {{API_URL}}/tickets?page=1&take=25&status=OPEN,IN_PROGRESS&sort=createdAt&order=desc
Authorization: Bearer {{ACCESS_TOKEN}}
```

## 14. Notas importantes

- Los parámetros `:id`, `:userId`, `:organizationId`, etc. son UUID reales de la base de datos; sustitúyelos por variables de Postman.
- Las rutas de organizaciones aplican aislamiento multi-tenant: pertenecer a otra organización suele responder `404` para no revelar su existencia.
- Para JSON, usa siempre `Content-Type: application/json`. Para avatares/adjuntos, usa `multipart/form-data` y deja que Postman genere el boundary.
- `POST /auth/forgot-password` puede devolver `202` aunque el correo no exista, para no revelar cuentas registradas.
- En desarrollo, Mailpit está disponible en `http://localhost:8025` para consultar correos de verificación, recuperación y confirmaciones GDPR.
- La ruta `/api/health/ready` puede indicar `degraded` si Redis, SMTP o almacenamiento no están disponibles; la base de datos es el servicio principal para considerar la API lista.
