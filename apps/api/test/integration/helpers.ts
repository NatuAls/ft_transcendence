/**
 * ============================================================================
 *  Utilidades para las pruebas de integración HTTP.
 *
 *  Estas pruebas hablan con la API **por HTTP, ya levantada**, contra
 *  PostgreSQL y Redis reales. No montan la aplicación en memoria a propósito:
 *  lo que se quiere verificar es justamente la cadena completa —middleware de
 *  límite de peticiones, autenticación, `orgScope`, política RBAC, servicio y
 *  base de datos— que un test unitario no puede tocar.
 *
 *  Se usa `node:test` y `fetch` nativo, sin dependencias nuevas, igual que las
 *  pruebas unitarias de `test/unit`.
 *
 *  Cómo ejecutarlas:
 *
 *      docker compose up -d db redis mailpit backend
 *      npm run test:integration --workspace=apps/api
 *
 *  La URL se puede cambiar con `API_BASE_URL` (por defecto
 *  http://localhost:5000). Si la API no responde, cada fichero se salta con un
 *  mensaje explicativo en lugar de fallar con un error de conexión sin
 *  contexto.
 *
 *  ⚠️ El límite de credenciales por defecto son 10 peticiones por minuto y por
 *  IP, y la suite hace bastantes más altas y logins que eso. Para ejecutarla
 *  entera hay que levantar la API con el límite relajado y decírselo también a
 *  las pruebas, que leen el valor esperado del entorno:
 *
 *      RATE_LIMIT_AUTH_PER_MIN=100000 RATE_LIMIT_GLOBAL_PER_MIN=200000 \
 *        docker compose up -d backend
 *      RATE_LIMIT_AUTH_PER_MIN=100000 RATE_LIMIT_GLOBAL_PER_MIN=200000 \
 *        npm run test:integration --workspace=apps/api
 *
 *  Los límites reales se comprueban aparte, contra la configuración de
 *  producción, porque agotar la ventana a propósito deja fuera de juego al
 *  resto de la suite.
 * ============================================================================
 */

export const BASE_URL = process.env['API_BASE_URL'] ?? 'http://localhost:5000';
export const V1 = `${BASE_URL}/api/v1`;

/** Contraseña que cumple la política de `packages/contracts`. */
export const PASSWORD = 'Password1!aaa';

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
  text: string;
  headers: Headers;
  cookies: string[];
}

export interface RequestOptions {
  token?: string;
  apiKey?: string;
  body?: unknown;
  headers?: Record<string, string>;
  raw?: Buffer | string;
  cookie?: string;
}

export async function api<T = unknown>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const url = path.startsWith('http') ? path : `${V1}${path}`;
  const headers: Record<string, string> = { ...options.headers };
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
  if (options.apiKey) headers['X-API-Key'] = options.apiKey;
  if (options.cookie) headers['Cookie'] = options.cookie;

  let payload: BodyInit | undefined;
  if (options.raw !== undefined) {
    payload = options.raw as BodyInit;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(options.body);
  }

  const response = await fetch(url, { method, headers, body: payload });
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }
  return {
    status: response.status,
    body: body as T,
    text,
    headers: response.headers,
    cookies: response.headers.getSetCookie(),
  };
}

/** `true` si la API responde; las suites lo usan para saltarse en vez de reventar. */
export async function apiIsUp(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export const SKIP_MESSAGE =
  `la API no responde en ${BASE_URL}; ` +
  'levanta la pila (docker compose up -d db redis mailpit backend) ' +
  'o exporta API_BASE_URL antes de ejecutar estas pruebas';

/** Sufijo único por proceso para que dos ejecuciones no colisionen en la base. */
let counter = 0;
export function unique(prefix: string): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter}`;
}

export interface TestUser {
  id: string;
  username: string;
  email: string;
  token: string;
  refreshCookie: string;
}

/** Da de alta un usuario nuevo y devuelve su sesión ya iniciada. */
export async function registerUser(prefix = 'it'): Promise<TestUser> {
  const username = unique(prefix);
  const email = `${username}@integration.local`;
  const response = await api<{
    user: { id: string };
    accessToken: string;
  }>('POST', '/auth/register', {
    body: {
      email,
      username,
      password: PASSWORD,
      confirmPassword: PASSWORD,
      firstName: 'Integration',
      lastName: 'Test',
      acceptTerms: true,
      locale: 'EN',
    },
  });
  if (response.status !== 201) {
    throw new Error(
      `no se pudo registrar ${username}: ${response.status} ${response.text.slice(0, 200)}`,
    );
  }
  return {
    id: response.body.user.id,
    username,
    email,
    token: response.body.accessToken,
    refreshCookie: cookieHeader(response.cookies),
  };
}

/** Junta las cookies de una respuesta en una cabecera `Cookie` reutilizable. */
export function cookieHeader(setCookies: string[]): string {
  return setCookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

export async function login(
  email: string,
  password = PASSWORD,
): Promise<{ token: string; cookie: string }> {
  const response = await api<{ accessToken: string }>('POST', '/auth/login', {
    body: { email, password },
  });
  if (response.status !== 200) {
    throw new Error(`login de ${email} devolvió ${response.status}`);
  }
  return {
    token: response.body.accessToken,
    cookie: cookieHeader(response.cookies),
  };
}

/** Crea una organización con el usuario dado como ORG_ADMIN. */
export async function createOrganization(token: string): Promise<string> {
  const response = await api<{ id: string }>('POST', '/organizations', {
    token,
    body: { name: `Org ${unique('int')}` },
  });
  if (response.status !== 201) {
    throw new Error(`no se pudo crear la organización: ${response.status}`);
  }
  return response.body.id;
}

export async function addMember(
  adminToken: string,
  organizationId: string,
  username: string,
  role: 'MEMBER' | 'AGENT' | 'ORG_ADMIN',
): Promise<void> {
  const response = await api(
    'POST',
    `/organizations/${organizationId}/members`,
    {
      token: adminToken,
      body: { identifier: username, role },
    },
  );
  if (response.status !== 201) {
    throw new Error(
      `no se pudo añadir a ${username} como ${role}: ${response.status}`,
    );
  }
}

export async function createTicket(
  token: string,
  organizationId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; reference: string }> {
  const response = await api<{ id: string; reference: string }>(
    'POST',
    '/tickets',
    {
      token,
      body: {
        organizationId,
        title: `Incidencia de integración ${unique('t')}`,
        description:
          'Descripción suficientemente larga para pasar la validación del contrato.',
        ...overrides,
      },
    },
  );
  if (response.status !== 201) {
    throw new Error(
      `no se pudo crear el ticket: ${response.status} ${response.text.slice(0, 200)}`,
    );
  }
  return response.body;
}

/** PNG de 1x1 válido: los adjuntos se validan por magic bytes, no por extensión. */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Construye un cuerpo multipart/form-data con un único campo `file`. */
export function multipart(
  filename: string,
  contentType: string,
  content: Buffer,
): { headers: Record<string, string>; raw: Buffer } {
  const boundary = `----integration${Date.now().toString(16)}`;
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    raw: Buffer.concat([head, content, tail]),
  };
}
