import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  api,
  apiIsUp,
  multipart,
  PNG_1X1,
  registerUser,
  SKIP_MESSAGE,
  unique,
  V1,
  type ApiResponse,
  type RequestOptions,
  type TestUser,
} from './helpers.ts';
import {
  closeDb,
  dbAvailable,
  DB_SKIP_MESSAGE,
  promoteToGlobalAdmin,
  verifyEmailOf,
} from './db.ts';
import { validate, type Schema } from '../support/openapi-schema.ts';

/**
 * La documentación, contrastada con la API de verdad.
 *
 * `test/unit/openapi.test.ts` comprueba que cada ruta está documentada; lo que
 * no puede comprobar es que lo documentado sea lo que la API RESPONDE. Aquí
 * cada llamada se valida contra el esquema publicado en /openapi.json, en
 * modo estricto: un campo que la API devuelve y el documento no menciona, un
 * null no declarado, un tipo distinto o un código de estado no documentado
 * hacen fallar la prueba. Así se descubrieron 27 discrepancias que el
 * documento arrastraba; esto impide que vuelvan.
 *
 * Cubre los endpoints que usan las pantallas de usuarios, roles por correo,
 * organizaciones, amistades, sesiones y avatar.
 */

type Loose = Record<string, unknown>;

describe(
  'integración · la API responde lo que documenta',
  { concurrency: false },
  () => {
    let ready = false;
    let doc: Loose;
    let admin: TestUser;
    let person: TestUser;

    before(async () => {
      ready = (await apiIsUp()) && dbAvailable();
      if (!ready) return;
      const response = await fetch(`${V1}/openapi.json`);
      assert.equal(response.status, 200, 'el documento se sirve');
      doc = (await response.json()) as Loose;

      admin = await registerUser('ocAdmin');
      await promoteToGlobalAdmin(admin.id);
      await verifyEmailOf(admin.id);
      person = await registerUser('ocPerson');
      await verifyEmailOf(person.id);
    });

    after(closeDb);

    const skip = (t: { skip: (message: string) => void }) =>
      t.skip(dbAvailable() ? SKIP_MESSAGE : DB_SKIP_MESSAGE);

    /**
     * Llama a la API, exige el estado esperado y valida el cuerpo contra la
     * respuesta que el documento declara para ESE estado.
     */
    async function conforms<T = unknown>(
      expected: number,
      method: string,
      template: string,
      path: string,
      options: RequestOptions = {},
    ): Promise<ApiResponse<T>> {
      const response = await api<T>(method, path, options);
      const where = `${method} ${template}`;
      assert.equal(
        response.status,
        expected,
        `${where} respondió ${response.status}: ${response.text.slice(0, 300)}`,
      );
      const paths = doc['paths'] as Record<string, Record<string, Loose>>;
      const operation = paths[template]?.[method.toLowerCase()];
      assert.ok(operation, `${where} no está documentada`);
      let documented = (operation['responses'] as Record<string, Loose>)[
        String(response.status)
      ];
      assert.ok(
        documented,
        `${where} responde ${response.status} y el documento no lo recoge`,
      );
      const reference = documented['$ref'];
      if (typeof reference === 'string')
        documented = ((
          doc['components'] as Record<string, Record<string, Loose>>
        )['responses'] ?? {})[reference.split('/').pop()!]!;
      const schema = (
        documented['content'] as Record<string, Loose> | undefined
      )?.['application/json']?.['schema'] as Schema | undefined;
      if (schema) {
        const problems = validate(doc, schema, response.body);
        assert.deepEqual(
          problems,
          [],
          `${where} ${response.status} no coincide con el documento:\n` +
            problems.join('\n'),
        );
      } else {
        assert.equal(
          response.text,
          '',
          `${where}: un ${expected} va sin cuerpo`,
        );
      }
      return response;
    }

    it('administración de usuarios', async (t) => {
      if (!ready) return skip(t);
      const token = admin.token;
      await conforms(
        200,
        'GET',
        '/users',
        '/users?globalRole=USER&sort=username&order=asc&take=5',
        { token },
      );
      await conforms(
        200,
        'GET',
        '/users',
        `/users?q=${person.username}&isActive=true`,
        { token },
      );
      await conforms(400, 'GET', '/users', '/users?sort=passwordHash', {
        token,
      });
      await conforms(403, 'GET', '/users', '/users', { token: person.token });
      await conforms(401, 'GET', '/users', '/users');

      await conforms(200, 'PATCH', '/users/{user}', `/users/${person.id}`, {
        token,
        body: { firstName: 'Renamed', isActive: false },
      });
      await conforms(
        200,
        'PATCH',
        '/users/{user}/status',
        `/users/${person.id}/status`,
        {
          token,
          body: { isActive: true },
        },
      );
      await conforms(
        200,
        'PATCH',
        '/users/{user}/role',
        `/users/${person.id}/role`,
        {
          token,
          body: { globalRole: 'USER' },
        },
      );
      await conforms(
        403,
        'PATCH',
        '/users/{user}/role',
        `/users/${admin.id}/role`,
        {
          token,
          body: { globalRole: 'USER' },
        },
      );
      await conforms(
        403,
        'PATCH',
        '/users/{user}/status',
        `/users/${admin.id}/status`,
        {
          token,
          body: { isActive: false },
        },
      );
      await conforms(
        400,
        'PATCH',
        '/users/{user}/role',
        `/users/${person.id}/role`,
        {
          token,
          body: { globalRole: 'ROOT' },
        },
      );
      await conforms(200, 'GET', '/admin/stats', '/admin/stats', { token });
    });

    it('perfil, cuenta y sesiones', async (t) => {
      if (!ready) return skip(t);
      await conforms(200, 'GET', '/users/{user}', `/users/${person.username}`, {
        token: admin.token,
      });
      await conforms(404, 'GET', '/users/{user}', `/users/${unique('ghost')}`, {
        token: admin.token,
      });
      await conforms(200, 'PATCH', '/users/me', '/users/me', {
        token: person.token,
        body: { jobTitle: 'Support lead' },
      });
      await conforms(200, 'GET', '/auth/me', '/auth/me', {
        token: person.token,
      });
      await conforms(401, 'GET', '/auth/me', '/auth/me');
      await conforms(200, 'GET', '/auth/sessions', '/auth/sessions', {
        token: person.token,
        cookie: person.refreshCookie,
      });
      await conforms(
        404,
        'DELETE',
        '/auth/sessions/{id}',
        `/auth/sessions/${admin.id}`,
        {
          token: person.token,
        },
      );
      await conforms(
        202,
        'POST',
        '/auth/resend-verification',
        '/auth/resend-verification',
        {
          token: person.token,
        },
      );
      await conforms(
        401,
        'POST',
        '/auth/resend-verification',
        '/auth/resend-verification',
      );
      await conforms(401, 'POST', '/auth/verify-email', '/auth/verify-email', {
        body: { token: 'x'.repeat(43) },
      });
    });

    it('avatar: subida, imagen dañada, tipo prohibido y retirada', async (t) => {
      if (!ready) return skip(t);
      const send = (filename: string, type: string, content: Buffer) => {
        const form = multipart(filename, type, content);
        return { token: person.token, headers: form.headers, raw: form.raw };
      };
      await conforms(
        200,
        'PUT',
        '/users/me/avatar',
        '/users/me/avatar',
        send('me.png', 'image/png', PNG_1X1),
      );
      await conforms(
        422,
        'PUT',
        '/users/me/avatar',
        '/users/me/avatar',
        send(
          'broken.png',
          'image/png',
          Buffer.concat([PNG_1X1.subarray(0, 40), Buffer.alloc(40)]),
        ),
      );
      await conforms(
        415,
        'PUT',
        '/users/me/avatar',
        '/users/me/avatar',
        send('me.png', 'image/png', Buffer.from('#!/bin/sh\necho hi\n')),
      );
      await conforms(200, 'DELETE', '/users/me/avatar', '/users/me/avatar', {
        token: person.token,
      });
    });

    it('roles de plataforma por correo', async (t) => {
      if (!ready) return skip(t);
      const token = admin.token;
      const email = `${unique('ocReserve')}@integration.local`.toLowerCase();
      await conforms(200, 'GET', '/admin/role-grants', '/admin/role-grants', {
        token,
      });
      const reserved = await conforms<{ reservation: { id: string } }>(
        201,
        'POST',
        '/admin/role-grants',
        '/admin/role-grants',
        { token, body: { email, globalRole: 'GLOBAL_ADMIN' } },
      );
      await conforms(200, 'GET', '/admin/role-grants', '/admin/role-grants', {
        token,
      });
      await conforms(200, 'POST', '/admin/role-grants', '/admin/role-grants', {
        token,
        body: { email: person.email, globalRole: 'GLOBAL_ADMIN' },
      });
      await conforms(200, 'POST', '/admin/role-grants', '/admin/role-grants', {
        token,
        body: { email: person.email, globalRole: 'GLOBAL_ADMIN' },
      });
      await conforms(
        200,
        'PATCH',
        '/users/{user}/role',
        `/users/${person.id}/role`,
        {
          token,
          body: { globalRole: 'USER' },
        },
      );
      await conforms(400, 'POST', '/admin/role-grants', '/admin/role-grants', {
        token,
        body: { email: 'nope', globalRole: 'USER' },
      });
      await conforms(403, 'POST', '/admin/role-grants', '/admin/role-grants', {
        token: person.token,
        body: { email, globalRole: 'GLOBAL_ADMIN' },
      });
      const grant = `/admin/role-grants/${reserved.body.reservation.id}`;
      await conforms(204, 'DELETE', '/admin/role-grants/{grantId}', grant, {
        token,
      });
      await conforms(404, 'DELETE', '/admin/role-grants/{grantId}', grant, {
        token,
      });
      await conforms(
        200,
        'GET',
        '/admin/audit-logs',
        '/admin/audit-logs?action=role.reserved&take=5',
        { token },
      );
      await conforms(
        200,
        'GET',
        '/admin/audit-logs',
        `/admin/audit-logs?entityId=${person.id}&from=2026-01-01`,
        { token },
      );
    });

    it('organización: roles por correo, miembros y estadísticas', async (t) => {
      if (!ready) return skip(t);
      const owner = await registerUser('ocOwner');
      const created = await conforms<{ id: string }>(
        201,
        'POST',
        '/organizations',
        '/organizations',
        {
          token: owner.token,
          body: { name: `Org ${unique('oc')}` },
        },
      );
      const base = `/organizations/${created.body.id}`;
      const token = owner.token;
      await conforms(200, 'GET', '/organizations', '/organizations', { token });
      await conforms(200, 'GET', '/organizations/{organizationId}', base, {
        token,
      });
      // A GLOBAL_ADMIN who is not a member sees it, with myRole null.
      await conforms(200, 'GET', '/organizations/{organizationId}', base, {
        token: admin.token,
      });

      const grants = '/organizations/{organizationId}/role-grants';
      await conforms(200, 'POST', grants, `${base}/role-grants`, {
        token,
        body: { email: person.email, role: 'MEMBER' },
      });
      await conforms(200, 'POST', grants, `${base}/role-grants`, {
        token,
        body: { email: person.email, role: 'MEMBER' },
      });
      const reserved = await conforms<{ reservation: { id: string } }>(
        201,
        'POST',
        grants,
        `${base}/role-grants`,
        {
          token,
          body: {
            email: `${unique('ocNew')}@integration.local`.toLowerCase(),
            role: 'AGENT',
          },
        },
      );
      await conforms(200, 'GET', grants, `${base}/role-grants`, { token });
      await conforms(403, 'GET', grants, `${base}/role-grants`, {
        token: person.token,
      });
      await conforms(409, 'POST', grants, `${base}/role-grants`, {
        token,
        body: { email: owner.email, role: 'MEMBER' },
      });

      const members = '/organizations/{organizationId}/members';
      await conforms(200, 'GET', members, `${base}/members`, { token });
      await conforms(200, 'GET', members, `${base}/members`, {
        token: person.token,
      });
      const member = '/organizations/{organizationId}/members/{userId}';
      await conforms(200, 'PATCH', member, `${base}/members/${person.id}`, {
        token,
        body: { role: 'AGENT' },
      });
      await conforms(409, 'PATCH', member, `${base}/members/${owner.id}`, {
        token,
        body: { role: 'MEMBER' },
      });

      await conforms(
        200,
        'GET',
        '/organizations/{organizationId}/stats',
        `${base}/stats`,
        {
          token: person.token,
        },
      );
      await conforms(204, 'DELETE', member, `${base}/members/${person.id}`, {
        token,
      });
      await conforms(404, 'GET', '/organizations/{organizationId}', base, {
        token: person.token,
      });
      const invitee = await registerUser('ocInvitee');
      await conforms(201, 'POST', members, `${base}/members`, {
        token,
        body: { identifier: invitee.username, role: 'MEMBER' },
      });
      await conforms(409, 'POST', members, `${base}/members`, {
        token,
        body: { identifier: invitee.username, role: 'MEMBER' },
      });
      await conforms(
        403,
        'GET',
        '/organizations/{organizationId}/stats',
        `${base}/stats`,
        {
          token: invitee.token,
        },
      );
      const grant = `${base}/role-grants/${reserved.body.reservation.id}`;
      await conforms(204, 'DELETE', `${grants}/{grantId}`, grant, { token });
      await conforms(404, 'DELETE', `${grants}/{grantId}`, grant, { token });
    });

    it('amistades', async (t) => {
      if (!ready) return skip(t);
      const asker = await registerUser('ocAsker');
      const asked = await registerUser('ocAsked');
      await conforms(200, 'GET', '/friends', '/friends', {
        token: asker.token,
      });
      const sent = await conforms<{ id: string }>(
        201,
        'POST',
        '/friends/requests',
        '/friends/requests',
        {
          token: asker.token,
          body: { username: asked.username },
        },
      );
      await conforms(409, 'POST', '/friends/requests', '/friends/requests', {
        token: asked.token,
        body: { userId: asker.id },
      });
      await conforms(400, 'POST', '/friends/requests', '/friends/requests', {
        token: asker.token,
        body: { username: asker.username },
      });
      await conforms(404, 'POST', '/friends/requests', '/friends/requests', {
        token: asker.token,
        body: { username: unique('nobody') },
      });
      await conforms(200, 'GET', '/friends/requests', '/friends/requests', {
        token: asker.token,
      });
      await conforms(200, 'GET', '/friends/requests', '/friends/requests', {
        token: asked.token,
      });
      const respond = '/friends/requests/{id}';
      // Only the person who was asked can answer.
      await conforms(
        404,
        'PATCH',
        respond,
        `/friends/requests/${sent.body.id}`,
        {
          token: asker.token,
          body: { action: 'ACCEPT' },
        },
      );
      await conforms(
        400,
        'PATCH',
        respond,
        `/friends/requests/${sent.body.id}`,
        {
          token: asked.token,
          body: { action: 'BLOCK' },
        },
      );
      await conforms(
        200,
        'PATCH',
        respond,
        `/friends/requests/${sent.body.id}`,
        {
          token: asked.token,
          body: { action: 'ACCEPT' },
        },
      );
      await conforms(200, 'GET', '/friends', '/friends', {
        token: asker.token,
      });
      await conforms(
        204,
        'DELETE',
        '/friends/{userId}',
        `/friends/${asked.id}`,
        { token: asker.token },
      );
      await conforms(
        404,
        'DELETE',
        '/friends/{userId}',
        `/friends/${asked.id}`,
        { token: asker.token },
      );
    });

    /**
     * La búsqueda de tickets no estaba aquí, y por eso el documento se pasó
     * meses diciendo que `facets` colgaba al lado de `meta` cuando el servicio
     * lo pasa como extra a `paginate()` y acaba DENTRO de `meta`, junto a
     * `tookMs` —que el documento ni mencionaba—. Lo vio Nahuel el 08/10
     * comparando Swagger con las herramientas del navegador, no una prueba.
     *
     * Se recorre con y sin facetas, porque el bloque sólo aparece cuando hay
     * algo que contar, y con las dos paginaciones.
     */
    it('búsqueda de tickets: paginación, facetas y lo que tarda', async (t) => {
      if (!ready) return skip(t);
      const dueno = await registerUser('ocSearch');
      const organizacion = await conforms<{ id: string }>(
        201,
        'POST',
        '/organizations',
        '/organizations',
        { token: dueno.token, body: { name: `Org ${unique('ocs')}` } },
      );
      const token = dueno.token;

      // Vacía: el documento tiene que admitir también que no haya nada.
      await conforms(200, 'GET', '/tickets', '/tickets', { token });

      const categorias = await api<Array<{ id: string }>>(
        'GET',
        `/organizations/${organizacion.body.id}/categories`,
        { token },
      );
      for (const titulo of ['Primera incidencia', 'Segunda incidencia']) {
        await conforms(201, 'POST', '/tickets', '/tickets', {
          token,
          body: {
            organizationId: organizacion.body.id,
            title: `${titulo} ${unique('t')}`,
            description:
              'Descripción con longitud suficiente para pasar la validación del contrato.',
            priority: 'MEDIUM',
            categoryId: categorias.body[0]?.id,
          },
        });
      }

      // Con contenido: aquí es donde aparecen `facets` y `tookMs`.
      const buscada = await conforms<{
        meta: { facets?: unknown; tookMs?: number };
      }>(200, 'GET', '/tickets', '/tickets?take=30', { token });
      assert.ok(
        buscada.body.meta.facets,
        'la búsqueda devolvió sin facetas: la prueba pasaría sin comprobar nada',
      );
      assert.equal(
        typeof buscada.body.meta.tookMs,
        'number',
        '`tookMs` tiene que venir dentro de `meta`',
      );
      assert.ok(
        !Object.hasOwn(buscada.body as object, 'facets'),
        '`facets` no va al lado de `meta`: va dentro',
      );

      // Filtrada, ordenada y por cursor: los otros caminos del mismo endpoint.
      await conforms(200, 'GET', '/tickets', '/tickets?status=OPEN', { token });
      await conforms(
        200,
        'GET',
        '/tickets',
        '/tickets?q=incidencia&sort=createdAt&order=desc',
        { token },
      );
      await conforms(200, 'GET', '/tickets', '/tickets?take=1&cursor=', {
        token,
      });
    });
  },
);
