# Guía de integración frontend–backend — HelpDesk Lite

Fecha: 4 de septiembre de 2026  
Rama frontend: `feat/frontend-foundation`

## Estado verificado

La interfaz, la navegación y los flujos locales del frontend están implementados. Los datos visibles proceden todavía de mocks tipados y se conservan únicamente en memoria; al recargar se reinician.

El backend no está por definir desde cero. El repositorio ya contiene:

- 105 rutas HTTP documentadas en [`apps/api/ENDPOINTS.md`](../api/ENDPOINTS.md);
- contratos compartidos en [`packages/contracts`](../../packages/contracts/src);
- autenticación, usuarios, organizaciones, tickets, relaciones sociales, mensajería, notificaciones, archivos, GDPR y administración;
- pruebas unitarias y de integración del API.

El frontend todavía no importa `packages/contracts`, no realiza peticiones HTTP y no abre la conexión Socket.IO. Por tanto, la **fase de UI/UX está completa**, pero la **integración frontend–backend está pendiente**.

### Fuentes de verdad

1. `packages/contracts/src`: tipos, enums y esquemas compartidos.
2. `apps/api/ENDPOINTS.md`: rutas, acceso, paginación y errores.
3. Routers y servicios de `apps/api/src`: comportamiento ejecutable.

Si la documentación contradice al código, prevalece el código y debe corregirse la documentación.

## Fronteras de arquitectura

1. **Presentación:** componentes de `packages/ui` y vistas de `apps/web`. No deben conocer tokens, cookies ni detalles de HTTP.
2. **Coordinación:** `App.tsx`, `app/WorkspacePage.tsx` y los coordinadores de cada feature. Gestionan navegación y estados de la UI.
3. **Acceso a datos:** debe existir una sola capa de adaptadores para consumir el API. No crear simultáneamente carpetas `api/` y `services/` con la misma función.
4. **Contratos:** reutilizar `packages/contracts`; no duplicar modelos del servidor dentro de las páginas.
5. **Routing:** la ruta, la vista activa y los filtros navegables permanecen en la URL. Las credenciales nunca deben guardarse en el hash ni en `localStorage`.

## Contrato HTTP existente

| Campo                    | Valor actual                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Base funcional           | `/api/v1`                                                                                                   |
| Access token             | `Authorization: Bearer <accessToken>`                                                                       |
| Refresh                  | Cookie `hd_refresh`, HttpOnly, `SameSite=Strict`, `Path=/api/v1/auth`                                       |
| Error                    | `ApiErrorBody`: `statusCode`, `code`, `messageKey`, `message`, `details?`, `requestId`, `timestamp`, `path` |
| Listas                   | `{ data, meta: { total, page, take, pages, ... } }`                                                         |
| Límite general de página | `take` máximo 100                                                                                           |
| API pública              | `X-API-Key`; no debe utilizarse para la sesión de la aplicación web                                         |

## Mapa de integración

Se utilizan fichas verticales de dos columnas para que el documento sea legible en GitHub, editores y pantallas estrechas.

### Autenticación y sesión

| Campo             | Detalle                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Operaciones       | Registro, login, refresh, logout, logout global, sesión actual, verificación, recuperación de contraseña y sesiones activas        |
| Rutas             | `/auth/*` bajo `/api/v1`                                                                                                           |
| Entrada           | Contratos de autenticación de `packages/contracts`; credenciales solo durante el envío                                             |
| Salida            | Usuario autenticado, membresías, permisos efectivos y tokens según el contrato del backend                                         |
| Acceso            | Público para alta/login/recuperación; sesión para identidad, logout y gestión de sesiones                                          |
| Estados UI        | `idle`, `submitting`, `success`, `error`, `expired`                                                                                |
| Errores clave     | `AUTH_INVALID_CREDENTIALS`, `AUTH_TOKEN_INVALID`, `AUTH_REFRESH_REUSED`, `AUTH_ACCOUNT_DISABLED`, `VALIDATION_FAILED`, `429` y red |
| Trabajo pendiente | Cliente HTTP, ciclo de refresh, restauración de sesión, guards reales y cierre de sesión                                           |
| Responsable       | Frontend + integración; backend valida y autoriza                                                                                  |

### Cuenta, perfil y administración de usuarios

