# Referencia de endpoints — HelpDesk Lite API

**105 rutas HTTP.** Tabla generada a partir de los routers reales de
`apps/api/src/modules`, no escrita a mano. Si añades una ruta, añádela también
aquí y en la documentación de Notion (*Frontend && Backend → 8. Endpoints
funcionales*).

## Convenciones

| Concepto | Valor |
| --- | --- |
| Base funcional | `/api/v1` |
| Sondas (fuera del versionado) | `/`, `/api/health`, `/api/health/ready`, `/api/health/status`, `/api/version` |
| Sesión de usuario | `Authorization: Bearer <accessToken>` |
| API pública | `X-API-Key: hdl_live_<prefijo>.<secreto>` |
| Refresco | cookie `hd_refresh`, HttpOnly, `SameSite=Strict`, `Path=/api/v1/auth` |
| Errores | siempre `ApiErrorBody` (`statusCode`, `code`, `messageKey`, `message`, `details?`, `requestId`, `timestamp`, `path`) |
| Listas paginadas | `{ data, meta: { total, page, take, pages, ... } }`, `take` ≤ 100 |

**Columna «Acceso»**: `—` pública · `sesión` cualquier usuario autenticado ·
`MEMBER` / `AGENT` / `ORG_ADMIN` rol mínimo dentro de la organización ·
`GLOBAL_ADMIN` administrador de plataforma · `key:<scope>` clave de API con ese
alcance.

---

## Sondas y versión

| Método | Ruta | Acceso | Notas |
| --- | --- | --- | --- |
| GET | `/` | — | Información básica, para no dejar un 404 engañoso en los logs |
| GET | `/api/health` | — | Liveness. Responde de memoria y **no** se limita: lo consulta el `HEALTHCHECK` de Docker |
| GET | `/api/health/ready` | — | Readiness: PostgreSQL, Redis, SMTP y disco. Limitada (golpea dependencias reales) |
| GET | `/api/health/status` | — | Página de estado. Limitada por el mismo motivo |
| GET | `/api/version` | — | Versión, commit y versión de Node |

## Autenticación · `/api/v1/auth`

| Método | Ruta | Acceso | Notas |
| --- | --- | --- | --- |
| POST | `/auth/register` | — | Crea cuenta y sesión, envía verificación. Cubo estricto de rate limit |
| POST | `/auth/login` | — | Cubo estricto. Bloqueo progresivo tras fallos |
| POST | `/auth/refresh` | cookie | Rota el refresh y detecta reutilización |
| POST | `/auth/logout` | sesión | Revoca la fila de refresh **y** el access token actual |
| POST | `/auth/logout-all` | sesión | Revoca todas las sesiones y todos los access token vivos |
| GET | `/auth/me` | sesión | Usuario, membresías y permisos efectivos |
| POST | `/auth/verify-email` | — | `{ token }` |
| POST | `/auth/resend-verification` | sesión | **Nueva.** Reemite el correo de verificación; invalida el token anterior |
| POST | `/auth/forgot-password` | — | Responde 202 siempre, exista o no el correo |
| POST | `/auth/reset-password` | — | `{ token, password, confirmPassword }`. Cierra todas las sesiones |
| POST | `/auth/change-password` | sesión | Cierra todas las sesiones, incluida la que la pide |
| GET | `/auth/sessions` | sesión | Sesiones activas del propio usuario |
| DELETE | `/auth/sessions/:id` | sesión | Solo sobre sesiones propias |

## Usuarios · `/api/v1/users`

| Método | Ruta | Acceso | Notas |
| --- | --- | --- | --- |
| GET | `/users/search?q=` | sesión | Autocompletado, mínimo 2 caracteres |
| GET | `/users` | GLOBAL_ADMIN | `page`, `take`, `q`, `globalRole`, `isActive`, `sort`, `order` |
| PATCH | `/users/me` | sesión | `firstName`, `lastName`, `displayName`, `bio`, `jobTitle` |
| GET | `/users/me/preferences` | sesión | **Nueva.** Idioma, zona horaria, tema y los cinco interruptores `notifyOn*` |
| PATCH | `/users/me/preferences` | sesión | Devuelve el objeto completo, no solo la parte de `User` |
| PUT | `/users/me/avatar` | sesión | `multipart/form-data`, campo `file`. Reencodado a WebP 512×512 sin EXIF |
| DELETE | `/users/me/avatar` | sesión | |
| GET | `/users/avatars/:key` | — | Público por diseño; la clave se valida contra un patrón fijo |
| GET | `/users/:username` | sesión | Perfil público (sin correo de terceros) |
| PATCH | `/users/:id` | GLOBAL_ADMIN | |
| PATCH | `/users/:id/status` | GLOBAL_ADMIN | `{ isActive }`. Auditado |
| PATCH | `/users/:id/role` | GLOBAL_ADMIN | `{ globalRole }`. Auditado |
| DELETE | `/users/:id` | GLOBAL_ADMIN | Borrado lógico. Auditado |

