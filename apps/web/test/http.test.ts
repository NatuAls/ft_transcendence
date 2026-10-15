import { describe, expect, it, vi } from 'vitest';
import { request, upload } from '../src/core/api/client';
import {
  ApiError,
  NetworkError,
  errorKey,
  errorMessage,
} from '../src/core/api/errors';
import { getAccessToken, saveAccessToken } from '../src/api/auth';
import { apiError, mockApi, reply } from './support/api';
import { adminUser, page } from './support/fixtures';
import { jwt } from './support/jwt';

describe('the API client', () => {
  it('sends the access token and JSON only when there is a body', async () => {
    const { calls } = mockApi({
      'GET /users': reply('GET /users', 200, page([adminUser()])),
      'PATCH /users/me': reply('PATCH /users/me', 200, {
        displayName: 'Ana García',
        firstName: 'Ana',
        lastName: 'García',
        bio: null,
        jobTitle: null,
        avatarUrl: null,
      }),
    });
    saveAccessToken('token-1');
    await request('/users');
    await request('/users/me', {
      method: 'PATCH',
      body: { firstName: 'Ana' },
    });
    expect(calls[0]!.headers['authorization']).toBe('Bearer token-1');
    expect(calls[0]!.headers['content-type']).toBeUndefined();
    expect(calls[1]!.headers['content-type']).toBe('application/json');
    expect(calls[1]!.body).toEqual({ firstName: 'Ana' });
  });

  it('answers a 204 with nothing', async () => {
    mockApi({
      'DELETE /admin/role-grants/x': reply(
        'DELETE /admin/role-grants/{grantId}',
        204,
      ),
    });
    await expect(
      request('/admin/role-grants/x', { method: 'DELETE' }),
    ).resolves.toBeUndefined();
  });

  it('turns the error envelope into an ApiError a screen can switch on', async () => {
    mockApi({
      'PATCH /organizations/o/members/u': apiError(
        'PATCH /organizations/{organizationId}/members/{userId}',
        409,
        'ORG_LAST_ADMIN',
        'An organization must keep at least one administrator.',
      ),
    });
    const failure = await request('/organizations/o/members/u', {
      method: 'PATCH',
      body: { role: 'MEMBER' },
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({
      status: 409,
      code: 'ORG_LAST_ADMIN',
      message: 'An organization must keep at least one administrator.',
    });
  });

  it('still reports an answer that carries no envelope', async () => {
    // Un 502 de un proxy no trae el sobre de la API. Sigue siendo una
    // respuesta del servidor, no un fallo de red: lo que no puede pasar es
    // que la pantalla se quede sin `status` ni mensaje que enseñar.
    mockApi({ 'GET /users': { status: 502, body: undefined } });
    const failure = await request('/users').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 502, code: 'UNKNOWN' });
    expect(errorMessage(failure)).toContain('502');
    // Y lo que dice es lo que pasa: sin el sobre de la API, es la API la que
    // no está (15/10: las estadísticas decían «Error inesperado»).
    expect(errorKey(failure)).toBe('errors.common.serverUnavailable');
  });

  it('says the server is unavailable whatever the proxy answers with', async () => {
    // Vite contesta 500 sin cuerpo cuando la API está parada.
    mockApi({ 'GET /users': { status: 500, body: undefined } });
    const failure = await request('/users').catch((error: unknown) => error);
    expect(errorKey(failure)).toBe('errors.common.serverUnavailable');
  });

  it('keeps the API own message when the 5xx does carry its envelope', async () => {
    // El 500 de la propia API (error-handler.ts) sí trae su sobre.
    mockApi({
      'GET /users': {
        status: 500,
        body: {
          statusCode: 500,
          code: 'INTERNAL_ERROR',
          messageKey: 'errors.common.internal',
          message: 'Internal server error',
        },
      },
    });
    const failure = await request('/users').catch((error: unknown) => error);
    expect(errorKey(failure)).toBe('errors.common.internal');
  });

  it('names the rate limit when nginx answers 429 without an envelope', async () => {
    mockApi({ 'GET /users': { status: 429, body: undefined } });
    const failure = await request('/users').catch((error: unknown) => error);
    expect(failure).toMatchObject({ status: 429, code: 'RATE_LIMITED' });
    expect(errorKey(failure)).toBe('errors.common.rateLimited');
  });

  it('does not leave an upload hanging when the renewal finds no server', async () => {
    // La subida recibe un 401 y la renovación se encuentra el proxy con la API
    // parada. Antes, la promesa de la subida no se resolvía nunca.
    document.cookie = 'hd_session=1';
    class SubidaFalsa {
      status = 0;
      responseText = '';
      withCredentials = false;
      upload: { onprogress: unknown } = { onprogress: null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      open() {}
      setRequestHeader() {}
      send() {
        this.status = 401;
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('XMLHttpRequest', SubidaFalsa);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 502 })),
    );
    const failure = await upload('/users/me/avatar', new FormData()).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(NetworkError);
  });

  it('separates a server that refuses from a network that is not there', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    const failure = await request('/users').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(NetworkError);
    expect(errorMessage(failure)).toContain('did not answer');
  });

  it('renews a token about to expire before using it, without a 401 first', async () => {
    // Antes salía con el token caducado, volvía con un 401 —que Chrome anota
    // en rojo en la consola— y sólo entonces se renovaba y se repetía.
    document.cookie = 'hd_session=1';
    saveAccessToken(jwt(10));
    const fresh = jwt(900);
    const { calls } = mockApi({
      'GET /admin/role-grants': (call) =>
        call.headers['authorization'] === `Bearer ${fresh}`
          ? reply('GET /admin/role-grants', 200, [])
          : apiError(
              'GET /admin/role-grants',
              401,
              'AUTH_TOKEN_INVALID',
              'Token is invalid or expired.',
            ),
      'POST /auth/refresh': {
        status: 200,
        body: { accessToken: fresh, user: {} },
      },
    });
    await expect(request('/admin/role-grants')).resolves.toEqual([]);
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'POST /auth/refresh',
      'GET /admin/role-grants',
    ]);
    expect(getAccessToken()).toBe(fresh);
  });

  it('does not renew a token that is still good', async () => {
    document.cookie = 'hd_session=1';
    saveAccessToken(jwt(900));
    const { calls } = mockApi({
      'GET /admin/role-grants': reply('GET /admin/role-grants', 200, []),
    });
    await request('/admin/role-grants');
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'GET /admin/role-grants',
    ]);
  });

  it('renews once and repeats the request when the server refuses a token that looks good', async () => {
    // Un token revocado en el servidor (cerrar las demás sesiones, cambiar la
    // contraseña) parece válido hasta que la API lo rechaza.
    document.cookie = 'hd_session=1';
    saveAccessToken(jwt(600));
    const fresh = jwt(900);
    let attempts = 0;
    const { calls } = mockApi({
      'GET /admin/role-grants': (call) => {
        attempts += 1;
        return call.headers['authorization'] === `Bearer ${fresh}`
          ? reply('GET /admin/role-grants', 200, [])
          : apiError(
              'GET /admin/role-grants',
              401,
              'AUTH_TOKEN_INVALID',
              'Token is invalid or expired.',
            );
      },
      'POST /auth/refresh': {
        status: 200,
        body: { accessToken: fresh, user: {} },
      },
    });
    await expect(request('/admin/role-grants')).resolves.toEqual([]);
    expect(attempts).toBe(2);
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'GET /admin/role-grants',
      'POST /auth/refresh',
      'GET /admin/role-grants',
    ]);
    expect(getAccessToken()).toBe(fresh);
  });

  it('gives up after one renewal: a second 401 is a real one', async () => {
    document.cookie = 'hd_session=1';
    mockApi({
      'GET /admin/role-grants': apiError(
        'GET /admin/role-grants',
        401,
        'AUTH_TOKEN_INVALID',
        'Token is invalid or expired.',
      ),
      'POST /auth/refresh': { status: 401, body: undefined },
    });
    await expect(request('/admin/role-grants')).rejects.toMatchObject({
      status: 401,
    });
  });
});