| Campo             | Detalle                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| Operaciones       | Perfil propio, preferencias, avatar, perfil público y CRUD administrativo                               |
| Rutas             | `/users/me`, `/users/me/preferences`, `/users/me/avatar`, `/users/:username`, `/users` y `/users/:id/*` |
| Entrada           | Perfil, zona horaria IANA, archivo y filtros administrativos según contratos compartidos                |
| Salida            | Usuario o perfil actualizado, URL de avatar y página de usuarios                                        |
| Acceso            | Propietario para su cuenta; sesión para perfiles públicos; `GLOBAL_ADMIN` para administración           |
| Estados UI        | `loading`, `editing`, `submitting`, `uploading`, `success`, `empty`, `error`                            |
| Errores clave     | Validación, email duplicado, archivo inválido, `401`, `403`, `404`, `409`, `413` y `415`                |
| Trabajo pendiente | Reemplazar `accountData.ts` y `adminData.ts`, mapear capacidades y conectar upload real                 |
| Responsable       | Frontend + integración                                                                                  |

### Tickets, categorías y búsqueda

| Campo             | Detalle                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Operaciones       | Listar, crear, leer, editar, asignar, cambiar estado, eliminar, historial y comentarios                                      |
| Rutas             | `/tickets`, `/tickets/:id`, `/tickets/:id/status`, `/tickets/:id/assignee`, `/tickets/:id/comments` y `/tickets/:id/history` |
| Entrada           | Organización, texto, prioridad, categoría, responsable, estado, paginación y orden                                           |
| Salida            | Página de tickets, ticket actualizado, historial o comentario                                                                |
| Acceso            | Sesión y membresía; las mutaciones dependen de autor, `AGENT` u `ORG_ADMIN`                                                  |
| Estados UI        | `loading`, `success`, `empty`, `submitting`, `not-found`, `forbidden`, `conflict`, `error`                                   |
| Errores clave     | `TICKET_INVALID_TRANSITION`, `TICKET_ASSIGNEE_NOT_AGENT`, `403`, `404`, `409`, `422` y red                                   |
| Trabajo pendiente | Sustituir `ticketData.ts`, traducir filtros de URL al API y reconciliar mutaciones                                           |
| Responsable       | Frontend + integración; backend mantiene la máquina de estados                                                               |

### Organizaciones, miembros, roles y categorías

| Campo             | Detalle                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Operaciones       | Listar/crear/editar/eliminar organizaciones; miembros; categorías; estadísticas y API keys                   |
| Rutas             | `/organizations/*`                                                                                           |
| Entrada           | Organización, slug, miembro, rol o categoría según contratos compartidos                                     |
| Salida            | Organización, membresía, categoría, estadísticas o credencial creada                                         |
| Acceso            | Sesión, `MEMBER`, `AGENT`, `ORG_ADMIN` o propietario según operación                                         |
| Estados UI        | `loading`, `success`, `empty`, `submitting`, `forbidden`, `conflict`, `error`                                |
| Errores clave     | `ORG_SLUG_TAKEN`, `ORG_ALREADY_MEMBER`, `ORG_LAST_ADMIN`, `CATEGORY_NAME_TAKEN`, `404` y `409`               |
| Trabajo pendiente | Sustituir mocks de organización y confirmar cómo se mapean los roles configurables de la UI al contrato real |
| Responsable       | Frontend + integración; backend impone aislamiento organizativo                                              |

### Personas, conexiones, conversaciones y mensajes

| Campo             | Detalle                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Operaciones       | Buscar personas, solicitudes, amistades, conversaciones, mensajes, lecturas y notificaciones |
| Rutas             | `/users/search`, `/friends/*`, `/conversations/*` y `/notifications/*`                       |
| Entrada           | Usuario, solicitud, conversación, cuerpo de mensaje, filtros y paginación                    |
| Salida            | Perfil, estado de conexión, conversación, mensaje confirmado o notificación                  |
| Acceso            | Usuario autenticado; conversación solo para participantes                                    |
| Estados UI        | `loading`, `empty`, `submitting`, `sending`, `sent`, `failed`, `retry`, `error`              |
| Errores clave     | Solicitud duplicada, estado inválido, no participante, `401`, `403`, `404`, `409` y red      |
| Trabajo pendiente | Sustituir `peopleData.ts` y `messageData.ts`, cargar historial y conectar eventos Socket.IO  |
| Responsable       | Frontend + integración                                                                       |

### Archivos, avatar y GDPR