## Organizaciones · `/api/v1/organizations`

| Método | Ruta | Acceso | Notas |
| --- | --- | --- | --- |
| GET | `/organizations` | sesión | Las del usuario |
| POST | `/organizations` | sesión | Crea con 4 categorías por defecto. Auditado |
| GET | `/organizations/:organizationId` | MEMBER | Un no miembro recibe **404**, nunca 403 |
| PATCH | `/organizations/:organizationId` | ORG_ADMIN | Auditado |
| DELETE | `/organizations/:organizationId` | ORG_ADMIN + propietario | Auditado |
| GET | `/organizations/:organizationId/members` | MEMBER | |
| POST | `/organizations/:organizationId/members` | ORG_ADMIN | `{ identifier, role }`. Auditado |
| PATCH | `/organizations/:organizationId/members/:userId` | ORG_ADMIN | Auditado |
| DELETE | `/organizations/:organizationId/members/:userId` | ORG_ADMIN | Auditado |
| POST | `/organizations/:organizationId/leave` | MEMBER | No permite dejarla sin administradores |
| GET | `/organizations/:organizationId/categories` | MEMBER | |
| POST | `/organizations/:organizationId/categories` | ORG_ADMIN | |
| PATCH | `/organizations/:organizationId/categories/:categoryId` | ORG_ADMIN | |
| DELETE | `/organizations/:organizationId/categories/:categoryId` | ORG_ADMIN | |
| GET | `/organizations/:organizationId/stats` | AGENT | |
| GET | `/organizations/:organizationId/api-keys` | ORG_ADMIN | Nunca devuelve el hash ni el secreto |
| POST | `/organizations/:organizationId/api-keys` | ORG_ADMIN | El secreto se entrega **una sola vez**. Auditado |
| DELETE | `/organizations/:organizationId/api-keys/:id` | ORG_ADMIN | Auditado |

## Tickets · `/api/v1/tickets`

| Método | Ruta | Acceso | Notas |
| --- | --- | --- | --- |
| GET | `/tickets` | sesión | Búsqueda avanzada. `organizationId` es un **filtro**, se interseca con tus membresías |
| POST | `/tickets` | MEMBER | |
| GET | `/tickets/:id` | MEMBER (autor) / AGENT | |
| PATCH | `/tickets/:id` | AGENT; el autor solo mientras siga `OPEN` | |
| PATCH | `/tickets/:id/status` | AGENT; el autor solo `RESOLVED → CLOSED` | Resolver exige ≥ 20 caracteres |
| PATCH | `/tickets/:id/assignee` | AGENT (a sí mismo) / ORG_ADMIN | 422 si el destinatario no es agente |
| DELETE | `/tickets/:id` | ORG_ADMIN | |
| GET | `/tickets/:id/history` | MEMBER (autor) / AGENT | Registro append-only |
| GET | `/tickets/:id/comments` | MEMBER (autor) / AGENT | Las notas internas solo para AGENT+ |
| POST | `/tickets/:id/comments` | MEMBER | `isInternal` requiere AGENT |
| PATCH | `/tickets/:id/comments/:commentId` | autor (ventana de edición) / ORG_ADMIN | |
| DELETE | `/tickets/:id/comments/:commentId` | autor / ORG_ADMIN | Borrado lógico |

Filtros de `GET /tickets`: `page`, `take`, `cursor`, `q`, `organizationId`,
`status` (CSV), `priority` (CSV), `categoryId`, `assignedToId` (`UUID`, `me`,
`unassigned`), `createdById` (`UUID`, `me`), `hasAttachments`, `createdFrom`,
`createdTo`, `updatedFrom`, `updatedTo`, `sort`, `order`.

