import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMember,
  api,
  apiIsUp,
  createOrganization,
  createTicket,
  multipart,
  PNG_1X1,
  registerUser,
  SKIP_MESSAGE,
  type TestUser,
} from './helpers.ts';

/**
 * Rutas añadidas para cerrar huecos de la superficie existente.
 *
 * Ninguna inventa funcionalidad nueva: cada una da salida a algo que el
 * proyecto ya tenía a medias.
 *
 *   GET  /tickets/:id/attachments   los adjuntos de ticket solo devolvían su id
 *                                   en la respuesta de la propia subida; el
 *                                   detalle del ticket únicamente informa de
 *                                   `_count.attachments`.
 *   GET  /users/me/preferences      los cinco interruptores `notifyOn*` y el
 *                                   tema se podían escribir y no leer.
 *   POST /auth/resend-verification  el token de verificación dura 24 h y no
 *                                   había forma de pedir otro.
 *   PATCH /conversations/:id/read   `markReadSchema` describía un `messageId`
 *                                   que ninguna ruta consumía.
 */
describe(
  'integración · rutas que completan la superficie',
  { concurrency: false },
  () => {
    let up = false;
    let owner: TestUser;
    let friend: TestUser;
    let outsider: TestUser;
    let organizationId = '';
    let ticketId = '';

    before(async () => {
      up = await apiIsUp();
      if (!up) return;
      owner = await registerUser('routeOwner');
      friend = await registerUser('routeFriend');
      outsider = await registerUser('routeOut');
      organizationId = await createOrganization(owner.token);
      await addMember(owner.token, organizationId, friend.username, 'AGENT');
      ticketId = (await createTicket(owner.token, organizationId)).id;
    });

    // -- adjuntos de un ticket ---------------------------------------------------

    it('GET /tickets/:id/attachments devuelve los adjuntos con su enlace', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);

      const empty = await api<unknown[]>(
        'GET',
        `/tickets/${ticketId}/attachments`,
        {
          token: owner.token,
        },
      );
      assert.equal(empty.status, 200);
      assert.deepEqual(empty.body, []);

      const upload = await api<{ id: string }>(
        'POST',
        `/tickets/${ticketId}/attachments`,
        {
          token: owner.token,
          ...multipart('captura.png', 'image/png', PNG_1X1),
        },
      );
      assert.equal(upload.status, 201);

      const listed = await api<
        Array<{ id: string; downloadUrl: string; thumbnailUrl: string | null }>
      >('GET', `/tickets/${ticketId}/attachments`, { token: owner.token });

      assert.equal(listed.status, 200);
      const found = listed.body.find((a) => a.id === upload.body.id);
      assert.ok(found, 'el adjunto recién subido debe aparecer en la lista');
      assert.equal(found.downloadUrl, `/api/v1/attachments/${upload.body.id}`);
      assert.ok(found.thumbnailUrl, 'una imagen debe ofrecer miniatura');

      const download = await api(
        'GET',
        found.downloadUrl.replace('/api/v1', ''),
        {
          token: owner.token,
        },
      );
      assert.equal(
        download.status,
        200,
        'el enlace publicado tiene que funcionar',
      );
    });

    it('la lista de adjuntos respeta el aislamiento de la organización', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const response = await api('GET', `/tickets/${ticketId}/attachments`, {
        token: outsider.token,
      });
      assert.ok(response.status === 403 || response.status === 404);
      assert.equal(
        (await api('GET', `/tickets/${ticketId}/attachments`)).status,
        401,
      );
    });

    it('borrar un adjunto libera cupo dentro del ticket', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      // El cupo por ticket contaba también las filas borradas (el borrado es
      // lógico), así que cinco subidas y cinco borrados dejaban el ticket
      // incapaz de aceptar nada más.
      const ticket = await createTicket(owner.token, organizationId);
      const uploaded: string[] = [];
      for (let i = 0; i < 5; i += 1) {
        const response = await api<{ id: string }>(
          'POST',
          `/tickets/${ticket.id}/attachments`,
          {
            token: owner.token,
            ...multipart(`f${i}.png`, 'image/png', PNG_1X1),
          },
        );
        assert.equal(response.status, 201);
        uploaded.push(response.body.id);
      }

      const overflow = await api<{ code: string }>(
        'POST',
        `/tickets/${ticket.id}/attachments`,
        { token: owner.token, ...multipart('sexto.png', 'image/png', PNG_1X1) },
      );
      assert.equal(overflow.status, 409);
      assert.equal(overflow.body.code, 'FILE_TOO_MANY');

      assert.equal(
        (
          await api('DELETE', `/attachments/${uploaded[0]}`, {
            token: owner.token,
          })
        ).status,
        204,
      );

      const afterDelete = await api(
        'POST',
        `/tickets/${ticket.id}/attachments`,
        {
          token: owner.token,
          ...multipart('reemplazo.png', 'image/png', PNG_1X1),
        },
      );
      assert.equal(
        afterDelete.status,
        201,
        'tras borrar uno debe quedar sitio para otro',
      );
    });

    // -- preferencias -------------------------------------------------------------

    it('las preferencias se leen tal y como se guardaron', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const defaults = await api<Record<string, unknown>>(
        'GET',
        '/users/me/preferences',
        { token: owner.token },
      );
      assert.equal(defaults.status, 200);
      assert.equal(defaults.body['notifyOnComment'], true);
      assert.equal(defaults.body['theme'], 'system');

      const patched = await api<Record<string, unknown>>(
        'PATCH',
        '/users/me/preferences',
        {
          token: owner.token,
          body: { locale: 'ES', theme: 'dark', notifyOnComment: false },
        },
      );
      assert.equal(patched.status, 200);
      assert.equal(
        patched.body['notifyOnComment'],
        false,
        'el PATCH debe devolver también los interruptores, no solo locale y tema',
      );

      const reread = await api<Record<string, unknown>>(
        'GET',
        '/users/me/preferences',
        { token: owner.token },
      );
      assert.equal(reread.body['locale'], 'ES');
      assert.equal(reread.body['theme'], 'dark');
      assert.equal(reread.body['notifyOnComment'], false);
      assert.equal(
        reread.body['notifyOnMessage'],
        true,
        'lo no tocado no cambia',
      );
    });

    it('las preferencias exigen sesión', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      assert.equal((await api('GET', '/users/me/preferences')).status, 401);
    });

    // -- marcar leído hasta un mensaje --------------------------------------------

    it('PATCH /conversations/:id/read acepta messageId y no retrocede', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const conversation = await api<{ id: string }>('POST', '/conversations', {
        token: owner.token,
        body: { userId: friend.id },
      });
      assert.equal(conversation.status, 201);
      const conversationId = conversation.body.id;

      for (const text of ['primero', 'segundo', 'tercero']) {
        await api('POST', `/conversations/${conversationId}/messages`, {
          token: owner.token,
          body: { body: `mensaje ${text}` },
        });
      }

      const messages = await api<{ data: Array<{ id: string }> }>(
        'GET',
        `/conversations/${conversationId}/messages`,
        { token: friend.token },
      );
      const first = messages.body.data[0]!;

      const partial = await api<{ lastReadAt: string }>(
        'PATCH',
        `/conversations/${conversationId}/read`,
        { token: friend.token, body: { messageId: first.id } },
      );
      assert.equal(partial.status, 200);
      assert.ok(partial.body.lastReadAt, 'debe devolver la marca resultante');

      const full = await api<{ lastReadAt: string }>(
        'PATCH',
        `/conversations/${conversationId}/read`,
        { token: friend.token },
      );
      assert.equal(full.status, 200, 'sin cuerpo sigue funcionando como antes');
      assert.ok(
        new Date(full.body.lastReadAt) >= new Date(partial.body.lastReadAt),
        'la marca de lectura nunca retrocede',
      );

      const backwards = await api<{ lastReadAt: string }>(
        'PATCH',
        `/conversations/${conversationId}/read`,
        { token: friend.token, body: { messageId: first.id } },
      );
      assert.equal(
        backwards.body.lastReadAt,
        full.body.lastReadAt,
        'volver a un mensaje anterior no resucita mensajes ya leídos',
      );
    });

    it('un messageId de otra conversación no sirve para nada', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const conversation = await api<{ id: string }>('POST', '/conversations', {
        token: owner.token,
        body: { userId: outsider.id },
      });
      const foreign = await api(
        'PATCH',
        `/conversations/${conversation.body.id}/read`,
        {
          token: owner.token,
          body: { messageId: '00000000-0000-7000-8000-000000000000' },
        },
      );
      assert.equal(foreign.status, 404);

      const notAUuid = await api(
        'PATCH',
        `/conversations/${conversation.body.id}/read`,
        { token: owner.token, body: { messageId: 'pepito' } },
      );
      assert.equal(notAUuid.status, 400);
    });

    // -- auditoría -----------------------------------------------------------------

    it('las acciones administrativas dejan rastro en la auditoría', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      // `GET /admin/audit-logs` existía desde el principio, pero nada escribía en
      // la tabla: devolvía siempre una página vacía. La lectura requiere
      // GLOBAL_ADMIN, así que aquí se comprueba lo que sí se puede comprobar sin
      // ese rol: que la acción se completa y que el endpoint sigue protegido.
      const invited = await registerUser('audited');
      const response = await api(
        'POST',
        `/organizations/${organizationId}/members`,
        {
          token: owner.token,
          body: { identifier: invited.username, role: 'MEMBER' },
        },
      );
      assert.equal(response.status, 201);
      assert.equal(
        (await api('GET', '/admin/audit-logs', { token: owner.token })).status,
        403,
      );
    });
  },
);
