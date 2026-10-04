import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  api,
  apiIsUp,
  eventually,
  PASSWORD,
  registerUser,
  SKIP_MESSAGE,
  type TestUser,
} from './helpers.ts';
import {
  closeDb,
  dbAvailable,
  DB_SKIP_MESSAGE,
  promoteToGlobalAdmin,
} from './db.ts';

/**
 * La administración de usuarios de la plataforma, que es lo que hay detrás de
 * la pantalla del GLOBAL_ADMIN: buscar, filtrar y ordenar; corregir el
 * nombre; suspender y reactivar; cambiar el rol; borrar. Y las salvaguardas:
 * nadie se suspende, se degrada ni se borra a sí mismo, y todo queda en la
 * auditoría.
 */

interface Row {
  id: string;
  username: string;
  email: string;
  globalRole: string;
  isActive: boolean;
  isPrimary: boolean;
  emailVerifiedAt: string | null;
}

interface Page {
  data: Row[];
  meta: { total: number; page: number; take: number; pages: number };
}

describe(
  'integración · administración de usuarios',
  { concurrency: false },
  () => {
    let ready = false;
    let admin: TestUser;
    // Un prefijo común y aleatorio permite buscar SÓLO las cuentas de esta
    // ejecución (y deja sitio en los 32 caracteres del nombre de usuario).
    const tag = `au${randomBytes(3).toString('hex')}`;
    let alpha: TestUser;
    let beta: TestUser;
    let gamma: TestUser;

    before(async () => {
      ready = (await apiIsUp()) && dbAvailable();
      if (!ready) return;
      admin = await registerUser('auAdmin');
      await promoteToGlobalAdmin(admin.id);
      alpha = await registerUser(`${tag}a`);
      beta = await registerUser(`${tag}b`);
      gamma = await registerUser(`${tag}c`);
    });

    after(closeDb);

    const skip = (t: { skip: (message: string) => void }) =>
      t.skip(dbAvailable() ? SKIP_MESSAGE : DB_SKIP_MESSAGE);

    const list = (query: string) =>
      api<Page>('GET', `/users?${query}`, { token: admin.token });

    it('busca por nombre de usuario o correo, ordena y pagina', async (t) => {
      if (!ready) return skip(t);
      const ascending = await list(`q=${tag}&sort=username&order=asc`);
      assert.equal(ascending.status, 200);
      assert.deepEqual(
        ascending.body.data.map((row) => row.id),
        [alpha.id, beta.id, gamma.id],
      );
      const descending = await list(`q=${tag}&sort=username&order=desc`);
      assert.deepEqual(
        descending.body.data.map((row) => row.id),
        [gamma.id, beta.id, alpha.id],
      );
      // Por correo: la parte del dominio es común a toda la suite, el usuario no.
      const byEmail = await list(`q=${encodeURIComponent(beta.email)}`);
      assert.deepEqual(
        byEmail.body.data.map((row) => row.id),
        [beta.id],
      );

      const paged = await list(
        `q=${tag}&sort=username&order=asc&take=2&page=2`,
      );
      assert.deepEqual(paged.body.meta, {
        total: 3,
        page: 2,
        take: 2,
        pages: 2,
      });
      assert.deepEqual(
        paged.body.data.map((row) => row.id),
        [gamma.id],
      );
      assert.ok(
        ascending.body.data.every((row) => row.isPrimary === false),
        'ninguna cuenta de prueba es la de rescate',
      );
    });

    it('filtra por rol de plataforma y por estado', async (t) => {
      if (!ready) return skip(t);
      await promoteToGlobalAdmin(beta.id);
      const admins = await list(`q=${tag}&globalRole=GLOBAL_ADMIN`);
      assert.deepEqual(
        admins.body.data.map((row) => row.id),
        [beta.id],
      );
      const users = await list(
        `q=${tag}&globalRole=USER&sort=username&order=asc`,
      );
      assert.deepEqual(
        users.body.data.map((row) => row.id),
        [alpha.id, gamma.id],
      );

      assert.equal(
        (
          await api('PATCH', `/users/${gamma.id}/status`, {
            token: admin.token,
            body: { isActive: false },
          })
        ).status,
        200,
      );
      const suspended = await list(`q=${tag}&isActive=false`);
      assert.deepEqual(
        suspended.body.data.map((row) => row.id),
        [gamma.id],
      );
      await api('PATCH', `/users/${gamma.id}/status`, {
        token: admin.token,
        body: { isActive: true },
      });
    });

    it('una cuenta suspendida no entra; reactivada, sí', async (t) => {
      if (!ready) return skip(t);
      await api('PATCH', `/users/${alpha.id}/status`, {
        token: admin.token,
        body: { isActive: false },
      });
      const refused = await api<{ code: string }>('POST', '/auth/login', {
        body: { email: alpha.email, password: PASSWORD },
      });
      assert.equal(refused.status, 403);
      assert.equal(refused.body.code, 'AUTH_ACCOUNT_DISABLED');
      assert.equal(
        (await api('GET', '/auth/me', { token: alpha.token })).status === 200,
        false,
        'tampoco le vale la sesión que ya tenía abierta',
      );

      await api('PATCH', `/users/${alpha.id}/status`, {
        token: admin.token,
        body: { isActive: true },
      });
      const back = await api('POST', '/auth/login', {
        body: { email: alpha.email, password: PASSWORD },
      });
      assert.equal(back.status, 200);
    });

    it('nadie se suspende, se degrada ni se borra a sí mismo', async (t) => {
      if (!ready) return skip(t);
      for (const [method, path, body] of [
        ['PATCH', `/users/${admin.id}/status`, { isActive: false }],
        ['PATCH', `/users/${admin.id}/role`, { globalRole: 'USER' }],
        ['DELETE', `/users/${admin.id}`, undefined],
      ] as const) {
        const response = await api<{ code: string }>(method, path, {
          token: admin.token,
          body,
        });
        assert.equal(response.status, 403, `${method} ${path}`);
        assert.equal(response.body.code, 'RBAC_FORBIDDEN');
      }
    });

    it('un usuario corriente no administra a nadie', async (t) => {
      if (!ready) return skip(t);
      for (const [method, path, body] of [
        ['GET', '/users', undefined],
        ['PATCH', `/users/${beta.id}`, { firstName: 'X' }],
        ['PATCH', `/users/${beta.id}/status`, { isActive: false }],
        ['PATCH', `/users/${alpha.id}/role`, { globalRole: 'GLOBAL_ADMIN' }],
        ['DELETE', `/users/${beta.id}`, undefined],
      ] as const)
        assert.equal(
          (await api(method, path, { token: gamma.token, body })).status,
          403,
          `${method} ${path}`,
        );
    });

    it('cambiar el rol y suspender queda en la auditoría', async (t) => {
      if (!ready) return skip(t);
      await api('PATCH', `/users/${gamma.id}/role`, {
        token: admin.token,
        body: { globalRole: 'GLOBAL_ADMIN' },
      });
      type Entries = {
        data: Array<{ action: string; actor: { id: string } | null }>;
      };
      // The trail is written after the answer, on purpose: wait for it.
      const entries = await eventually(
        () =>
          api<Entries>('GET', `/admin/audit-logs?entityId=${gamma.id}`, {
            token: admin.token,
          }),
        (response) =>
          response.body.data.some(
            (entry) => entry.action === 'user.role.changed',
          ),
      );
      const actions = entries.body.data.map((entry) => entry.action);
      assert.ok(actions.includes('user.role.changed'), actions.join(', '));
      assert.ok(actions.includes('user.status.changed'), actions.join(', '));
      assert.ok(
        entries.body.data.every((entry) => entry.actor?.id === admin.id),
        'cada entrada dice quién lo hizo',
      );
    });

    it('una cuenta borrada desaparece de la lista y deja de entrar', async (t) => {
      if (!ready) return skip(t);
      const doomed = await registerUser(`${tag}z`);
      assert.equal(
        (await api('DELETE', `/users/${doomed.id}`, { token: admin.token }))
          .status,
        204,
      );
      const listed = await list(`q=${encodeURIComponent(doomed.email)}`);
      assert.equal(listed.body.meta.total, 0);
      assert.notEqual(
        (
          await api('POST', '/auth/login', {
            body: { email: doomed.email, password: PASSWORD },
          })
        ).status,
        200,
      );
      assert.equal(
        (await api('DELETE', `/users/${doomed.id}`, { token: admin.token }))
          .status === 500,
        false,
        'borrar dos veces no es un error del servidor',
      );
    });
  },
);
