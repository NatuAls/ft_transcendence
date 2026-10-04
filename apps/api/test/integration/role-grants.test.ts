import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMember,
  api,
  apiIsUp,
  createOrganization,
  eventually,
  registerUser,
  SKIP_MESSAGE,
  unique,
  type TestUser,
} from './helpers.ts';
import {
  closeDb,
  dbAvailable,
  DB_SKIP_MESSAGE,
  promoteToGlobalAdmin,
  verifyEmailOf,
} from './db.ts';

/**
 * Roles por correo electrónico, en los dos niveles.
 *
 * El administrador establece el vínculo con una DIRECCIÓN; la persona crea la
 * cuenta por su cuenta, y el rol le llega cuando esa dirección queda
 * verificada. Lo que importa comprobar es justo esa frontera: registrarse no
 * basta (si bastara, quien registrase antes la dirección de otra persona se
 * quedaría con su rol) y verificar sí.
 */

interface Me {
  globalRole: string;
  memberships: Array<{ organizationId: string; role: string }>;
  pendingRoles: Array<{
    scope: string;
    role: string;
    organizationName: string | null;
  }>;
}

interface Assignment {
  outcome: 'APPLIED' | 'RESERVED' | 'UNCHANGED';
  user: { id: string } | null;
  reservation: { id: string; waitingFor: string } | null;
}

const freshEmail = (prefix: string) =>
  `${unique(prefix)}@integration.local`.toLowerCase();

async function me(token: string): Promise<Me> {
  const response = await api<Me>('GET', '/auth/me', { token });
  assert.equal(response.status, 200);
  return response.body;
}

