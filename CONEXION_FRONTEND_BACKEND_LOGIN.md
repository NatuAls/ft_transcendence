# Conexión del login con el backend

## Resultado

Se conectó la página `apps/web/src/LoginPage.tsx` con el endpoint existente:

```text
POST http://localhost:5000/api/v1/auth/login
```

No se modificó ningún archivo dentro de `apps/api`.

## Archivos modificados o añadidos

### `apps/web/src/api/auth.ts` — añadido

Este archivo centraliza la comunicación con el backend:

1. Define el cuerpo del login: `email` y `password`.
2. Define la respuesta esperada: `accessToken` y `user`.
3. Usa `VITE_API_URL` si existe; si no, utiliza `http://localhost:5000/api/v1`.
4. Ejecuta `POST /auth/login` con JSON.
5. Envía `credentials: 'include'` para permitir la cookie HttpOnly de refresh.
6. Guarda el access token en `localStorage` si se marca “Keep me signed in” y en
   `sessionStorage` si no se marca.

Todos los bloques añadidos están comentados dentro del archivo.

### `apps/web/src/LoginPage.tsx` — modificado

Se conservó la estructura y los estilos existentes. Solo se añadieron:

1. Estados React para email, contraseña, carga, error, éxito y persistencia.
2. `handleSubmit`, que llama a `login()` y guarda el token recibido.
3. `onChange` en los campos para leer los valores introducidos.
4. `required` para impedir envíos vacíos desde el navegador.
5. Mensajes de error y éxito.

Las adiciones están marcadas con comentarios `Añadido`.

## Cómo hacerlo manualmente, paso a paso

### Paso 1: confirmar el endpoint

En `apps/api/src/routing.ts`, el prefijo global es `/api/v1`.

En `apps/api/src/modules/auth/auth.router.ts`, el endpoint es `POST /login`.

Por tanto, la URL completa es:

```text
http://localhost:5000/api/v1/auth/login
```

El puerto `5000` está publicado por `docker-compose.yml`.

### Paso 2: crear el cliente del frontend

Crea `apps/web/src/api/auth.ts` y añade una función que:

1. Reciba `{ email, password }`.
2. Haga un `fetch` con método `POST`.
3. Añada `Content-Type: application/json`.
4. Añada `credentials: 'include'`.
5. Envíe `JSON.stringify({ email, password })`.
6. Compruebe `response.ok`.
7. Devuelva el JSON del backend.

### Paso 3: controlar el formulario

En `apps/web/src/LoginPage.tsx`:

1. Importa `useState` y la función `login`.
2. Crea estados para `email` y `password`.
3. Sustituye `defaultValue` por `value`.
4. Añade `onChange` a cada input.
5. Cambia el `onSubmit` para llamar a `event.preventDefault()` y después a
   `login({ email, password })`.
6. Mientras la petición está en curso, deshabilita o cambia el texto del botón.
7. En caso correcto, guarda `accessToken`.
8. En caso de error, muestra el mensaje recibido.

### Paso 4: usar el token en otros endpoints

Para una ruta protegida, recupera el token y envíalo así:

```ts
fetch('http://localhost:5000/api/v1/auth/me', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
  credentials: 'include',
});
```

El backend exige el formato `Bearer <accessToken>`.

### Paso 5: ejecutar y probar

Arranca el backend y la base de datos:

```bash
docker compose up backend db redis mailpit
```

En otra terminal arranca el frontend:

```bash
npm run dev:web
```

Abre `http://localhost:5173`, introduce un usuario existente y comprueba en la
pestaña Network del navegador que la petición es `POST /api/v1/auth/login` y
recibe estado `200`.

## Configuración opcional de la URL

Si el backend no está en `localhost:5000`, crea `apps/web/.env.local`:

```text
VITE_API_URL=http://localhost:3000/api/v1
```

Después reinicia Vite. Las variables de Vite deben comenzar por `VITE_`.

## Consideraciones importantes

- El backend devuelve la cookie `hd_refresh` con la marca `Secure`. En un entorno
  local HTTP algunos navegadores pueden no conservarla; el login sigue usando el
  `accessToken`, pero el refresh automático puede requerir HTTPS o una configuración
  específica de desarrollo.
- El frontend ya envía credenciales porque el backend habilita CORS con credenciales
  en desarrollo.
- No se implementaron registro, recuperación de contraseña ni redirección a un
  dashboard porque la solicitud se limitó a conectar la página de login.
