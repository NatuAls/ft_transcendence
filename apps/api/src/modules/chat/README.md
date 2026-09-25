# Chat realtime

El chat usa la infraestructura Socket.IO existente del API:

- namespace: `/rt`
- path: `/socket.io`
- autenticación: `auth.token` con el access token JWT
- sala privada: `conv:{conversationId}`

## Cliente

1. Conectar a `/rt` con `socket.io-client` y el token.
2. Esperar `connected`.
3. Emitir `conversation.subscribe` con `{ conversationId }`.
4. Escuchar `message.created`.
5. Enviar mensajes mediante `POST /api/v1/conversations/:id/messages`.
6. Emitir `conversation.unsubscribe` al cambiar de conversación o desmontar.

El servidor comprueba que el usuario sea miembro antes de permitir la entrada
en una sala. La creación y lectura de mensajes sigue usando el servicio y las
rutas HTTP existentes, que validan, persisten y publican los eventos después
de confirmar la transacción de base de datos.

No debería aparecer ningún error de importación ni de Socket.IO.

  3. Abre dos sesiones del navegador:

  - Ventana normal: usuario A.
  - Ventana incógnito: usuario B.

  Ambos usuarios deben existir y tener una conversación creada.

  4. En el navegador:

  - Entra en Messages.
  - Abre la misma conversación en ambas sesiones.
  - Envía un mensaje desde el usuario A.
  - Debe aparecer en el usuario B sin recargar la página.
  - Responde desde B.
  - Debe aparecer inmediatamente en A.
  - Cambia de conversación y vuelve a entrar: los mensajes deben seguir guardados.
  - Recarga una pestaña: la conexión debe recuperarse y los mensajes deben seguir visibles.

  5. Comprueba la conexión Socket.IO:

  En DevTools del navegador:

  - Abre F12.
  - Ve a Network.
  - Filtra por socket.io.
  - Debe existir una conexión WebSocket o polling hacia:

  /socket.io

  En la consola no deberían aparecer:

  unauthorized
  conversation.subscribe failed
  message.created failed

  6. Comprueba que los mensajes persisten:

  En DevTools → Network verifica:

  GET /api/v1/conversations
  GET /api/v1/conversations/:id/messages
  POST /api/v1/conversations/:id/messages
  PATCH /api/v1/conversations/:id/read

  Los GET deberían responder 200, el POST 201 y el PATCH 200.

  7. Prueba seguridad:

  - Intenta abrir una conversación que no pertenece al usuario.
  - El servidor no debe permitir la suscripción a esa sala.
  - El mensaje no debe aparecer en conversaciones ajenas.
