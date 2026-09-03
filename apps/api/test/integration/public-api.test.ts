import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  api,
  apiIsUp,
  createOrganization,
  registerUser,
  SKIP_MESSAGE,
  type TestUser,
} from './helpers.ts';

/**
 * API pública autenticada con clave.
 *
 * Lo que se está comprobando aquí no es que las rutas respondan, sino que la
 * puerta de la API pública **no sea un atajo**: llama a los mismos servicios de
 * dominio que la web, así que el RBAC, la máquina de estados y el aislamiento
 * por organización tienen que aplicarse igual. Lo único que cambia es el
 * mecanismo de autenticación y unos límites más estrictos.
 */
describe('integración · API pública con clave', { concurrency: false }, () => {
  let up = false;
  let owner: TestUser;
  let organizationId = '';
  let fullKey = '';
  let readOnlyKey = '';
  let readOnlyKeyId = '';

  before(async () => {
    up = await apiIsUp();
    if (!up) return;
    owner = await registerUser('apikey');
    organizationId = await createOrganization(owner.token);

    const full = await api<{ id: string; secret: string }>(
      'POST',
      `/organizations/${organizationId}/api-keys`,
      {
        token: owner.token,
        body: {
          name: 'clave completa',
          scopes: [
            'tickets:read',
            'tickets:write',
            'comments:read',
            'comments:write',
            'categories:read',
            'categories:write',
            'stats:read',
          ],
        },
      },
    );
    fullKey = full.body.secret;

    const readOnly = await api<{ id: string; secret: string }>(
      'POST',
      `/organizations/${organizationId}/api-keys`,
      {
        token: owner.token,
        body: { name: 'solo lectura', scopes: ['tickets:read'] },
      },
    );
    readOnlyKey = readOnly.body.secret;
    readOnlyKeyId = readOnly.body.id;
  });

  it('el secreto se entrega una sola vez y nunca vuelve a aparecer', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    assert.match(fullKey, /^hdl_live_[0-9a-f]{8}\./);

    const listed = await api<Array<Record<string, unknown>>>(
      'GET',
      `/organizations/${organizationId}/api-keys`,
      { token: owner.token },
    );
    assert.equal(listed.status, 200);
    assert.ok(
      !listed.text.includes('keyHash'),
      'el hash de la clave no puede salir por la API',
    );
    assert.ok(
      !listed.text.includes(fullKey.split('.')[1]!),
      'el secreto en claro no puede volver a aparecer en ningún listado',
    );
  });

  it('rechaza claves ausentes, mal formadas o inventadas', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    assert.equal((await api('GET', '/public/me')).status, 401);
    assert.equal(
      (await api('GET', '/public/me', { apiKey: 'corta' })).status,
      401,
    );
    assert.equal(
      (
        await api('GET', '/public/me', {
          apiKey: 'hdl_live_aaaaaaaa.bbbbbbbbbbbbbbbbbbbbbbbb',
        })
      ).status,
      401,
    );
  });

  it('aplica los scopes de la clave', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    assert.equal(
      (await api('GET', '/public/tickets', { apiKey: readOnlyKey })).status,
      200,
    );

    const denied = await api<{ code: string }>('POST', '/public/tickets', {
      apiKey: readOnlyKey,
      body: {
        title: 'No deberia crearse nunca',
        description: 'Descripcion suficientemente larga para el contrato.',
      },
    });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, 'API_KEY_MISSING_SCOPE');
  });

  it('la clave revocada deja de funcionar en el acto', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    assert.equal(
      (
        await api(
          'DELETE',
          `/organizations/${organizationId}/api-keys/${readOnlyKeyId}`,
          {
            token: owner.token,
          },
        )
      ).status,
      204,
    );
    assert.equal(
      (await api('GET', '/public/tickets', { apiKey: readOnlyKey })).status,
      401,
    );
  });

  it('la clave queda encerrada en su organización', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const other = await registerUser('apiOther');
    const otherOrg = await createOrganization(other.token);

    const response = await api(
      'GET',
      `/public/organizations/${otherOrg}/stats`,
      {
        apiKey: fullKey,
      },
    );
    assert.equal(response.status, 404);

    const own = await api(
      'GET',
      `/public/organizations/${organizationId}/stats`,
      {
        apiKey: fullKey,
      },
    );
    assert.equal(own.status, 200);
  });

  it('la API pública no se salta la máquina de estados', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const created = await api<{ id: string; status: string }>(
      'POST',
      '/public/tickets',
      {
        apiKey: fullKey,
        body: {
          title: 'Ticket creado desde un sistema externo',
          description:
            'Creado por la suite de integración a través de la API pública.',
        },
      },
    );
    assert.equal(created.status, 201);
    assert.equal(
      created.body.status,
      'OPEN',
      'un cliente externo no puede fijar el estado inicial',
    );

    // El contrato de creación se aplica igual que en la web.
    const invalid = await api<{ code: string }>('POST', '/public/tickets', {
      apiKey: fullKey,
      body: { title: 'ab', description: 'corta' },
    });
    assert.equal(invalid.status, 400);
  });

  it('declara sus propias cabeceras de límite por clave', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const response = await api('GET', '/public/me', { apiKey: fullKey });
    assert.equal(response.status, 200);
    assert.ok(
      response.headers.get('ratelimit-limit'),
      'la API pública tiene límites propios y los publica',
    );
  });
});
