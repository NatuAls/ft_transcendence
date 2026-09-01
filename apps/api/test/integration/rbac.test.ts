import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMember,
  api,
  apiIsUp,
  createOrganization,
  createTicket,
  registerUser,
  SKIP_MESSAGE,
  type TestUser,
} from './helpers.ts';

/**
 * La matriz RBAC, comprobada sobre HTTP.
 *
 * `test/unit/policies.test.ts` ya verifica `evaluatePolicy()` como función
 * pura. Lo que no puede verificar es que la cadena real —`authed` ->
 * `orgScope()` -> `requirePolicy()` -> servicio— aplique esa matriz, ni que las
 * comprobaciones a nivel de registro (propiedad del ticket, estado del ticket,
 * ventana de edición del comentario) se hagan donde toca. Eso es lo que cubren
 * estas pruebas: las celdas ❌ de la matriz, ejercidas de verdad contra la API.
 */
describe('integración · matriz RBAC sobre HTTP', { concurrency: false }, () => {
  let up = false;
  let orgAdmin: TestUser;
  let agent: TestUser;
  let member: TestUser;
  let otherMember: TestUser;
  let organizationId = '';
  let categoryId = '';

  before(async () => {
    up = await apiIsUp();
    if (!up) return;

    orgAdmin = await registerUser('rbacAdmin');
    agent = await registerUser('rbacAgent');
    member = await registerUser('rbacMember');
    otherMember = await registerUser('rbacOther');

    organizationId = await createOrganization(orgAdmin.token);
    await addMember(orgAdmin.token, organizationId, agent.username, 'AGENT');
    await addMember(orgAdmin.token, organizationId, member.username, 'MEMBER');
    await addMember(
      orgAdmin.token,
      organizationId,
      otherMember.username,
      'MEMBER',
    );

    const category = await api<{ id: string }>(
      'POST',
      `/organizations/${organizationId}/categories`,
      { token: orgAdmin.token, body: { name: `Cat ${Date.now()}` } },
    );
    categoryId = category.body.id;
  });

  // -- organización y miembros ------------------------------------------------

  it('solo ORG_ADMIN administra la organización', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);

    assert.equal(
      (
        await api('PATCH', `/organizations/${organizationId}`, {
          token: member.token,
          body: { description: 'no deberia' },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await api('PATCH', `/organizations/${organizationId}`, {
          token: agent.token,
          body: { description: 'tampoco' },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await api('PATCH', `/organizations/${organizationId}`, {
          token: orgAdmin.token,
          body: { description: 'sí' },
        })
      ).status,
      200,
    );
  });

  it('solo ORG_ADMIN invita y cambia roles', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const outsider = await registerUser('rbacInv');

    for (const actor of [member, agent]) {
      assert.equal(
        (
          await api('POST', `/organizations/${organizationId}/members`, {
            token: actor.token,
            body: { identifier: outsider.username },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await api(
            'PATCH',
            `/organizations/${organizationId}/members/${member.id}`,
            { token: actor.token, body: { role: 'ORG_ADMIN' } },
          )
        ).status,
        403,
      );
    }
  });

  it('solo ORG_ADMIN escribe categorías; cualquier miembro las lee', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    assert.equal(
      (
        await api('GET', `/organizations/${organizationId}/categories`, {
          token: member.token,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api('POST', `/organizations/${organizationId}/categories`, {
          token: member.token,
          body: { name: 'No permitida' },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await api(
          'DELETE',
          `/organizations/${organizationId}/categories/${categoryId}`,
          { token: agent.token },
        )
      ).status,
      403,
    );
  });

  it('las estadísticas requieren al menos AGENT', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    assert.equal(
      (
        await api('GET', `/organizations/${organizationId}/stats`, {
          token: member.token,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await api('GET', `/organizations/${organizationId}/stats`, {
          token: agent.token,
        })
      ).status,
      200,
    );
  });

  it('las claves de API son cosa de ORG_ADMIN', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    for (const actor of [member, agent]) {
      const response = await api(
        'POST',
        `/organizations/${organizationId}/api-keys`,
        {
          token: actor.token,
          body: { name: 'clave', scopes: ['tickets:read'] },
        },
      );
      assert.equal(response.status, 403);
    }
  });

  // -- tickets ----------------------------------------------------------------

  it('el autor edita su ticket solo mientras siga OPEN', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const ticket = await createTicket(member.token, organizationId);

    assert.equal(
      (
        await api('PATCH', `/tickets/${ticket.id}`, {
          token: member.token,
          body: { priority: 'HIGH' },
        })
      ).status,
      200,
      'mientras está OPEN, el autor puede editarlo',
    );

    await api('PATCH', `/tickets/${ticket.id}/status`, {
      token: agent.token,
      body: { status: 'IN_PROGRESS' },
    });

    assert.equal(
      (
        await api('PATCH', `/tickets/${ticket.id}`, {
          token: member.token,
          body: { priority: 'LOW' },
        })
      ).status,
      403,
      'una vez en curso, el autor ya no lo edita',
    );
  });

  it('un miembro cualquiera no toca el ticket de otro', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const ticket = await createTicket(member.token, organizationId);

    assert.equal(
      (await api('GET', `/tickets/${ticket.id}`, { token: otherMember.token }))
        .status,
      403,
      'un MEMBER solo ve los tickets de los que es autor',
    );
    assert.equal(
      (
        await api('PATCH', `/tickets/${ticket.id}`, {
          token: otherMember.token,
          body: { priority: 'LOW' },
        })
      ).status,
      403,
    );
    assert.equal(
      (await api('DELETE', `/tickets/${ticket.id}`, { token: member.token }))
        .status,
      403,
      'borrar un ticket es de ORG_ADMIN, ni siquiera el autor puede',
    );
  });

  it('el autor solo puede hacer la confirmación RESOLVED -> CLOSED', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const ticket = await createTicket(member.token, organizationId);

    assert.equal(
      (
        await api('PATCH', `/tickets/${ticket.id}/status`, {
          token: member.token,
          body: { status: 'IN_PROGRESS' },
        })
      ).status,
      403,
      'el autor no mueve el ticket a IN_PROGRESS',
    );

    await api('PATCH', `/tickets/${ticket.id}/status`, {
      token: agent.token,
      body: { status: 'IN_PROGRESS' },
    });
    await api('PATCH', `/tickets/${ticket.id}/status`, {
      token: agent.token,
      body: {
        status: 'RESOLVED',
        resolution: 'Resuelto durante la prueba de integración automatizada.',
      },
    });

    assert.equal(
      (
        await api('PATCH', `/tickets/${ticket.id}/status`, {
          token: member.token,
          body: { status: 'CLOSED' },
        })
      ).status,
      200,
      'esa confirmación sí le corresponde al autor',
    );
  });

  it('la máquina de estados rechaza las transiciones ilegales', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const ticket = await createTicket(member.token, organizationId);

    const illegal = await api<{ code: string }>(
      'PATCH',
      `/tickets/${ticket.id}/status`,
      {
        token: agent.token,
        body: { status: 'RESOLVED', resolution: 'x'.repeat(30) },
      },
    );
    assert.equal(illegal.status, 409);
    assert.equal(illegal.body.code, 'TICKET_INVALID_TRANSITION');
  });

  it('resolver exige una explicación de al menos 20 caracteres', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const ticket = await createTicket(member.token, organizationId);
    await api('PATCH', `/tickets/${ticket.id}/status`, {
      token: agent.token,
      body: { status: 'IN_PROGRESS' },
    });

    const noResolution = await api('PATCH', `/tickets/${ticket.id}/status`, {
      token: agent.token,
      body: { status: 'RESOLVED' },
    });
    assert.equal(noResolution.status, 400);
  });

  it('asignar a alguien que no es agente devuelve 422', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const ticket = await createTicket(member.token, organizationId);
    const response = await api<{ code: string }>(
      'PATCH',
      `/tickets/${ticket.id}/assignee`,
      { token: orgAdmin.token, body: { assigneeId: member.id } },
    );
    assert.equal(response.status, 422);
    assert.equal(response.body.code, 'TICKET_ASSIGNEE_NOT_AGENT');
  });

  // -- notas internas ---------------------------------------------------------

  it('las notas internas son solo para AGENT y ORG_ADMIN', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const ticket = await createTicket(member.token, organizationId);

    assert.equal(
      (
        await api('POST', `/tickets/${ticket.id}/comments`, {
          token: member.token,
          body: { body: 'quiero una nota interna', isInternal: true },
        })
      ).status,
      403,
    );

    const internal = await api('POST', `/tickets/${ticket.id}/comments`, {
      token: agent.token,
      body: { body: 'Nota interna: revisar el disco.', isInternal: true },
    });
    assert.equal(internal.status, 201);

    const asMember = await api<Array<{ isInternal: boolean }>>(
      'GET',
      `/tickets/${ticket.id}/comments`,
      { token: member.token },
    );
    assert.ok(
      !asMember.body.some((comment) => comment.isInternal),
      'el autor del ticket no debe ver las notas internas',
    );

    const asAgent = await api<Array<{ isInternal: boolean }>>(
      'GET',
      `/tickets/${ticket.id}/comments`,
      { token: agent.token },
    );
    assert.ok(asAgent.body.some((comment) => comment.isInternal));
  });

  // -- plataforma -------------------------------------------------------------

  it('las rutas de administración global exigen GLOBAL_ADMIN', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    for (const path of ['/admin/stats', '/admin/audit-logs', '/users']) {
      assert.equal(
        (await api('GET', path, { token: orgAdmin.token })).status,
        403,
        `${path} no puede abrirse con un rol de organización`,
      );
      assert.equal(
        (await api('GET', path)).status,
        401,
        `${path} sin sesión debe ser 401`,
      );
    }
  });

  it('nadie se auto-promociona por el cuerpo de la petición', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    await api('PATCH', '/users/me', {
      token: member.token,
      body: {
        firstName: 'Intento',
        globalRole: 'GLOBAL_ADMIN',
        isActive: true,
      },
    });
    const me = await api<{ globalRole: string }>('GET', '/auth/me', {
      token: member.token,
    });
    assert.equal(me.body.globalRole, 'USER');
  });
});