Máquina de estados (las seis únicas transiciones legales):

```
OPEN ──▶ IN_PROGRESS ──▶ RESOLVED ──▶ CLOSED
 │                          │
 └────────▶ CLOSED          └────────▶ IN_PROGRESS
CLOSED ──▶ IN_PROGRESS
```

## Adjuntos · `/api/v1`

| Método | Ruta | Acceso | Notas |
| --- | --- | --- | --- |
| GET | `/attachments/limits` | sesión | Tamaño máximo, tope por ticket y MIME admitidos |
| GET | `/tickets/:ticketId/attachments` | MEMBER (autor) / AGENT | **Nueva.** Lista con `downloadUrl` y `thumbnailUrl` |
| POST | `/tickets/:ticketId/attachments` | MEMBER | `multipart/form-data`, campo `file` |
| POST | `/tickets/:ticketId/comments/:commentId/attachments` | MEMBER | |
| GET | `/attachments/:id` | MEMBER (autor) / AGENT | Descarga forzada, `no-store`, `nosniff` |
| GET | `/attachments/:id/thumbnail` | MEMBER (autor) / AGENT | WebP, solo imágenes |
| DELETE | `/attachments/:id` | AGENT / quien lo subió | Borrado lógico + `unlink`; libera cupo |

El tipo se decide por los **magic bytes**, nunca por la extensión ni por la
cabecera del cliente: un script renombrado a `.pdf` recibe un `415`.

## Amistades, chat y notificaciones · `/api/v1`

| Método | Ruta | Acceso | Notas |
| --- | --- | --- | --- |
| GET | `/friends` | sesión | |
| GET | `/friends/requests` | sesión | |
| POST | `/friends/requests` | sesión | `{ userId }` o `{ username }` |
| PATCH | `/friends/requests/:id` | destinatario | `{ action: ACCEPT \| DECLINE }` |
| DELETE | `/friends/:userId` | sesión | |
| GET | `/conversations` | sesión | |
| POST | `/conversations` | sesión | Idempotente: reabre la existente |
| GET | `/conversations/:id/messages` | participante | `page`, `take` (máx. 100) |
| POST | `/conversations/:id/messages` | participante | `{ body }`, máx. 2000 |
| PATCH | `/conversations/:id/read` | participante | Cuerpo opcional `{ messageId }`; devuelve `lastReadAt` |
| GET | `/notifications` | sesión | `unread`, `entity`, `action` |
| GET | `/notifications/unread-count` | sesión | `{ count }` |
| PATCH | `/notifications/read-all` | sesión | |
| PATCH | `/notifications/:id/read` | destinatario | |
| DELETE | `/notifications/:id` | destinatario | |

## GDPR · `/api/v1/gdpr`

| Método | Ruta | Acceso | Notas |
| --- | --- | --- | --- |
| GET | `/gdpr/requests` | sesión | |
| POST | `/gdpr/export` | sesión | Envía correo de confirmación |
| POST | `/gdpr/export/confirm` | sesión | `{ token }`. Auditado |
| GET | `/gdpr/export/:id/download` | sesión (propietario) | ZIP, enlace con caducidad |
| POST | `/gdpr/delete` | sesión | |
| POST | `/gdpr/delete/confirm` | sesión | `{ token, confirmUsername }`. Doble confirmación. Auditado |

## Administración de plataforma · `/api/v1/admin`

| Método | Ruta | Acceso | Notas |
| --- | --- | --- | --- |
| GET | `/admin/audit-logs` | GLOBAL_ADMIN | `entity`, `entityId`, `actorId`, `action`, `from`, `to` |
| GET | `/admin/stats` | GLOBAL_ADMIN | Contadores de plataforma |

Las acciones marcadas «Auditado» en las tablas anteriores escriben una fila en
`audit_logs` con quién, qué, cuándo y desde qué IP. Los `before`/`after` son
instantáneas de los campos afectados y **nunca** contienen hashes ni secretos.

## API pública · `/api/v1/public`

Autenticación por `X-API-Key`. Catorce endpoints, limitados a 60/min y 1000/h
por clave, encerrados en la organización de la clave. Llaman a los **mismos**
servicios de dominio que la web: el RBAC y la máquina de estados se aplican
igual.

