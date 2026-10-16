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
 * Acciones simultáneas sobre el mismo ticket.
 *
 * El enunciado lo pide dentro del soporte multiusuario obligatorio: «No data
 * corruption or race conditions occur with simultaneous user actions». El
 * cambio de estado y la asignación leían el ticket, lo comprobaban y lo
 * actualizaban después sin condición, así que dos peticiones a la vez pasaban
 * las dos la comprobación: el historial registraba dos veces la misma
 * transición, o dos «primeros» responsables. Estas pruebas disparan las
 * peticiones a la vez y miran el historial.
 */
const SIMULTANEAS = 8;

describe(
  'integración · acciones simultáneas sobre un ticket',
  { concurrency: false },
  () => {
    let up = false;
    let admin: TestUser;
    let member: TestUser;
    let agents: TestUser[] = [];
    let organizationId = '';

    before(async () => {
      up = await apiIsUp();
      if (!up) return;
      admin = await registerUser('simAdmin');
      member = await registerUser('simMember');
      agents = [await registerUser('simAg1'), await registerUser('simAg2')];
      organizationId = await createOrganization(admin.token);
      await addMember(admin.token, organizationId, member.username, 'MEMBER');
      for (const agent of agents)
        await addMember(admin.token, organizationId, agent.username, 'AGENT');
    });

    async function historial(ticketId: string, field: string) {
      const response = await api<
        Array<{
          field: string;
          oldValue: string | null;
          newValue: string | null;
        }>
      >('GET', `/tickets/${ticketId}/history`, { token: admin.token });
      assert.equal(response.status, 200);
      return response.body.filter((entry) => entry.field === field);
    }

    it('de varios cambios de estado simultáneos, sólo uno se aplica y se registra', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const ticket = await createTicket(member.token, organizationId);

      const answers = await Promise.all(
        Array.from({ length: SIMULTANEAS }, (_, i) =>
          api<{ code: string }>('PATCH', `/tickets/${ticket.id}/status`, {
            token: agents[i % agents.length]!.token,
            body: { status: 'IN_PROGRESS' },
          }),
        ),
      );

      const ganadoras = answers.filter((answer) => answer.status === 200);
      assert.equal(
        ganadoras.length,
        1,
        `una sola se aplica: ${answers.map((a) => a.status).join(' ')}`,
      );
      for (const answer of answers.filter((a) => a.status !== 200)) {
        // Quien leyó el estado antes que la ganadora pierde la carrera; quien
        // lo leyó después ya ve IN_PROGRESS, y no hay transición a sí mismo.
        assert.equal(answer.status, 409);
        assert.ok(
          ['TICKET_CHANGED', 'TICKET_INVALID_TRANSITION'].includes(
            answer.body.code,
          ),
          answer.body.code,
        );
      }
      const transiciones = (await historial(ticket.id, 'status')).filter(
        (entry) => entry.newValue === 'IN_PROGRESS',
      );
      assert.deepEqual(
        transiciones.map((entry) => `${entry.oldValue} -> ${entry.newValue}`),
        ['OPEN -> IN_PROGRESS'],
        'el historial registra la transición una vez',
      );
    });

    it('dos agentes que se asignan el ticket a la vez no quedan los dos como primer responsable', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const ticket = await createTicket(member.token, organizationId);

      const answers = await Promise.all(
        Array.from({ length: SIMULTANEAS }, (_, i) => {
          const agent = agents[i % agents.length]!;
          return api<{ code: string }>(
            'PATCH',
            `/tickets/${ticket.id}/assignee`,
            { token: agent.token, body: { assigneeId: agent.id } },
          );
        }),
      );

      for (const answer of answers)
        assert.ok(
          answer.status === 200 ||
            (answer.status === 409 && answer.body.code === 'TICKET_CHANGED'),
          `${answer.status} ${answer.body.code}`,
        );
      // Sin responsable sólo se parte una vez: las demás asignaciones que se
      // aplican parten del responsable que dejó la anterior.
      const desdeNadie = (await historial(ticket.id, 'assignee')).filter(
        (entry) => entry.oldValue === null,
      );
      assert.equal(desdeNadie.length, 1);
    });
  },
);