| Campo             | Detalle                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| Operaciones       | Avatar, adjuntos, miniaturas, exportación y eliminación de datos                                |
| Rutas             | `/users/me/avatar`, `/attachments/*`, `/tickets/:id/attachments` y `/gdpr/*`                    |
| Entrada           | `multipart/form-data`, confirmaciones y tokens de un solo uso                                   |
| Salida            | Avatar, adjunto, ZIP temporal o estado de solicitud GDPR                                        |
| Acceso            | Propietario o participante autorizado; backend vuelve a comprobar siempre el permiso            |
| Estados UI        | `preview`, `uploading`, `processing`, `requested`, `ready`, `expired`, `success`, `error`       |
| Errores clave     | `UPLOAD_REJECTED`, `FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED`, `FILE_TOO_MANY`, `GDPR_PENDING`   |
| Trabajo pendiente | Conectar avatar/GDPR y decidir con el equipo si adjuntos forman parte de la interfaz entregable |
| Responsable       | Frontend + integración + revisión legal                                                         |

### Administración global y búsqueda global

| Campo             | Detalle                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Operaciones       | Usuarios, estadísticas, auditoría y búsqueda de entidades accesibles                                                     |
| Rutas             | `/users`, `/users/:id/*`, `/admin/stats`, `/admin/audit-logs` y consultas de cada dominio                                |
| Entrada           | Filtros, usuario, capacidad, organización y texto de búsqueda                                                            |
| Salida            | Página de usuarios, estadísticas, auditoría o resultados tipados                                                         |
| Acceso            | `GLOBAL_ADMIN` para administración; búsqueda limitada por permisos de cada entidad                                       |
| Estados UI        | `loading`, `success`, `empty`, `submitting`, `forbidden`, `error`                                                        |
| Errores clave     | `RBAC_FORBIDDEN`, ownership, self-delete, `401`, `403`, `404`, `409` y red                                               |
| Trabajo pendiente | Conectar administración y decidir si la búsqueda global agrega peticiones existentes o requiere una operación específica |
| Responsable       | Frontend + integración; backend autoriza cada resultado                                                                  |

## Paginación, filtros y orden

La UI de tickets conserva en su URL:

- `q`;
- `category`;
- `status`;
- `priority`;
- `sort`;
- `page`.

El adaptador deberá traducirlos al contrato existente del backend:

- `category` visible → `categoryId`;
- valores visuales de estado/prioridad → enums de `packages/contracts`;
- `page` y tamaño de página → `page`/`take` o cursor cuando corresponda;
- responsable → `assignedToId` (`UUID`, `me` o `unassigned`);
- respuesta `{ data, meta }` → modelo de lista de la UI.

Los filtros siguen en la URL para conservar enlaces directos y atrás/adelante. La caché o librería de fetching se decidirá al implementar la integración.

## Avatar y adjuntos

El frontend valida PNG/JPEG y un máximo local de 2 MB antes del preview. El backend sigue siendo la autoridad del archivo.

- Avatar: `PUT /api/v1/users/me/avatar`, `multipart/form-data`, campo `file`.
- El backend reencoda el avatar a WebP 512×512 y elimina EXIF.
- Los adjuntos detectan el tipo por magic bytes y sus límites se consultan en `/attachments/limits`.
- La UI actual no incluye el flujo completo de adjuntos. Debe acordarse si se incorpora como funcionalidad visible.

## Mensajería y tiempo real

El historial y el envío ya disponen de rutas REST. El backend también implementa Socket.IO en el namespace `/rt`.

La integración deberá cubrir:

- carga inicial y paginación hacia atrás;
- confirmación del servidor y deduplicación;
- mensajes fallidos y reintento;
- reconexión y recuperación;
- lecturas y presencia;
- permisos por conversación.

`apps/web` no tiene actualmente cliente Socket.IO. Añadir `socket.io-client` requiere aprobación y actualización de dependencias antes de implementar tiempo real.

## Autenticación y seguridad

- El access token se envía como Bearer siguiendo el contrato del API.
- El refresh utiliza una cookie HttpOnly y no debe manipularse desde componentes.
- Las contraseñas no se registran ni se almacenan en estado persistente.
- Los errores internos del servidor no se muestran directamente.
- Ocultar un botón no concede seguridad: el backend autoriza cada lectura y mutación.
- Los controles administrativos deben derivarse de las capacidades devueltas por `/auth/me`, no de roles hardcodeados en las páginas.

## Errores y validación

El adaptador debe transformar `ApiErrorBody` en errores seguros para la UI:

| Tipo                | Tratamiento frontend                                                                 |
| ------------------- | ------------------------------------------------------------------------------------ |
| `VALIDATION_FAILED` | Asociar `details` a campos cuando sea posible y mantener un mensaje global accesible |
| `401`               | Intentar refresh una sola vez; si falla, cerrar la sesión local y volver a login     |
| `403`               | Mostrar falta de permiso sin fingir que el recurso no existe                         |
| `404`               | Presentar estado no encontrado o volver a una lista segura                           |
| `409` / `422`       | Mantener el formulario y explicar conflicto o regla de negocio                       |
| `429`               | Respetar `Retry-After` y desactivar temporalmente el reenvío                         |
| Red/timeout         | Mantener el contexto y ofrecer reintento cuando sea seguro                           |
| Inesperado          | Mensaje genérico y `requestId` para soporte; nunca stack trace                       |

