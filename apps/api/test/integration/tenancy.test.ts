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
 * Aislamiento multi-inquilino.
 *
 * El escenario es siempre el mismo: dos organizaciones sin nada en común, A y
 * B, y un miembro de A intentando llegar a los datos de B por todas las
 * puertas que la API expone.
 *
 * La prueba que da nombre a este fichero es la de `GET /tickets?organizationId=`:
 * el servicio de búsqueda trataba ese parámetro como una **alternativa** al
 * filtro de membresías en lugar de como un filtro que hay que **intersecar**
 * con ellas, de modo que cualquier usuario autenticado podía leer los tickets
 * de otra organización —título, referencia, autor y responsable— sin más que
 * poner su identificador en la query string. `GET /tickets` no lleva
 * `orgScope()` precisamente porque el aislamiento vive dentro del servicio.
 */
describe(
  'integración · aislamiento entre organizaciones',
  { concurrency: false },
  () => {
    let up = false;
    let memberOfA: TestUser;
    let adminOfA: TestUser;
    let adminOfB: TestUser;
    let orgA = '';
    let orgB = '';
    let ticketOfB = '';
    let ticketOfA = '';

    before(async () => {
      up = await apiIsUp();
      if (!up) return;

      adminOfA = await registerUser('tenA');
      memberOfA = await registerUser('tenM');
      adminOfB = await registerUser('tenB');

      orgA = await createOrganization(adminOfA.token);
      orgB = await createOrganization(adminOfB.token);
      await addMember(adminOfA.token, orgA, memberOfA.username, 'MEMBER');

      ticketOfA = (await createTicket(memberOfA.token, orgA)).id;
      ticketOfB = (
        await createTicket(adminOfB.token, orgB, {
          title: 'Incidencia reservada de la organizacion B',
          description:
            'Contenido que ningun miembro de la organizacion A deberia poder leer nunca.',
        })
      ).id;
    });

    it('la búsqueda no acepta organizationId como salvoconducto', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);

      const response = await api<{
        data?: Array<{ id: string }>;
        code?: string;
      }>('GET', `/tickets?organizationId=${orgB}`, { token: memberOfA.token });

      assert.equal(
        response.status,
        404,
        'pedir otra organización responde 404, igual que orgScope, para no confirmar que existe',
      );
      assert.ok(
        !(response.body.data ?? []).some((ticket) => ticket.id === ticketOfB),
        'ni un solo ticket de la otra organización puede aparecer',
      );
    });

    it('la búsqueda propia sigue funcionando con el filtro de organización', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const response = await api<{ data: Array<{ id: string }> }>(
        'GET',
        `/tickets?organizationId=${orgA}`,
        { token: memberOfA.token },
      );
      assert.equal(response.status, 200);
      assert.ok(response.body.data.some((ticket) => ticket.id === ticketOfA));
    });

    it('la búsqueda por texto tampoco cruza organizaciones', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const response = await api<{ data: Array<{ id: string }> }>(
        'GET',
        '/tickets?q=reservada',
        { token: memberOfA.token },
      );
      assert.equal(response.status, 200);
      assert.ok(
        !response.body.data.some((ticket) => ticket.id === ticketOfB),
        'el índice de texto completo se consulta con el filtro de organizaciones ya aplicado',
      );
    });

    it('un no miembro recibe 404, nunca 403, en la organización ajena', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      // 403 confirmaría que el recurso existe: es una fuga entre inquilinos.
      for (const path of [
        `/organizations/${orgB}`,
        `/organizations/${orgB}/members`,
        `/organizations/${orgB}/categories`,
        `/organizations/${orgB}/stats`,
        `/organizations/${orgB}/api-keys`,
      ]) {
        const response = await api('GET', path, { token: memberOfA.token });
        assert.equal(response.status, 404, `${path} debería responder 404`);
      }
    });

    it('los tickets ajenos no se leen, ni se editan, ni se comentan', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const attempts: Array<[string, string, unknown?]> = [
        ['GET', `/tickets/${ticketOfB}`],
        ['GET', `/tickets/${ticketOfB}/history`],
        ['GET', `/tickets/${ticketOfB}/comments`],
        ['GET', `/tickets/${ticketOfB}/attachments`],
        ['PATCH', `/tickets/${ticketOfB}`, { priority: 'LOW' }],
        ['DELETE', `/tickets/${ticketOfB}`],
        ['POST', `/tickets/${ticketOfB}/comments`, { body: 'intruso' }],
      ];
      for (const [method, path, body] of attempts) {
        const response = await api(method, path, {
          token: memberOfA.token,
          body,
        });
        assert.ok(
          response.status === 403 || response.status === 404,
          `${method} ${path} devolvió ${response.status}`,
        );
      }
    });

    it('crear un ticket en una organización ajena no cuela', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const response = await api('POST', '/tickets', {
        token: memberOfA.token,
        body: {
          organizationId: orgB,
          title: 'Ticket colado desde otra organizacion',
          description:
            'Descripcion suficientemente larga para pasar el contrato.',
        },
      });
      assert.equal(response.status, 404);
    });
  },
);

