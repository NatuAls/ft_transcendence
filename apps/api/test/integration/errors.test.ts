import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  api,
  apiIsUp,
  BASE_URL,
  createOrganization,
  createTicket,
  multipart,
  PASSWORD,
  PNG_1X1,
  registerUser,
  SKIP_MESSAGE,
  V1,
  type TestUser,
} from './helpers.ts';

interface ErrorBody {
  statusCode: number;
  code: string;
  messageKey: string;
  message: string;
  requestId: string;
  timestamp: string;
  path: string;
}

/**
 * El contrato de errores.
 *
 * El frontend interpreta **toda** respuesta fallida como `ApiErrorBody` y
 * traduce `messageKey`. Cualquier fallo que se escape de ese molde —una página
 * HTML de Express, un 500 genérico donde correspondía un 400— rompe el cliente
 * y, en el caso del 500, ensucia los logs con trazas por peticiones que solo
 * estaban mal escritas.
 *
 * Estas pruebas fijan los cuatro casos que se salían del molde: URL
 * inexistente, cuerpo demasiado grande, JSON malformado e identificador que no
 * es un UUID.
 */
describe('integración · envoltorio de errores', { concurrency: false }, () => {
  let up = false;
  let user: TestUser;
  let ticketId = '';

  before(async () => {
    up = await apiIsUp();
    if (!up) return;
    user = await registerUser('err');
    const organizationId = await createOrganization(user.token);
    ticketId = (await createTicket(user.token, organizationId)).id;
  });

  function assertEnvelope(body: ErrorBody, status: number): void {
    assert.equal(body.statusCode, status);
    assert.ok(body.code, 'falta `code`');
    assert.ok(body.messageKey?.startsWith('errors.'), 'falta `messageKey`');
    assert.ok(
      body.requestId && body.requestId !== 'unknown',
      'falta `requestId`',
    );
    assert.ok(body.timestamp, 'falta `timestamp`');
    assert.ok(body.path, 'falta `path`');
  }

  it('una URL inexistente devuelve JSON, no la página HTML de Express', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const response = await api<ErrorBody>('GET', '/ruta-que-no-existe');
    assert.equal(response.status, 404);
    assert.match(
      response.headers.get('content-type') ?? '',
      /application\/json/,
      'debe responder JSON: el cliente no sabe leer HTML',
    );
    assert.equal(response.body.code, 'ROUTE_NOT_FOUND');
    assertEnvelope(response.body, 404);
    assert.ok(
      !response.text.includes('<html'),
      'no puede filtrarse la página por defecto de Express',
    );
  });

  it('un cuerpo por encima del límite devuelve 413, no 500', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const response = await api<ErrorBody>('POST', '/auth/login', {
      body: { email: 'a@b.co', password: 'x'.repeat(2 * 1024 * 1024) },
    });
    assert.equal(response.status, 413);
    assert.equal(response.body.code, 'PAYLOAD_TOO_LARGE');
    assertEnvelope(response.body, 413);
  });

  it('un JSON malformado devuelve 400 con requestId utilizable', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    // El id de correlación importa: el fallo ocurre dentro de express.json(),
    // antes de los routers, y aun así el usuario tiene que poder decirnos qué
    // petición falló.
    const response = await fetch(`${V1}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":',
    });
    const body = (await response.json()) as ErrorBody;
    assert.equal(response.status, 400);
    assert.equal(body.code, 'MALFORMED_BODY');
    assertEnvelope(body, 400);
  });

  it('un identificador que no es UUID devuelve 400, no 500', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const response = await api<ErrorBody>('GET', '/tickets/no-es-un-uuid', {
      token: user.token,
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'INVALID_IDENTIFIER');
    assertEnvelope(response.body, 400);
  });

  it('un UUID válido pero inexistente devuelve 404', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const response = await api<ErrorBody>(
      'GET',
      '/tickets/00000000-0000-7000-8000-000000000000',
      { token: user.token },
    );
    assert.equal(response.status, 404);
  });

  it('una subida con el campo equivocado devuelve 400, no 500', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const boundary = '----wrongfield';
    const raw = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="documento"; filename="a.png"\r\n` +
          `Content-Type: image/png\r\n\r\n`,
      ),
      PNG_1X1,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const response = await api<ErrorBody>(
      'POST',
      `/tickets/${ticketId}/attachments`,
      {
        token: user.token,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        raw,
      },
    );
    assert.ok(
      response.status === 400 || response.status === 404,
      `esperaba 400/404, recibido ${response.status}`,
    );
    assert.ok(response.status < 500, 'un error del cliente nunca debe ser 500');
  });

  it('ningún error filtra rutas del servidor, SQL ni trazas', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const responses = await Promise.all([
      api('GET', '/tickets/no-es-un-uuid', { token: user.token }),
      api('GET', '/tickets/00000000-0000-7000-8000-000000000000', {
        token: user.token,
      }),
      api('GET', '/ruta-que-no-existe'),
      api('POST', '/auth/login', { body: { email: 'x', password: 'y' } }),
    ]);
    for (const response of responses) {
      assert.doesNotMatch(response.text, /\/home\/|\/app\/|node_modules/);
      assert.doesNotMatch(response.text, /SELECT |FROM "|prisma\./i);
      assert.doesNotMatch(response.text, / {4}at .+\(/);
    }
  });

  it('las cabeceras de seguridad y el X-Request-Id siempre están', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const response = await api('GET', `${BASE_URL}/api/health`);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(response.headers.get('x-frame-options'));
    assert.ok(response.headers.get('strict-transport-security'));
    assert.ok(response.headers.get('x-request-id'));
    assert.equal(
      response.headers.get('x-powered-by'),
      null,
      'helmet debe ocultar la tecnología del servidor',
    );
  });

  it('las rutas de credenciales usan el cubo estricto de rate limit', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    // El límite estricto se seleccionaba comparando `req.path`, que dentro de
    // un router montado vale `/login` y no `/api/v1/auth/login`, así que el
    // patrón nunca casaba y el login corría con el cubo general de 300/min.
    //
    // Se comprueban las cabeceras en lugar de agotar la ventana, para no dejar
    // la API bloqueada al resto de la suite. Los valores esperados salen del
    // entorno: así la prueba vale tanto contra la configuración por defecto de
    // Compose como contra una relajada para poder ejecutar toda la suite.
    const expectedAuth = process.env['RATE_LIMIT_AUTH_PER_MIN'] ?? '10';
    const expectedGlobal = process.env['RATE_LIMIT_GLOBAL_PER_MIN'] ?? '300';

    const credentials = await api('POST', '/auth/login', {
      body: { email: 'quien@sea.local', password: PASSWORD },
    });
    const ordinary = await api('GET', '/auth/me', { token: user.token });

    assert.equal(
      credentials.headers.get('ratelimit-limit'),
      expectedAuth,
      'login debe contar contra el cubo estricto de credenciales',
    );
    assert.equal(
      ordinary.headers.get('ratelimit-limit'),
      expectedGlobal,
      'el resto de rutas mantiene el cubo general',
    );
  });

  it('la sonda de liveness no se limita; readiness y status sí', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    // /api/health responde de memoria y lo consulta el HEALTHCHECK de Docker:
    // limitarlo podría marcar como no sano un contenedor que está perfecto.
    // /ready y /status golpean PostgreSQL, Redis, SMTP y el disco en cada
    // llamada, y son anónimas.
    const live = await api('GET', `${BASE_URL}/api/health`);
    assert.equal(live.status, 200);
    assert.equal(live.headers.get('ratelimit-limit'), null);

    for (const path of ['/api/health/ready', '/api/health/status']) {
      const response = await api('GET', `${BASE_URL}${path}`);
      assert.ok(
        response.headers.get('ratelimit-limit'),
        `${path} debe pasar por el limitador`,
      );
    }
  });

  it('el adjunto se valida por magic bytes, no por la extensión', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const shellScript = Buffer.from('#!/bin/sh\necho hola\n');
    const disguised = multipart('informe.pdf', 'application/pdf', shellScript);
    const response = await api<ErrorBody>(
      'POST',
      `/tickets/${ticketId}/attachments`,
      { token: user.token, ...disguised },
    );
    assert.equal(response.status, 415);
    assert.equal(response.body.code, 'FILE_TYPE_NOT_ALLOWED');
  });
});