| Método | Ruta | Scope |
| --- | --- | --- |
| GET | `/public/me` | — |
| GET | `/public/tickets` | `tickets:read` |
| GET | `/public/tickets/:id` | `tickets:read` |
| POST | `/public/tickets` | `tickets:write` |
| PUT | `/public/tickets/:id` | `tickets:write` |
| PATCH | `/public/tickets/:id` | `tickets:write` |
| DELETE | `/public/tickets/:id` | `tickets:write` |
| GET | `/public/tickets/:id/comments` | `comments:read` |
| POST | `/public/tickets/:id/comments` | `comments:write` |
| GET | `/public/categories` | `categories:read` |
| POST | `/public/categories` | `categories:write` |
| PUT | `/public/categories/:id` | `categories:write` |
| DELETE | `/public/categories/:id` | `categories:write` |
| GET | `/public/organizations/:id/stats` | `stats:read` |

---

## Códigos de error

| `code` | HTTP | Cuándo |
| --- | --- | --- |
| `VALIDATION_FAILED` | 400 | El cuerpo o la query no cumplen el contrato Zod. Incluye `details[]` |
| `MALFORMED_BODY` | 400 | JSON ilegible o petición interrumpida |
| `INVALID_IDENTIFIER` | 400 | Un identificador de ruta no es un UUID |
| `UPLOAD_REJECTED` | 400 | Multipart mal formado o campo de fichero equivocado |
| `AUTH_INVALID_CREDENTIALS` | 401 | Correo o contraseña incorrectos (no distingue cuál) |
| `AUTH_TOKEN_INVALID` | 401 | Token ausente, manipulado, caducado, revocado o de un solo uso ya gastado |
| `AUTH_REFRESH_REUSED` | 401 | Reutilización detectada: la familia entera queda revocada |
| `API_KEY_INVALID` | 401 | Clave ausente, mal formada, caducada o revocada |
| `AUTH_ACCOUNT_DISABLED` | 403 | Cuenta suspendida |
| `RBAC_FORBIDDEN` | 403 | El rol no permite la acción |
| `API_KEY_MISSING_SCOPE` | 403 | La clave no tiene el alcance necesario |
| `ROUTE_NOT_FOUND` | 404 | Ninguna ruta coincide |
| `ORG_NOT_A_MEMBER` | 404 | No eres miembro (deliberadamente 404, no 403) |
| `*_NOT_FOUND` | 404 | El recurso no existe o no es visible para ti |
| `TICKET_INVALID_TRANSITION` | 409 | Transición fuera de la máquina de estados |
| `UNIQUE_CONSTRAINT`, `ORG_SLUG_TAKEN`, `ORG_ALREADY_MEMBER`, `ORG_LAST_ADMIN`, `CATEGORY_NAME_TAKEN`, `FRIEND_EXISTS`, `FILE_TOO_MANY`, `GDPR_PENDING` | 409 | Conflictos de estado |
| `PAYLOAD_TOO_LARGE`, `FILE_TOO_LARGE` | 413 | Cuerpo > 1 MB o fichero por encima de `UPLOAD_MAX_BYTES` |
| `FILE_TYPE_NOT_ALLOWED` | 415 | Los magic bytes no están en la lista blanca |
| `TICKET_ASSIGNEE_NOT_AGENT` | 422 | El destinatario de la asignación no es agente |
| `RATE_LIMITED` | 429 | Ventana agotada. Lleva `Retry-After` |
| `INTERNAL_ERROR` | 500 | Fallo no previsto. Sin traza, sin SQL, sin rutas de fichero |

## Cabeceras

Toda respuesta lleva `X-Request-Id` (cítalo al reportar un fallo) y las
cabeceras de `helmet`. Las respuestas limitadas llevan además `RateLimit-Limit`,
`RateLimit-Remaining`, `RateLimit-Reset` y, al bloquear, `Retry-After`.

## Cómo se verifica esta tabla

```bash
docker compose up -d db redis mailpit backend

# Pruebas unitarias (núcleo puro, sin infraestructura)
npm test --workspace=apps/api

# Pruebas de integración HTTP contra la API levantada
RATE_LIMIT_AUTH_PER_MIN=100000 RATE_LIMIT_GLOBAL_PER_MIN=200000 \
  npm run test:integration --workspace=apps/api
```

El motivo de relajar los límites está explicado en la cabecera de
`test/integration/helpers.ts`.