La validación del frontend mejora la experiencia, pero el servidor debe repetir todas las comprobaciones de seguridad y negocio.

## Mocks existentes y sustitución

| Dominio        | Fuente actual                                 | Sustitución prevista                           |
| -------------- | --------------------------------------------- | ---------------------------------------------- |
| Cuenta         | `features/account/accountData.ts`             | `/auth/me`, `/users/me`, preferencias y avatar |
| Tickets        | `features/tickets/ticketData.ts`              | Queries y mutaciones de `/tickets/*`           |
| Personas       | `features/people/peopleData.ts`               | `/users/search`, perfiles y `/friends/*`       |
| Mensajes       | `features/messages/messageData.ts`            | `/conversations/*` y Socket.IO                 |
| Organización   | `features/organization/organizationData.ts`   | `/organizations/:organizationId/*`             |
| Organizaciones | `features/organizations/organizationsData.ts` | `/organizations`                               |
| Admin          | `features/admin/adminData.ts`                 | `/users` y `/admin/*`                          |

Proceso recomendado por dominio:

1. Importar y comprobar el contrato compartido correspondiente.
2. Implementar una operación real en una única capa de datos.
3. Sustituir el mock por `loading`, `success`, `empty` y `error` reales.
4. Conectar mutaciones con prevención de doble envío y errores de campo.
5. Probar permisos, organización, errores y navegación.
6. Retirar la etiqueta “Frontend preview · local data” solo cuando el dominio deje de depender del mock.

## Estado por ubicación

| Estado                         | Ubicación actual            | Ubicación futura          |
| ------------------------------ | --------------------------- | ------------------------- |
| Ruta y query                   | URL/hash                    | Se conserva               |
| Perfil, organización y tickets | `App` en memoria            | Servidor + caché de datos |
| Draft y validación             | Formulario                  | Se conserva local         |
| Menús y diálogos               | Componente                  | Se conserva local         |
| Filtros de tickets             | URL + feature               | URL + query remota        |
| Conversaciones                 | Feature Messages            | Servidor + transporte     |
| Capacidades admin              | `app/session.ts` de preview | `/auth/me`                |

## Checklist de publicación e integración

### Antes de integrar

- [ ] Confirmar que el API y sus dependencias levantan en el entorno compartido.
- [ ] Validar CORS, origen web, HTTPS y variables de entorno.
- [ ] Preparar usuarios de prueba para cada rol y organización.
- [ ] Confirmar que `packages/contracts` es la dependencia compartida autorizada para `apps/web`.
- [ ] Aprobar el cliente Socket.IO y el stack de pruebas frontend si se necesitan nuevas dependencias.

### Frontend

- [ ] Crear un único cliente HTTP y adaptadores por dominio.
- [ ] Conectar sesión, refresh y capacidades.
- [ ] Reemplazar mocks dominio por dominio.
- [ ] Implementar estados remotos y mapeo de `ApiErrorBody`.
- [ ] Conectar avatar, GDPR y mensajería.
- [ ] Decidir el alcance visible de adjuntos, notificaciones, sesiones y API keys.
- [ ] Añadir pruebas frontend y E2E.

### Integración y QA

- [ ] Probar `401`, `403`, `404`, `409`, `422`, `429`, red y errores inesperados.
- [ ] Probar permisos tanto en UI como contra el backend.
- [ ] Probar aislamiento entre organizaciones.
- [ ] Probar concurrencia y transiciones de tickets.
- [ ] Probar refresh, expiración y revocación de sesiones.
- [ ] Probar archivos válidos e inválidos.
- [ ] Probar reconexión y mensajes duplicados.
- [ ] Ejecutar QA responsive, teclado, lector de pantalla, zoom y consola.

## Decisiones pendientes del equipo

- Variable/base URL del API por entorno.
- Librería o cliente HTTP y estrategia de caché.
- Forma de mantener el access token únicamente en memoria.
- Momento de restauración y refresh de sesión.
- Correspondencia entre roles de UI y capacidades reales.
- Estrategia de actualización optimista y conflictos.
- Incorporación de `socket.io-client`.
- Alcance frontend de adjuntos, notificaciones, sesiones, API keys y auditoría.
- Stack de pruebas de componentes y navegador.
- Validación legal final de exportación, eliminación, privacidad y términos.
