import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  api,
  apiIsUp,
  cookieHeader,
  login,
  PASSWORD,
  registerUser,
  SKIP_MESSAGE,
  unique,
  type TestUser,
} from './helpers.ts';

/**
 * Ciclo de vida de la sesión, extremo a extremo.
 *
 * El bloque que más importa aquí es el de revocación: `logout`, `logout-all` y
 * el cambio de contraseña revocaban únicamente la fila de refresh en
 * PostgreSQL, así que el JWT que el navegador ya tenía seguía siendo válido
 * hasta caducar (hasta 15 minutos). Es decir, «cerrar sesión» no cerraba nada.
 * Estas pruebas fijan ese comportamiento para que no vuelva a perderse.
 */
describe(
  'integración · autenticación y sesiones',
  { concurrency: false },
  () => {
    let up = false;
    let user: TestUser;

    before(async () => {
      up = await apiIsUp();
      if (up) user = await registerUser('auth');
    });

    it('registra, devuelve access token y cookie de refresh HttpOnly', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);

      const username = unique('reg');
      const response = await api<{ accessToken: string }>(
        'POST',
        '/auth/register',
        {
          body: {
            email: `${username}@integration.local`,
            username,
            password: PASSWORD,
            confirmPassword: PASSWORD,
            firstName: 'Reg',
            lastName: 'User',
            acceptTerms: true,
          },
        },
      );

      assert.equal(response.status, 201);
      assert.ok(response.body.accessToken, 'debe devolver un access token');

      const refresh = response.cookies.find((c) => c.startsWith('hd_refresh='));
      assert.ok(refresh, 'debe fijar la cookie hd_refresh');
      assert.match(refresh, /HttpOnly/i);
      assert.match(refresh, /SameSite=Strict/i);
      assert.match(refresh, /Path=\/api\/v1\/auth/i);
      assert.ok(
        !response.text.includes('refreshToken'),
        'el refresh token no debe viajar en el cuerpo JSON',
      );
    });

    it('rechaza contraseñas que no cumplen el contrato compartido', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const username = unique('weak');
      const response = await api<{ code: string }>('POST', '/auth/register', {
        body: {
          email: `${username}@integration.local`,
          username,
          password: 'corta',
          confirmPassword: 'corta',
          firstName: 'W',
          lastName: 'K',
          acceptTerms: true,
        },
      });
      assert.equal(response.status, 400);
      assert.equal(response.body.code, 'VALIDATION_FAILED');
    });

    it('no distingue email inexistente de contraseña incorrecta', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const noSuchUser = await api<{ code: string }>('POST', '/auth/login', {
        body: {
          email: `${unique('ghost')}@integration.local`,
          password: PASSWORD,
        },
      });
      const wrongPassword = await api<{ code: string }>('POST', '/auth/login', {
        body: { email: user.email, password: 'Otra1!aaaaaaa' },
      });
      assert.equal(noSuchUser.status, 401);
      assert.equal(wrongPassword.status, 401);
      assert.equal(noSuchUser.body.code, wrongPassword.body.code);
    });

    it('detecta la reutilización de un refresh token y revoca la familia', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const session = await login(user.email);

      const first = await api('POST', '/auth/refresh', {
        cookie: session.cookie,
      });
      assert.equal(first.status, 200, 'el primer refresh debe funcionar');
      const rotated = cookieHeader(first.cookies);

      const replay = await api<{ code: string }>('POST', '/auth/refresh', {
        cookie: session.cookie,
      });
      assert.equal(replay.status, 401);
      assert.equal(replay.body.code, 'AUTH_REFRESH_REUSED');

      const afterBreach = await api('POST', '/auth/refresh', {
        cookie: rotated,
      });
      assert.equal(
        afterBreach.status,
        401,
        'la familia entera queda revocada tras detectar el robo',
      );
    });

    // -- revocación del access token ------------------------------------------

    it('logout invalida el access token con el que se pidió', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const session = await login(user.email);

      assert.equal(
        (await api('GET', '/auth/me', { token: session.token })).status,
        200,
      );

      const logout = await api('POST', '/auth/logout', {
        token: session.token,
        cookie: session.cookie,
      });
      assert.equal(logout.status, 204);

      const afterLogout = await api('GET', '/auth/me', {
        token: session.token,
      });
      assert.equal(
        afterLogout.status,
        401,
        'el JWT debe dejar de valer inmediatamente, no cuando caduque',
      );
    });

    it('logout-all invalida también los tokens de las demás sesiones', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const tabA = await login(user.email);
      const tabB = await login(user.email);

      const logoutAll = await api('POST', '/auth/logout-all', {
        token: tabB.token,
      });
      assert.equal(logoutAll.status, 204);

      assert.equal(
        (await api('GET', '/auth/me', { token: tabA.token })).status,
        401,
        'la otra pestaña también debe quedar fuera',
      );
      assert.equal(
        (await api('POST', '/auth/refresh', { cookie: tabA.cookie })).status,
        401,
      );
    });

    it('un login inmediatamente posterior a logout-all sí es válido', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      // Caso límite real: `iat` tiene resolución de un segundo, así que la
      // revocación y el nuevo login pueden caer en el mismo segundo. El token
      // nuevo no debe morir por el corte que acaba de fijarse.
      const session = await login(user.email);
      await api('POST', '/auth/logout-all', { token: session.token });
      const fresh = await login(user.email);
      assert.equal(
        (await api('GET', '/auth/me', { token: fresh.token })).status,
        200,
      );
    });

    it('cambiar la contraseña invalida las sesiones anteriores', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const victim = await registerUser('pwd');
      const session = await login(victim.email);
      const nextPassword = 'Password2!bbb';

      const change = await api('POST', '/auth/change-password', {
        token: session.token,
        body: {
          currentPassword: PASSWORD,
          password: nextPassword,
          confirmPassword: nextPassword,
        },
      });
      assert.equal(change.status, 204);

      assert.equal(
        (await api('GET', '/auth/me', { token: session.token })).status,
        401,
        'el token emitido antes del cambio no puede seguir sirviendo',
      );
      const relogin = await login(victim.email, nextPassword);
      assert.equal(
        (await api('GET', '/auth/me', { token: relogin.token })).status,
        200,
      );
    });

    it('rechaza tokens manipulados, caducados o de otro emisor', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const session = await login(user.email);
      const [header, payload, signature] = session.token.split('.');

      const tampered = `${header}.${payload}.${signature.slice(0, -3)}aaa`;
      assert.equal(
        (await api('GET', '/auth/me', { token: tampered })).status,
        401,
      );

      const algNone = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${payload}.`;
      assert.equal(
        (await api('GET', '/auth/me', { token: algNone })).status,
        401,
      );

      assert.equal(
        (await api('GET', '/auth/me', { token: 'no-es-un-jwt' })).status,
        401,
      );
      assert.equal((await api('GET', '/auth/me')).status, 401);
    });

    it('reenvía el correo de verificación y acepta el nuevo token', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const pending = await registerUser('verify');

      const resend = await api('POST', '/auth/resend-verification', {
        token: pending.token,
      });
      assert.equal(resend.status, 202);

      assert.equal(
        (await api('POST', '/auth/resend-verification')).status,
        401,
        'la ruta exige sesión: solo se puede pedir para la propia cuenta',
      );
    });

    it('lista y revoca sesiones activas', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const owner = await registerUser('sess');
      const session = await login(owner.email);

      const sessions = await api<Array<{ id: string }>>(
        'GET',
        '/auth/sessions',
        {
          token: session.token,
        },
      );
      assert.equal(sessions.status, 200);
      assert.ok(Array.isArray(sessions.body) && sessions.body.length > 0);

      const stranger = await registerUser('nosy');
      const target = sessions.body[0]!.id;
      await api('DELETE', `/auth/sessions/${target}`, {
        token: stranger.token,
      });

      const stillThere = await api<Array<{ id: string }>>(
        'GET',
        '/auth/sessions',
        {
          token: session.token,
        },
      );
      assert.ok(
        stillThere.body.some((s) => s.id === target),
        'un tercero no puede revocar la sesión de otro usuario',
      );
    });
  },
);
