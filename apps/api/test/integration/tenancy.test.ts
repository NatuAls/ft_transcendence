import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  addMember,
  api,
  apiIsUp,
  createOrganization,
  createTicket,
  multipart,
  PNG_1X1,
  registerUser,
  SKIP_MESSAGE,
  type TestUser,
} from './helpers.ts';

/**
 * Lo que una respuesta deja saber, sin lo que cambia en cada petición (la
 * ruta, el `requestId`, la hora). Dos huellas iguales no se pueden distinguir.
 */
function huella(response: { status: number; body: unknown }) {
  const body = (response.body ?? {}) as Record<string, unknown>;
  return {
    status: response.status,
    code: body['code'],
    messageKey: body['messageKey'],
    message: body['message'],
  };
}

/**
 * Cada intento sobre lo ajeno contesta exactamente lo mismo que el mismo
 * intento sobre un identificador inventado, y es un 404: «no existe».
 */
async function mismaRespuesta(
  token: string,
  ajenos: Array<[string, string, unknown?]>,
  inventados: Array<[string, string, unknown?]>,
) {
  for (const [i, [method, path, body]] of ajenos.entries()) {
    const [, pathInventado, bodyInventado] = inventados[i]!;
    const ajeno = await api(method, path, { token, body });
    const inventado = await api(method, pathInventado, {
      token,
      body: bodyInventado,
    });
    assert.deepEqual(
      huella(ajeno),
      huella(inventado),
      `${method} ${path} no puede distinguirse de un recurso que no existe`,
    );
    assert.equal(ajeno.status, 404, `${method} ${path}`);
  }
}

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
    let otherMemberOfA: TestUser;
    let agentOfA: TestUser;
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
      otherMemberOfA = await registerUser('tenM2');
      agentOfA = await registerUser('tenAg');
      adminOfB = await registerUser('tenB');

      orgA = await createOrganization(adminOfA.token);
      orgB = await createOrganization(adminOfB.token);
      await addMember(adminOfA.token, orgA, memberOfA.username, 'MEMBER');
      await addMember(adminOfA.token, orgA, otherMemberOfA.username, 'MEMBER');
      await addMember(adminOfA.token, orgA, agentOfA.username, 'AGENT');

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
      // Y la respuesta es la de un ticket que no existe, idéntica: un 403, o un
      // 404 con otro código («no eres miembro»), confirmaba que éste existe.
      const attempts = (id: string): Array<[string, string, unknown?]> => [
        ['GET', `/tickets/${id}`],
        ['GET', `/tickets/${id}/history`],
        ['GET', `/tickets/${id}/comments`],
        ['GET', `/tickets/${id}/attachments`],
        ['PATCH', `/tickets/${id}`, { priority: 'LOW' }],
        ['DELETE', `/tickets/${id}`],
        ['POST', `/tickets/${id}/comments`, { body: 'intruso' }],
      ];
      await mismaRespuesta(
        memberOfA.token,
        attempts(ticketOfB),
        attempts(randomUUID()),
      );
    });

    it('un MEMBER tampoco distingue el ticket de un compañero de uno que no existe', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const attempts = (id: string): Array<[string, string, unknown?]> => [
        ['GET', `/tickets/${id}`],
        ['GET', `/tickets/${id}/comments`],
        ['GET', `/tickets/${id}/attachments`],
      ];
      await mismaRespuesta(
        otherMemberOfA.token,
        attempts(ticketOfA),
        attempts(randomUUID()),
      );
    });

    it('los adjuntos ajenos tampoco: ni se suben ni se descargan', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const adjunto = await api<{ id: string }>(
        'POST',
        `/tickets/${ticketOfB}/attachments`,
        { token: adminOfB.token, ...multipart('b.png', 'image/png', PNG_1X1) },
      );
      assert.equal(adjunto.status, 201);

      const subir = (id: string) =>
        api('POST', `/tickets/${id}/attachments`, {
          token: memberOfA.token,
          ...multipart('intruso.png', 'image/png', PNG_1X1),
        });
      assert.deepEqual(
        huella(await subir(ticketOfB)),
        huella(await subir(randomUUID())),
        'subir a un ticket ajeno contesta como si no existiese',
      );
      await mismaRespuesta(
        memberOfA.token,
        [['GET', `/attachments/${adjunto.body.id}`]],
        [['GET', `/attachments/${randomUUID()}`]],
      );
    });

    it('el adjunto de una nota interna no existe para el autor del ticket', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      // El autor (MEMBER) lee su ticket, pero no las notas internas: tampoco lo
      // que cuelga de ellas, aunque tenga el identificador.
      const nota = await api<{ id: string }>(
        'POST',
        `/tickets/${ticketOfA}/comments`,
        {
          token: agentOfA.token,
          body: { body: 'Nota interna con una captura', isInternal: true },
        },
      );
      assert.equal(nota.status, 201);
      const adjunto = await api<{ id: string }>(
        'POST',
        `/tickets/${ticketOfA}/comments/${nota.body.id}/attachments`,
        {
          token: agentOfA.token,
          ...multipart('nota.png', 'image/png', PNG_1X1),
        },
      );
      assert.equal(adjunto.status, 201);

      await mismaRespuesta(
        memberOfA.token,
        [['GET', `/attachments/${adjunto.body.id}`]],
        [['GET', `/attachments/${randomUUID()}`]],
      );
      const subir = (comentario: string) =>
        api(
          'POST',
          `/tickets/${ticketOfA}/comments/${comentario}/attachments`,
          {
            token: memberOfA.token,
            ...multipart('autor.png', 'image/png', PNG_1X1),
          },
        );
      assert.deepEqual(
        huella(await subir(nota.body.id)),
        huella(await subir(randomUUID())),
        'colgar un fichero de la nota interna contesta como si no existiese',
      );
      // Quien sí ve las notas internas lo descarga.
      const descarga = await api('GET', `/attachments/${adjunto.body.id}`, {
        token: agentOfA.token,
      });
      assert.equal(descarga.status, 200);
    });

    it('una clave de la API pública tampoco distingue un ticket ajeno de uno que no existe', async (t) => {
      if (!up) return t.skip(SKIP_MESSAGE);
      const clave = await api<{ secret: string }>(
        'POST',
        `/organizations/${orgA}/api-keys`,
        {
          token: adminOfA.token,
          body: { name: 'aislamiento', scopes: ['tickets:read'] },
        },
      );
      assert.equal(clave.status, 201);
      const leer = (id: string) =>
        api('GET', `/public/tickets/${id}`, { apiKey: clave.body.secret });
      assert.deepEqual(
        huella(await leer(ticketOfB)),
        huella(await leer(randomUUID())),
      );
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
      // Lo que no le sale en la lista no existe para él: 404, no 403.
      assert.equal(
        (await api('GET', `/tickets/${ajeno}`, { token: miembro.token }))
          .status,
        404,
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
