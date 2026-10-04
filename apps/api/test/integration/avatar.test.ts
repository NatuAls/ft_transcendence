import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  api,
  apiIsUp,
  BASE_URL,
  multipart,
  PNG_1X1,
  registerUser,
  SKIP_MESSAGE,
  type TestUser,
} from './helpers.ts';

/**
 * El avatar, de punta a punta: sin foto la cuenta no tiene URL (la interfaz
 * pinta el avatar por defecto, las iniciales); al subirla se sirve
 * re-codificada; al quitarla vuelve a no tener URL y el fichero desaparece,
 * de modo que la URL antigua deja de responder.
 */
describe('integración · avatar', { concurrency: false }, () => {
  let up = false;
  let owner: TestUser;

  before(async () => {
    up = await apiIsUp();
    if (!up) return;
    owner = await registerUser('avatar');
  });

  it('sube, sirve y retira el avatar, y con él el fichero', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);

    const fresh = await api<{ avatarUrl: string | null }>('GET', '/auth/me', {
      token: owner.token,
    });
    assert.equal(fresh.body.avatarUrl, null, 'sin foto: avatar por defecto');

    const form = multipart('me.png', 'image/png', PNG_1X1);
    const uploaded = await api<{ avatarUrl: string }>(
      'PUT',
      '/users/me/avatar',
      { token: owner.token, headers: form.headers, raw: form.raw },
    );
    assert.equal(uploaded.status, 200);
    assert.match(
      uploaded.body.avatarUrl,
      /^\/api\/v1\/users\/avatars\/.+\.webp$/,
    );

    const served = await fetch(`${BASE_URL}${uploaded.body.avatarUrl}`);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('content-type'), 'image/webp');

    const removed = await api<{ avatarUrl: null }>(
      'DELETE',
      '/users/me/avatar',
      { token: owner.token },
    );
    assert.equal(removed.status, 200);
    assert.equal(removed.body.avatarUrl, null);

    const gone = await fetch(`${BASE_URL}${uploaded.body.avatarUrl}`);
    assert.equal(gone.status, 404, 'la foto retirada no sigue en el servidor');
  });

  it('una imagen dañada es un 422, no un 500', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    // Cabecera PNG auténtica (pasa la detección por magic bytes) y el resto
    // roto: lo que falla es la decodificación.
    const damaged = Buffer.concat([PNG_1X1.subarray(0, 40), Buffer.alloc(40)]);
    const form = multipart('broken.png', 'image/png', damaged);
    const response = await api<{ code: string }>('PUT', '/users/me/avatar', {
      token: owner.token,
      headers: form.headers,
      raw: form.raw,
    });
    assert.equal(response.status, 422);
    assert.equal(response.body.code, 'FILE_IMAGE_UNREADABLE');
  });
});