/**
 * El aislamiento no acaba en la organización: dentro de ella manda el rol.
 *
 * `GET /tickets/:id` ya comprobaba `ticket:read` contra el dueño del ticket,
 * pero la LISTA sólo filtraba por organización. Resultado: un MEMBER recibía
 * en `GET /tickets` los títulos de los tickets de sus compañeros —autor,
 * referencia, estado— y sólo se topaba con el 403 al intentar abrir uno. Se
 * vio el 08/10 comparando lo que ve cada rol en el entorno local.
 *
 * El caso que más fácil se rompe es el último: ser AGENT en una organización
 * y MEMBER en otra. La respuesta tiene que traer todos los de la primera y
 * sólo los propios de la segunda, no una cosa o la otra.
 */
describe(
  'integración · dentro de la organización, el rol decide qué se lista',
  { concurrency: false },
  () => {
    let up = false;
    let admin: TestUser;
    let miembro: TestUser;
    let agente: TestUser;
    let organizacion = '';
    let ajeno = '';
    let propio = '';

    before(async () => {
      up = await apiIsUp();
      if (!up) return;
      admin = await registerUser('rolAdmin');
      miembro = await registerUser('rolMiembro');
      agente = await registerUser('rolAgente');
      organizacion = await createOrganization(admin.token);
      await addMember(admin.token, organizacion, miembro.username, 'MEMBER');
      await addMember(admin.token, organizacion, agente.username, 'AGENT');
      ajeno = (await createTicket(admin.token, organizacion)).id;
      propio = (await createTicket(miembro.token, organizacion)).id;
    });

    const listaDe = async (token: string) => {
      const respuesta = await api<{ data: Array<{ id: string }> }>(
        'GET',
        '/tickets?take=100',
        { token },
      );
      assert.equal(respuesta.status, 200);
      return respuesta.body.data.map((fila) => fila.id);
    };

    it('un MEMBER no recibe en la lista los tickets de otros', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const vistos = await listaDe(miembro.token);
      assert.ok(
        vistos.includes(propio),
        'tiene que seguir viendo los suyos, o la prueba no comprueba nada',
      );
      assert.ok(
        !vistos.includes(ajeno),
        'la lista le estaba dando el ticket de otra persona',
      );
    });

    it('y lo que no lista, tampoco lo abre: las dos puertas dicen lo mismo', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      assert.equal(
        (await api('GET', `/tickets/${ajeno}`, { token: miembro.token }))
          .status,
        403,
      );
      assert.equal(
        (await api('GET', `/tickets/${propio}`, { token: miembro.token }))
          .status,
        200,
      );
    });

    it('un AGENT sí los ve todos: es la diferencia entre los dos roles', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const vistos = await listaDe(agente.token);
      assert.ok(vistos.includes(ajeno));
      assert.ok(vistos.includes(propio));
    });

    it('AGENT en una y MEMBER en otra: cada organización con su criterio', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const segunda = await createOrganization(admin.token);
      await addMember(admin.token, segunda, agente.username, 'MEMBER');
      const ajenoDeLaSegunda = (await createTicket(admin.token, segunda)).id;
      const propioDeLaSegunda = (await createTicket(agente.token, segunda)).id;

      const vistos = await listaDe(agente.token);
      // En la primera es AGENT: los ve todos.
      assert.ok(
        vistos.includes(ajeno),
        'perdió los de la organización en la que es AGENT',
      );
      // En la segunda es MEMBER: sólo los suyos.
      assert.ok(vistos.includes(propioDeLaSegunda));
      assert.ok(
        !vistos.includes(ajenoDeLaSegunda),
        'se coló un ticket ajeno de la organización en la que sólo es miembro',
      );
    });
  },
);
