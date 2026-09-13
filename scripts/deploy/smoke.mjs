/**
 * ============================================================================
 *  Smoke test post-despliegue — HelpDesk Lite
 *
 *  Se ejecuta DENTRO del contenedor `api` recién levantado:
 *
 *      docker compose -f compose.prod.yml cp scripts/deploy/smoke.mjs api:/tmp/smoke.mjs
 *      docker compose -f compose.prod.yml exec -T -e EXPECTED_SHA=<sha> api node /tmp/smoke.mjs
 *
 *  Se ejecuta ahí y no desde el runner por dos razones: los contenedores no
 *  publican puertos en el host (sólo salen por proxy-tier hacia Nginx Proxy
 *  Manager), y desde dentro se puede comprobar también el frontend a través de
 *  la red interna. Node 24 ya trae `fetch`, así que no hace falta instalar nada.
 *
 *  Devuelve código != 0 si el entorno no está sano; el pipeline lo usa para
 *  decidir si hace rollback.
 *
 *  Ninguna comprobación ESCRIBE en la base de datos: el login se hace a
 *  propósito con credenciales inválidas, que recorren igualmente enrutador,
 *  validación de contrato, consulta a PostgreSQL y sobre de error.
 * ============================================================================
 */

const API = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:5000';
const WEB = process.env.SMOKE_WEB_URL ?? 'http://web';
const EXPECTED_SHA = process.env.EXPECTED_SHA ?? '';
const TIMEOUT_MS = 10_000;

let failures = 0;

function ok(name, detail = '') {
  console.log(`  ✔ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail) {
  failures += 1;
  console.error(`  ✘ ${name} — ${detail}`);
}

async function get(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, text, json };
}

async function check(name, fn) {
  try {
    const detail = await fn();
    ok(name, detail);
  } catch (error) {
    fail(name, error.message);
  }
}

console.log(`\nSmoke test contra ${API} (frontend: ${WEB})\n`);

// 1. Liveness: el proceso está vivo y responde HTTP.
await check('API viva (GET /api/health)', async () => {
  const { status, json } = await get(`${API}/api/health`);
  if (status !== 200) throw new Error(`esperaba 200, recibí ${status}`);
  if (json?.status !== 'ok') throw new Error(`status = ${json?.status}`);
  return `uptime ${json.uptimeSeconds}s`;
});

// 2. Readiness REAL. Ojo: /api/health/ready devuelve 200 aunque una
//    dependencia esté caída — el estado va en el cuerpo, no en el código HTTP.
//    Comprobar sólo el código sería exactamente el fallo silencioso que este
//    smoke test existe para evitar.
await check('Dependencias listas (GET /api/health/ready)', async () => {
  const { status, json } = await get(`${API}/api/health/ready`);
  if (status !== 200) throw new Error(`esperaba 200, recibí ${status}`);
  const services = json?.services ?? [];
  const database = services.find((s) => s.name === 'database');
  if (!database || database.status !== 'up') {
    throw new Error(`base de datos: ${database?.status ?? 'ausente'}`);
  }
  if (json.status !== 'ok') {
    throw new Error(
      `estado global "${json.status}", fallando: ${(json.failing ?? []).join(', ')}`,
    );
  }
  const degraded = services
    .filter((s) => s.status === 'degraded')
    .map((s) => s.name);
  return degraded.length
    ? `degradados (no bloquean): ${degraded.join(', ')}`
    : 'todas arriba';
});

// 3. ¿Está sirviendo el commit que acabamos de desplegar? Sin esto, un `docker
//    compose up -d` que no llegó a recrear el contenedor pasaría por bueno.
await check(
  'La release desplegada es la esperada (GET /api/version)',
  async () => {
    const { status, json } = await get(`${API}/api/version`);
    if (status !== 200) throw new Error(`esperaba 200, recibí ${status}`);
    if (!EXPECTED_SHA)
      return `commit servido ${json?.commit} (sin SHA esperado)`;
    if (json?.commit !== EXPECTED_SHA) {
      throw new Error(`sirve ${json?.commit}, se esperaba ${EXPECTED_SHA}`);
    }
    return `commit ${json.commit}, construida ${json.builtAt ?? 'sin fecha'}`;
  },
);

// 4. Flujo principal de autenticación de extremo a extremo, SIN escribir nada:
//    enrutador -> límite de peticiones -> validación de contrato -> consulta a
//    PostgreSQL -> sobre de error. Un 401/400 aquí prueba que toda la cadena
//    está viva; un 500 o un 404 prueba que no.
await check('Cadena de login operativa (POST /api/v1/auth/login)', async () => {
  const response = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'smoke-test-no-existe@helpdesk.invalid',
      password: 'DefinitelyWrong1!aaa',
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (![400, 401, 403].includes(response.status)) {
    throw new Error(
      `esperaba 400/401/403 para credenciales inválidas, recibí ${response.status}`,
    );
  }
  return `rechaza credenciales inválidas con ${response.status}`;
});

// 5. El frontend compilado se sirve y no es la página por defecto de Nginx.
await check('Frontend servido (GET /)', async () => {
  const { status, text } = await get(`${WEB}/`);
  if (status !== 200) throw new Error(`esperaba 200, recibí ${status}`);
  if (!text.includes('<div id="root"')) {
    throw new Error('la respuesta no contiene el punto de montaje de React');
  }
  return `${text.length} bytes de HTML`;
});

// 6. El proxy interno de la web alcanza a la API (es la ruta que usa el
//    navegador de verdad: /api/... entra por Nginx, no por el puerto 5000).
await check(
  'Proxy web -> API (GET /api/health a través del frontend)',
  async () => {
    const { status, json } = await get(`${WEB}/api/health`);
    if (status !== 200) throw new Error(`esperaba 200, recibí ${status}`);
    if (json?.status !== 'ok') throw new Error(`status = ${json?.status}`);
    return 'la web enruta correctamente hacia la API';
  },
);

console.log('');
if (failures > 0) {
  console.error(`SMOKE TEST FALLIDO: ${failures} comprobación(es) en rojo.\n`);
  process.exit(1);
}
console.log('SMOKE TEST OK: el entorno responde correctamente.\n');