describe(
  'integración · roles asignados por correo',
  { concurrency: false },
  () => {
    let up = false;
    let ready = false;
    let admin: TestUser;
    let orgAdmin: TestUser;
    let organizationId = '';
    let organizationName = '';

    before(async () => {
      up = await apiIsUp();
      ready = up && dbAvailable();
      if (!ready) return;

      admin = await registerUser('rgAdmin');
      await promoteToGlobalAdmin(admin.id);
      orgAdmin = await registerUser('rgOrgAdmin');
      organizationId = await createOrganization(orgAdmin.token);
      const organization = await api<{ name: string }>(
        'GET',
        `/organizations/${organizationId}`,
        { token: orgAdmin.token },
      );
      organizationName = organization.body.name;
    });

    after(closeDb);

    const skip = (t: { skip: (message: string) => void }) =>
      t.skip(up ? DB_SKIP_MESSAGE : SKIP_MESSAGE);

    // -- nivel plataforma ----------------------------------------------------------

    it('sólo un GLOBAL_ADMIN asigna roles de plataforma', async (t) => {
      if (!ready) return skip(t);
      const email = freshEmail('rgDenied');
      assert.equal(
        (
          await api('POST', '/admin/role-grants', {
            token: orgAdmin.token,
            body: { email, globalRole: 'GLOBAL_ADMIN' },
          })
        ).status,
        403,
      );
      assert.equal(
        (await api('GET', '/admin/role-grants', { token: orgAdmin.token }))
          .status,
        403,
      );
    });

    it('valida el cuerpo con el contrato compartido', async (t) => {
      if (!ready) return skip(t);
      for (const body of [
        { email: 'no-es-un-correo', globalRole: 'GLOBAL_ADMIN' },
        // USER no se reserva: toda cuenta ya lo es. Quitar el rol es
        // PATCH /users/:id/role.
        { email: freshEmail('rgUser'), globalRole: 'USER' },
      ]) {
        const response = await api('POST', '/admin/role-grants', {
          token: admin.token,
          body,
        });
        assert.equal(response.status, 400, JSON.stringify(body));
      }
    });

    it('un correo sin cuenta queda reservado y el rol llega al VERIFICAR, no al registrarse', async (t) => {
      if (!ready) return skip(t);
      const email = freshEmail('rgFuture');

      const assigned = await api<Assignment>('POST', '/admin/role-grants', {
        token: admin.token,
        body: { email: email.toUpperCase(), globalRole: 'GLOBAL_ADMIN' },
      });
      assert.equal(assigned.status, 201);
      assert.equal(assigned.body.outcome, 'RESERVED');
      assert.equal(assigned.body.reservation?.waitingFor, 'ACCOUNT');

      const listed = await api<Array<{ email: string; waitingFor: string }>>(
        'GET',
        '/admin/role-grants',
        { token: admin.token },
      );
      assert.equal(
        listed.body.find((row) => row.email === email)?.waitingFor,
        'ACCOUNT',
        'la dirección se guarda normalizada y aparece en la lista',
      );

      // Registrarse con la dirección NO da el rol.
      const person = await registerUser('rgFuture', email);
      const beforeVerifying = await me(person.token);
      assert.equal(beforeVerifying.globalRole, 'USER');
      assert.deepEqual(beforeVerifying.pendingRoles, [
        { scope: 'PLATFORM', role: 'GLOBAL_ADMIN', organizationName: null },
      ]);
      assert.equal(
        (await api('GET', '/admin/stats', { token: person.token })).status,
        403,
      );
      const waiting = await api<Array<{ email: string; waitingFor: string }>>(
        'GET',
        '/admin/role-grants',
        { token: admin.token },
      );
      assert.equal(
        waiting.body.find((row) => row.email === email)?.waitingFor,
        'VERIFICATION',
      );

      // Verificarla, sí.
      await verifyEmailOf(person.id);
      const afterVerifying = await me(person.token);
      assert.equal(afterVerifying.globalRole, 'GLOBAL_ADMIN');
      assert.deepEqual(afterVerifying.pendingRoles, []);
      assert.equal(
        (await api('GET', '/admin/stats', { token: person.token })).status,
        200,
        'el rol vale en el servidor con el mismo token, sin volver a entrar',
      );

      const after = await api<Array<{ email: string }>>(
        'GET',
        '/admin/role-grants',
        { token: admin.token },
      );
      assert.ok(
        !after.body.some((row) => row.email === email),
        'una reserva reclamada desaparece de la lista',
      );
    });

    it('una cuenta verificada recibe el rol al instante; repetirlo no cambia nada', async (t) => {
      if (!ready) return skip(t);
      const person = await registerUser('rgNow');
      await verifyEmailOf(person.id);

      const first = await api<Assignment>('POST', '/admin/role-grants', {
        token: admin.token,
        body: { email: person.email, globalRole: 'GLOBAL_ADMIN' },
      });
      assert.equal(first.status, 200);
      assert.equal(first.body.outcome, 'APPLIED');
      assert.equal(first.body.user?.id, person.id);
      assert.equal((await me(person.token)).globalRole, 'GLOBAL_ADMIN');

      const second = await api<Assignment>('POST', '/admin/role-grants', {
        token: admin.token,
        body: { email: person.email, globalRole: 'GLOBAL_ADMIN' },
      });
      assert.equal(second.status, 200);
      assert.equal(second.body.outcome, 'UNCHANGED');
    });

    it('una cuenta sin verificar espera a la verificación', async (t) => {
      if (!ready) return skip(t);
      const person = await registerUser('rgUnverified');
      const assigned = await api<Assignment>('POST', '/admin/role-grants', {
        token: admin.token,
        body: { email: person.email, globalRole: 'GLOBAL_ADMIN' },
      });
      assert.equal(assigned.status, 201);
      assert.equal(assigned.body.reservation?.waitingFor, 'VERIFICATION');
      assert.equal((await me(person.token)).globalRole, 'USER');
    });

    it('nadie cambia su propio rol de plataforma', async (t) => {
      if (!ready) return skip(t);
      const response = await api('POST', '/admin/role-grants', {
        token: admin.token,
        body: { email: admin.email, globalRole: 'GLOBAL_ADMIN' },
      });
      assert.equal(response.status, 403);
    });

    it('editar a un usuario corrige su nombre, pero no lo suspende', async (t) => {
      if (!ready) return skip(t);
      const person = await registerUser('rgEdited');
      // Suspender va por PATCH /users/{id}/status, que tiene sus salvaguardas;
      // por aquí el campo se descarta (antes acababa en un 500).
      const edited = await api<{ firstName: string }>(
        'PATCH',
        `/users/${person.id}`,
        {
          token: admin.token,
          body: { firstName: 'Renamed', isActive: false },
        },
      );
      assert.equal(edited.status, 200);
      assert.equal(edited.body.firstName, 'Renamed');
      const listed = await api<{ data: Array<{ isActive: boolean }> }>(
        'GET',
        `/users?q=${person.username}`,
        { token: admin.token },
      );
      assert.equal(listed.body.data[0]?.isActive, true, 'sigue activa');
    });

    it('una reserva cancelada ya no se reclama', async (t) => {
      if (!ready) return skip(t);
      const email = freshEmail('rgCancel');
      const assigned = await api<Assignment>('POST', '/admin/role-grants', {
        token: admin.token,
        body: { email, globalRole: 'GLOBAL_ADMIN' },
      });
      const id = assigned.body.reservation!.id;

      assert.equal(
        (
          await api('DELETE', `/admin/role-grants/${id}`, {
            token: orgAdmin.token,
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await api('DELETE', `/admin/role-grants/${id}`, {
            token: admin.token,
          })
        ).status,
        204,
      );
      assert.equal(
        (
          await api('DELETE', `/admin/role-grants/${id}`, {
            token: admin.token,
          })
        ).status,
        404,
      );

      const person = await registerUser('rgCancel', email);
      await verifyEmailOf(person.id);
      assert.equal((await me(person.token)).globalRole, 'USER');
    });

    // -- nivel organización --------------------------------------------------------

    it('sólo el ORG_ADMIN de la organización asigna roles en ella', async (t) => {
      if (!ready) return skip(t);
      const agent = await registerUser('rgAgent');
      const member = await registerUser('rgMember');
      const outsider = await registerUser('rgOutsider');
      await addMember(orgAdmin.token, organizationId, agent.username, 'AGENT');
      await addMember(
        orgAdmin.token,
        organizationId,
        member.username,
        'MEMBER',
      );
      const path = `/organizations/${organizationId}/role-grants`;
      const body = { email: freshEmail('rgOrgDenied'), role: 'MEMBER' };

      for (const user of [agent, member]) {
        assert.equal(
          (await api('POST', path, { token: user.token, body })).status,
          403,
        );
        assert.equal(
          (await api('GET', path, { token: user.token })).status,
          403,
          'las reservas son direcciones de no miembros: sólo las ve quien puede añadir miembros',
        );
      }
      // Quien no es miembro recibe 404, como en el resto de la organización.
      assert.equal(
        (await api('POST', path, { token: outsider.token, body })).status,
        404,
      );
      // Un GLOBAL_ADMIN puede actuar en cualquier organización.
      assert.equal(
        (await api('GET', path, { token: admin.token })).status,
        200,
      );
    });

    it('un correo sin cuenta se une a la organización al verificar, con el rol reservado', async (t) => {
      if (!ready) return skip(t);
      const email = freshEmail('rgJoin');
      const path = `/organizations/${organizationId}/role-grants`;

      const assigned = await api<Assignment>('POST', path, {
        token: orgAdmin.token,
        body: { email, role: 'AGENT' },
      });
      assert.equal(assigned.status, 201);
      assert.equal(assigned.body.outcome, 'RESERVED');

      const person = await registerUser('rgJoin', email);
      const beforeVerifying = await me(person.token);
      assert.equal(beforeVerifying.memberships.length, 0);
      assert.deepEqual(beforeVerifying.pendingRoles, [
        { scope: 'ORGANIZATION', role: 'AGENT', organizationName },
      ]);
      assert.equal(
        (
          await api('GET', `/organizations/${organizationId}`, {
            token: person.token,
          })
        ).status,
        404,
        'antes de verificar, la organización ni siquiera existe para esa cuenta',
      );

      await verifyEmailOf(person.id);
      const afterVerifying = await me(person.token);
      assert.deepEqual(
        afterVerifying.memberships.map(({ organizationId: id, role }) => ({
          id,
          role,
        })),
        [{ id: organizationId, role: 'AGENT' }],
      );
      assert.equal(
        (
          await api('GET', `/organizations/${organizationId}`, {
            token: person.token,
          })
        ).status,
        200,
      );
      const reservations = await api<Array<{ email: string }>>('GET', path, {
        token: orgAdmin.token,
      });
      assert.ok(!reservations.body.some((row) => row.email === email));
    });

    it('una cuenta verificada que no es miembro entra al instante', async (t) => {
      if (!ready) return skip(t);
      const person = await registerUser('rgVerified');
      await verifyEmailOf(person.id);
      const assigned = await api<Assignment>(
        'POST',
        `/organizations/${organizationId}/role-grants`,
        {
          token: orgAdmin.token,
          body: { email: person.email, role: 'MEMBER' },
        },
      );
      assert.equal(assigned.status, 200);
      assert.equal(assigned.body.outcome, 'APPLIED');
      assert.deepEqual(
        (await me(person.token)).memberships.map((m) => m.role),
        ['MEMBER'],
      );
    });

    it('a quien ya es miembro le cambia el rol al instante, y repetirlo no cambia nada', async (t) => {
      if (!ready) return skip(t);
      const person = await registerUser('rgPromote');
      await addMember(
        orgAdmin.token,
        organizationId,
        person.username,
        'MEMBER',
      );
      const path = `/organizations/${organizationId}/role-grants`;

      const promoted = await api<Assignment>('POST', path, {
        token: orgAdmin.token,
        body: { email: person.email, role: 'AGENT' },
      });
      assert.equal(promoted.status, 200);
      assert.equal(promoted.body.outcome, 'APPLIED');
      assert.equal((await me(person.token)).memberships[0]?.role, 'AGENT');

      const again = await api<Assignment>('POST', path, {
        token: orgAdmin.token,
        body: { email: person.email, role: 'AGENT' },
      });
      assert.equal(again.body.outcome, 'UNCHANGED');
    });

    it('la regla del último administrador también vale aquí', async (t) => {
      if (!ready) return skip(t);
      const organization = await createOrganization(orgAdmin.token);
      const response = await api<{ code: string }>(
        'POST',
        `/organizations/${organization}/role-grants`,
        {
          token: orgAdmin.token,
          body: { email: orgAdmin.email, role: 'MEMBER' },
        },
      );
      assert.equal(response.status, 409);
      assert.equal(response.body.code, 'ORG_LAST_ADMIN');
    });

    it('una cuenta borrada deja de figurar entre los miembros', async (t) => {
      if (!ready) return skip(t);
      const person = await registerUser('rgDeleted');
      await addMember(orgAdmin.token, organizationId, person.username, 'AGENT');
      assert.equal(
        (await api('DELETE', `/users/${person.id}`, { token: admin.token }))
          .status,
        204,
      );
      const members = await api<Array<{ user: { id: string } }>>(
        'GET',
        `/organizations/${organizationId}/members`,
        { token: orgAdmin.token },
      );
      assert.ok(!members.body.some((row) => row.user.id === person.id));
    });

    it('un administrador borrado no cuenta para la regla del último administrador', async (t) => {
      if (!ready) return skip(t);
      const organization = await createOrganization(orgAdmin.token);
      const coAdmin = await registerUser('rgCoAdmin');
      await addMember(
        orgAdmin.token,
        organization,
        coAdmin.username,
        'ORG_ADMIN',
      );
      // Con dos administradores vivos, uno puede dejar de serlo...
      const path = `/organizations/${organization}/members/${orgAdmin.id}`;
      // ...pero si el otro borra su cuenta, el que queda es el último.
      assert.equal(
        (await api('DELETE', `/users/${coAdmin.id}`, { token: admin.token }))
          .status,
        204,
      );
      const demoted = await api<{ code: string }>('PATCH', path, {
        token: orgAdmin.token,
        body: { role: 'MEMBER' },
      });
      assert.equal(
        demoted.status,
        409,
        'la organización se quedaría sin nadie que la gestione',
      );
      assert.equal(demoted.body.code, 'ORG_LAST_ADMIN');
      // Irse tampoco: aquí lo rechaza la política `member:leave` (403).
      const left = await api<{ code: string }>(
        'POST',
        `/organizations/${organization}/leave`,
        { token: orgAdmin.token },
      );
      assert.equal(left.status, 403);
      assert.equal(left.body.code, 'RBAC_FORBIDDEN');
    });

    it('volver a dar un rol a una dirección reservada la actualiza, no la duplica', async (t) => {
      if (!ready) return skip(t);
      const email = freshEmail('rgTwice');
      const path = `/organizations/${organizationId}/role-grants`;
      const first = await api<Assignment>('POST', path, {
        token: orgAdmin.token,
        body: { email, role: 'MEMBER' },
      });
      const second = await api<Assignment>('POST', path, {
        token: orgAdmin.token,
        body: { email, role: 'ORG_ADMIN' },
      });
      assert.equal(second.status, 201);
      assert.equal(second.body.reservation?.id, first.body.reservation?.id);

      const listed = await api<Array<{ email: string; role: string }>>(
        'GET',
        path,
        { token: orgAdmin.token },
      );
      assert.deepEqual(
        listed.body.filter((row) => row.email === email).map((row) => row.role),
        ['ORG_ADMIN'],
      );

      // Al verificar llega el ÚLTIMO rol dado, no el primero.
      const person = await registerUser('rgTwice', email);
      await verifyEmailOf(person.id);
      const joined = (await me(person.token)).memberships.find(
        (row) => row.organizationId === organizationId,
      );
      assert.equal(joined?.role, 'ORG_ADMIN');
    });

    it('un GLOBAL_ADMIN gestiona las reservas de cualquier organización', async (t) => {
      if (!ready) return skip(t);
      const path = `/organizations/${organizationId}/role-grants`;
      const assigned = await api<Assignment>('POST', path, {
        token: admin.token,
        body: { email: freshEmail('rgByAdmin'), role: 'AGENT' },
      });
      assert.equal(assigned.status, 201, 'sin ser miembro de la organización');
      assert.equal(
        (
          await api('DELETE', `${path}/${assigned.body.reservation!.id}`, {
            token: admin.token,
          })
        ).status,
        204,
      );
    });

    it('la auditoría registra la reserva, su cancelación y su reclamación', async (t) => {
      if (!ready) return skip(t);
      type Entries = {
        data: Array<{
          action: string;
          entity: string;
          actor: { id: string } | null;
        }>;
      };
      const audit = (query: string) =>
        api<Entries>('GET', `/admin/audit-logs?${query}`, {
          token: admin.token,
        });

      // Reservada y cancelada (plataforma).
      const cancelled = await api<Assignment>('POST', '/admin/role-grants', {
        token: admin.token,
        body: { email: freshEmail('rgAuditC'), globalRole: 'GLOBAL_ADMIN' },
      });
      const grantId = cancelled.body.reservation!.id;
      await api('DELETE', `/admin/role-grants/${grantId}`, {
        token: admin.token,
      });
      const trail = await eventually(
        () => audit(`entityId=${grantId}`),
        (response) => response.body.data.length >= 2,
      );
      assert.deepEqual(
        trail.body.data.map((entry) => [entry.action, entry.entity]).sort(),
        [
          ['role.reservation.cancelled', 'PlatformRoleGrant'],
          ['role.reserved', 'PlatformRoleGrant'],
        ],
      );
      assert.ok(trail.body.data.every((entry) => entry.actor?.id === admin.id));

      // Reservada y reclamada al verificar (organización).
      const email = freshEmail('rgAuditJ');
      const reserved = await api<Assignment>(
        'POST',
        `/organizations/${organizationId}/role-grants`,
        { token: orgAdmin.token, body: { email, role: 'MEMBER' } },
      );
      assert.deepEqual(
        (
          await eventually(
            () => audit(`entityId=${reserved.body.reservation!.id}`),
            (response) => response.body.data.length >= 1,
          )
        ).body.data.map((entry) => entry.action),
        ['role.reserved'],
      );
      const person = await registerUser('rgAuditJ', email);
      await verifyEmailOf(person.id);
      const claimed = await eventually(
        () =>
          audit(`action=role.reservation.claimed&entityId=${organizationId}`),
        (response) => response.body.data.length >= 1,
      );
      assert.ok(
        claimed.body.data.some(
          (entry) => entry.entity === 'OrganizationMember',
        ),
        'la llegada del rol al verificar también queda registrada',
      );
    });

    it('una reserva de otra organización no se puede cancelar desde la propia', async (t) => {
      if (!ready) return skip(t);
      const assigned = await api<Assignment>(
        'POST',
        `/organizations/${organizationId}/role-grants`,
        {
          token: orgAdmin.token,
          body: { email: freshEmail('rgForeign'), role: 'MEMBER' },
        },
      );
      const id = assigned.body.reservation!.id;

      const otherAdmin = await registerUser('rgOtherAdmin');
      const otherOrganization = await createOrganization(otherAdmin.token);
      assert.equal(
        (
          await api(
            'DELETE',
            `/organizations/${otherOrganization}/role-grants/${id}`,
            { token: otherAdmin.token },
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await api(
            'DELETE',
            `/organizations/${organizationId}/role-grants/${id}`,
            { token: orgAdmin.token },
          )
        ).status,
        204,
      );
    });
  },
);
