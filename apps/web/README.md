# HelpDesk Lite — front end (`apps/web`)

Aplicación React 19 + TypeScript servida por Vite en desarrollo y por nginx
(imagen `apps/web/Dockerfile.prod`) en staging y producción. Habla con la API
por `/api/v1` (mismo origen en producción; en desarrollo Vite lo reenvía a
`VITE_PROXY_TARGET`, por defecto `http://localhost:5000`).

## Arrancar

```bash
npm install                      # desde la raíz del monorepo (workspaces)
npm run dev:web                  # http://localhost:5173  (o: npm run dev --workspace=apps/web)
```

Con `make up-dev` la web también corre en contenedor. Variables: `VITE_API_URL`
(opcional; por defecto `/api/v1`) y `VITE_PROXY_TARGET` (sólo desarrollo).

## Comprobaciones (las mismas que el CI)

```bash
npm run lint --workspace=apps/web
npm run typecheck --workspace=apps/web
npm run build --workspace=apps/web
```

## Estructura

| Ruta | Qué hay |
|---|---|
| `src/app/` | arranque, rutas (`routes.ts`), sesión (`session.ts`), error boundary, 404, página de trabajo |
| `src/features/<área>/` | una carpeta por área funcional: `auth`, `organizations`, `organization`, `tickets`, `messages`, `people`, `account`, `admin`, `legal` (cada una con sus vistas, su `*Data.ts` de acceso a la API y su CSS) |
| `src/layout/` | armazón de la aplicación (`AppShell`), menú de perfil, búsqueda global |
| `src/api/` | cliente HTTP y autenticación (access token en memoria, refresh por cookie `HttpOnly`) |
| `src/styles/` | estilos globales |
| `../../packages/ui` | componentes compartidos (botones, campos, diálogos, avatares…) |
| `../../packages/contracts` | esquemas Zod compartidos con la API: la validación del formulario es la misma que la del servidor |

## Producción

`Dockerfile.prod` construye los estáticos y los sirve con `nginx.conf`
(cabeceras de seguridad en `security-headers.inc`, reenvío de `/api` y
Socket.IO a la API en `proxy-common.inc`, límites de peticiones en las rutas de
credenciales). No hay que tocar nada para desplegar: lo hace el pipeline.

Más detalle de la integración con la API: [`INTEGRATION.md`](INTEGRATION.md).
Referencia de endpoints: [`../api/ENDPOINTS.md`](../api/ENDPOINTS.md).
