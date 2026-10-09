#!/usr/bin/env node
// =============================================================================
//  Siembra de desarrollo — HelpDesk Lite
//
//  Deja el entorno local con lo que hace falta para probar permisos a mano:
//  tres organizaciones, los cuatro roles de organización y DOS niveles de
//  administración de plataforma. Todo a través de la API real, no por psql:
//  así la siembra recorre las mismas validaciones, los mismos correos y las
//  mismas reglas de permisos que una persona, y si algo de eso se rompe, la
//  siembra se rompe con ello y avisa.
//
//      node scripts/dev/seed-demo.mjs
//      node scripts/dev/seed-demo.mjs --salida doc/seed.txt
//
//  Las credenciales salen a un fichero (por omisión `doc/seed.txt`, que está
//  fuera del repositorio del equipo a propósito) y NO al registro: el resumen
//  en pantalla dice sólo dónde quedaron.
//
//  El administrador de plataforma NO lo crea esta siembra. Lo crea el arranque
//  de la API con BOOTSTRAP_ADMIN_USERNAME / BOOTSTRAP_ADMIN_PASSWORD del
//  `.env`, igual que en el servidor lo crea el pipeline con los secretos
//  *_BOOTSTRAP_ADMIN_*. Esta siembra lo usa para entrar, lo anota en la salida
//  para que se pueda probar, y promociona un SEGUNDO administrador de
//  plataforma: hace falta para probar lo que un administrador puede hacerle a
//  otro, y para no quedarse sin nadie si se toca la cuenta principal.
// =============================================================================
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const RAIZ = resolve(import.meta.dirname, '../..');
const API = process.env.API_BASE_URL ?? 'http://127.0.0.1:5000';
const V1 = `${API}/api/v1`;
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:8025';

const argumentos = process.argv.slice(2);
const indiceSalida = argumentos.indexOf('--salida');
const SALIDA = resolve(
  RAIZ,
  indiceSalida >= 0 ? argumentos[indiceSalida + 1] : 'doc/seed.txt',
);

// -----------------------------------------------------------------------------
//  Utilidades
// -----------------------------------------------------------------------------
const log = (texto) => process.stdout.write(`${texto}\n`);
const aviso = (texto) => process.stdout.write(`\x1b[33m${texto}\x1b[0m\n`);

/**
 * Contraseña que cumple la política de la aplicación (10+, mayúscula,
 * minúscula, dígito y símbolo). Se genera aquí y sólo viaja al fichero de
 * salida: no hay contraseñas de desarrollo escritas en el repositorio.
 */
function contrasena(prefijo) {
  const azar = randomBytes(9)
    .toString('base64')
    .replace(/[^A-Za-z0-9]/g, '');
  return `${prefijo}-${azar}9x!`;
}

/** Las variables del `.env`, sin arrastrar un paquete para leerlo. */
function leerEnv() {
  const valores = {};
  let texto;
  try {
    texto = readFileSync(resolve(RAIZ, '.env'), 'utf8');
  } catch {
    return valores;
  }
  for (const linea of texto.split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const corte = limpia.indexOf('=');
    if (corte < 0) continue;
    valores[limpia.slice(0, corte)] = limpia.slice(corte + 1);
  }
  return valores;
}

const dormir = (ms) => new Promise((listo) => setTimeout(listo, ms));

/**
 * Una llamada a la API, con paciencia ante el limitador de peticiones.
 *
 * Las rutas de credenciales (registrarse, entrar, recuperar la contraseña)
 * están limitadas a RATE_LIMIT_AUTH_PER_MIN por IP —10 por omisión— y esta
 * siembra hace cuatro por persona, así que se pasa del límite a mitad de la
 * lista. El limitador es una protección de verdad y no se toca: lo que hace la
 * siembra es esperar lo que dice `Retry-After` y volver a intentarlo.
 */
async function peticion(metodo, ruta, { token, cuerpo, reintento = 0 } = {}) {
  const respuesta = await fetch(`${V1}${ruta}`, {
    method: metodo,
    headers: {
      ...(cuerpo ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  if (respuesta.status === 429 && reintento < 3) {
    const espera = Number(respuesta.headers.get('retry-after') ?? 61) + 1;
    aviso(
      `    (limitador de peticiones: esperando ${espera}s antes de reintentar ${metodo} ${ruta})`,
    );
    await dormir(espera * 1000);
    return peticion(metodo, ruta, { token, cuerpo, reintento: reintento + 1 });
  }
  const texto = await respuesta.text();
  let datos;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = texto;
  }
  return { estado: respuesta.status, datos, texto };
}

/** Falla con el cuerpo de la respuesta: una siembra muda no se puede arreglar. */
function exigir(respuesta, esperados, que) {
  const lista = Array.isArray(esperados) ? esperados : [esperados];
  if (!lista.includes(respuesta.estado)) {
    throw new Error(
      `${que}: HTTP ${respuesta.estado} ${respuesta.texto.slice(0, 300)}`,
    );
  }
  return respuesta.datos;
}

// -----------------------------------------------------------------------------
//  Correo: confirmar la dirección como lo haría la persona
// -----------------------------------------------------------------------------
/**
 * Saca el testigo de confirmación del buzón de Mailpit y lo canjea.
 *
 * Se hace por el buzón, y no marcando la columna en la base, por dos razones:
 * recorre el mismo camino que una persona (si el enlace vuelve a nacer roto,
 * la siembra lo nota) y deja el buzón en el estado en que se van a hacer las
 * pruebas a mano.
 */
async function confirmarDireccion(email) {
  const buzon = await fetch(
    `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
  );
  if (!buzon.ok) return false;
  const { messages = [] } = await buzon.json();
  for (const mensaje of messages) {
    const detalle = await (
      await fetch(`${MAILPIT}/api/v1/message/${mensaje.ID}`)
    ).json();
    const cuerpo = `${detalle.Text ?? ''}${detalle.HTML ?? ''}`;
    const enlace = cuerpo.match(/#verify-email\?token=([A-Za-z0-9._-]+)/);
    if (!enlace) continue;
    const respuesta = await peticion('POST', '/auth/verify-email', {
      cuerpo: { token: enlace[1] },
    });
    if (respuesta.estado === 204) return true;
  }
  return false;
}

/**
 * Fija la contraseña de una cuenta que ya existe, por el camino de verdad.
 *
 * Hace falta porque las contraseñas de una siembra anterior no se guardan en
 * ningún sitio salvo su fichero de salida: si ese fichero se pierde, las
 * cuentas siguen ahí y son inalcanzables. Antes de esto la única salida era
 * vaciar la base y perder las organizaciones y los tickets.
 *
 * Va por `forgot-password` + buzón + `reset-password`, no por la base de
 * datos: es el mismo recorrido que hace una persona que ha perdido su clave,
 * así que de paso la siembra comprueba que la recuperación funciona.
 */
async function adoptar(email, clave) {
  const marca = Date.now();
  const pedido = await peticion('POST', '/auth/forgot-password', {
    cuerpo: { email },
  });
  // Responde igual exista o no la cuenta, a propósito: no filtra quién hay.
  if (![200, 202, 204].includes(pedido.estado)) return false;

  const buzon = await fetch(
    `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
  );
  if (!buzon.ok) return false;
  const { messages = [] } = await buzon.json();
  for (const mensaje of messages) {
    // Sólo el correo que acaba de llegar: los antiguos llevan testigos muertos.
    if (new Date(mensaje.Created).getTime() < marca - 5000) continue;
    const detalle = await (
      await fetch(`${MAILPIT}/api/v1/message/${mensaje.ID}`)
    ).json();
    const cuerpo = `${detalle.Text ?? ''}${detalle.HTML ?? ''}`;
    const enlace = cuerpo.match(/#reset-password\?token=([A-Za-z0-9._-]+)/);
    if (!enlace) continue;
    const puesta = await peticion('POST', '/auth/reset-password', {
      cuerpo: {
        token: enlace[1],
        password: clave,
        confirmPassword: clave,
      },
    });
    if ([200, 204].includes(puesta.estado)) return true;
  }
  return false;
}

// -----------------------------------------------------------------------------
//  Personas
// -----------------------------------------------------------------------------
async function registrar({ email, usuario, nombre, apellido, clave }) {
  const respuesta = await peticion('POST', '/auth/register', {
    cuerpo: {
      email,
      username: usuario,
      password: clave,
      confirmPassword: clave,
      firstName: nombre,
      lastName: apellido,
      acceptTerms: true,
      locale: 'ES',
    },
  });
  if (respuesta.estado === 201) {
    const confirmada = await confirmarDireccion(email);
    if (!confirmada) {
      aviso(
        `  · ${email}: no se pudo confirmar la dirección desde el buzón; los roles reservados quedarán esperando`,
      );
    }
    return { id: respuesta.datos.user.id, token: respuesta.datos.accessToken };
  }
  // Ya existía: de una siembra anterior, o de las pruebas a mano.
  if (respuesta.estado === 409 || respuesta.estado === 422) {
    if (!(await adoptar(email, clave))) {
      throw new Error(
        `${email} ya existe y no se ha podido fijar su contraseña por el ` +
          `flujo de recuperación. Comprueba que Mailpit responde en ${MAILPIT}.`,
      );
    }
    const sesion = exigir(
      await peticion('POST', '/auth/login', {
        cuerpo: { email, password: clave },
      }),
      200,
      `entrar como ${email} tras fijar su contraseña`,
    );
    return { id: sesion.user.id, token: sesion.accessToken };
  }
  return exigir(respuesta, 201, `registrar ${email}`);
}

// -----------------------------------------------------------------------------
//  Guion de la siembra
// -----------------------------------------------------------------------------
const ORGANIZACIONES = [
  {
    clave: 'vilanova',
    nombre: 'Ayuntamiento de Vilanova — Soporte TI',
    descripcion:
      'Soporte informático interno del ayuntamiento: padró, llicències i xarxa.',
    categorias: [
      ['Padró', 'Altes, baixes i canvis al padró municipal'],
      ['Llicències', 'Tramitació de llicències i permisos'],
      ['Xarxa', 'Connectivitat, wifi i telefonia'],
    ],
  },
  {
    clave: 'consell',
    nombre: 'Consell Comarcal Informàtica',
    descripcion: 'Suport informàtic comarcal per als municipis adherits.',
    categorias: [['General', 'Peticions que encara no tenen categoria']],
  },
  {
    clave: 'hospital',
    nombre: 'Hospital Sant Camil TIC',
    descripcion: 'Sistemes i equipament clínic del centre.',
    categorias: [['Equipament clínic', 'Avaries i manteniment de material']],
  },
];

const TICKETS = [
  ['No puc accedir al padró', 'OPEN', 'HIGH', 'Padró'],
  ['La impressora de llicències no respon', 'OPEN', 'MEDIUM', 'Llicències'],
  ['Wifi caiguda a la planta 2', 'IN_PROGRESS', 'HIGH', 'Xarxa'],
  ['Alta de nou treballador al padró', 'IN_PROGRESS', 'LOW', 'Padró'],
  [
    'Revisar permisos de la carpeta compartida',
    'IN_PROGRESS',
    'MEDIUM',
    'Xarxa',
  ],
  ['Error en imprimir el certificat', 'RESOLVED', 'MEDIUM', 'Llicències'],
  ['Telèfon de recepció sense to', 'CLOSED', 'LOW', 'Xarxa'],
  ['Duplicat al padró municipal', 'CLOSED', 'HIGH', 'Padró'],
];

async function main() {
  log('');
  log('=== Siembra de desarrollo — HelpDesk Lite ===');
  log('');

  // --- 0) La API tiene que estar en pie --------------------------------------
  const salud = await fetch(`${API}/api/health`).catch(() => null);
  if (!salud?.ok) {
    throw new Error(
      `La API no responde en ${API}. Levanta el entorno con: make up-dev`,
    );
  }

  // --- 1) Entrar como el administrador de plataforma del .env ---------------
  const env = leerEnv();
  const usuarioAdmin = env['BOOTSTRAP_ADMIN_USERNAME'];
  const claveAdmin = env['BOOTSTRAP_ADMIN_PASSWORD'];
  if (!usuarioAdmin || !claveAdmin) {
    throw new Error(
      'Faltan BOOTSTRAP_ADMIN_USERNAME y BOOTSTRAP_ADMIN_PASSWORD en el .env.\n' +
        'Son las que crean el administrador de plataforma al arrancar la API ' +
        '(ver .env.example). Las rellena scripts/gen-secrets.sh.',
    );
  }
  const correoAdmin = `${usuarioAdmin}@helpdesk.invalid`;
  const sesionAdmin = exigir(
    await peticion('POST', '/auth/login', {
      cuerpo: { email: correoAdmin, password: claveAdmin },
    }),
    200,
    `entrar como ${correoAdmin}`,
  );
  if (sesionAdmin.user.globalRole !== 'GLOBAL_ADMIN') {
    throw new Error(
      `${correoAdmin} existe pero no es GLOBAL_ADMIN. Revisa el arranque de la API.`,
    );
  }
  const plataforma = sesionAdmin.accessToken;
  log(`  · administrador de plataforma: ${correoAdmin}`);

  // --- 2) Las personas ------------------------------------------------------
  const claves = {
    admin: contrasena('Demo'),
    agent: contrasena('Demo'),
    laura: contrasena('Demo'),
    marc: contrasena('Demo'),
    sistemas: contrasena('Sys'),
  };
  const personas = {
    admin: {
      email: 'demo-admin@helpdesklite.me',
      usuario: 'demo-admin',
      nombre: 'Marta',
      apellido: 'Rius',
      clave: claves.admin,
      papel: 'ORG_ADMIN de las tres organizaciones',
    },
    agent: {
      email: 'demo-agent@helpdesklite.me',
      usuario: 'demo-agent',
      nombre: 'Jordi',
      apellido: 'Ferrer',
      clave: claves.agent,
      papel: 'AGENT de Vilanova',
    },
    laura: {
      email: 'demo-laura@helpdesklite.me',
      usuario: 'demo-laura',
      nombre: 'Laura',
      apellido: 'Soler',
      clave: claves.laura,
      papel: 'MEMBER de Vilanova',
    },
    marc: {
      email: 'demo-marc@helpdesklite.me',
      usuario: 'demo-marc',
      nombre: 'Marc',
      apellido: 'Vidal',
      clave: claves.marc,
      papel: 'MEMBER de Vilanova',
    },
    sistemas: {
      email: 'demo-sistemas@helpdesklite.me',
      usuario: 'demo-sistemas',
      nombre: 'Nuria',
      apellido: 'Camps',
      clave: claves.sistemas,
      papel: 'GLOBAL_ADMIN (segundo administrador de plataforma)',
    },
  };

  log('  · personas');
  for (const [nombre, persona] of Object.entries(personas)) {
    const cuenta = await registrar(persona);
    personas[nombre].id = cuenta.id;
    personas[nombre].token = cuenta.token;
  }

  // --- 3) El segundo administrador de plataforma ----------------------------
  // Promocionado por la API, no por la base: es el camino que tiene que
  // funcionar, y queda en la auditoría como queda en producción.
  exigir(
    await peticion('PATCH', `/users/${personas.sistemas.id}/role`, {
      token: plataforma,
      cuerpo: { globalRole: 'GLOBAL_ADMIN' },
    }),
    200,
    'promocionar al segundo administrador de plataforma',
  );
  log('  · segundo administrador de plataforma promocionado');

  // --- 4) Las organizaciones ------------------------------------------------
  // Las crea `demo-admin`, así que es su propietaria y puede borrarlas: la API
  // reserva el borrado a quien creó la organización o a plataforma.
  const creadas = {};
  for (const organizacion of ORGANIZACIONES) {
    const existentes = exigir(
      await peticion('GET', '/organizations', { token: personas.admin.token }),
      200,
      'listar organizaciones',
    );
    const ya = existentes.find((fila) => fila.name === organizacion.nombre);
    if (ya) {
      creadas[organizacion.clave] = ya.id;
      continue;
    }
    const nueva = exigir(
      await peticion('POST', '/organizations', {
        token: personas.admin.token,
        cuerpo: {
          name: organizacion.nombre,
          description: organizacion.descripcion,
        },
      }),
      201,
      `crear ${organizacion.nombre}`,
    );
    creadas[organizacion.clave] = nueva.id;
  }
  log(`  · organizaciones: ${Object.keys(creadas).length}`);

  // --- 5) Las pertenencias --------------------------------------------------
  // Reconcilia en vez de limitarse a crear: sobre una base que ya se ha usado
  // para probar, los roles están donde los dejaron las pruebas. Las llamadas
  // van con el token de PLATAFORMA a propósito — puede actuar en cualquier
  // organización sin pertenecer a ella, y así la siembra arregla incluso el
  // caso en que la administradora de la organización se quedó sin permisos.
  const pertenencias = [
    ['vilanova', 'admin', 'ORG_ADMIN'],
    ['vilanova', 'agent', 'AGENT'],
    ['vilanova', 'laura', 'MEMBER'],
    ['vilanova', 'marc', 'MEMBER'],
    ['consell', 'admin', 'ORG_ADMIN'],
    ['hospital', 'admin', 'ORG_ADMIN'],
  ];
  let arreglados = 0;
  for (const [organizacion, persona, rol] of pertenencias) {
    const id = creadas[organizacion];
    const miembros = exigir(
      await peticion('GET', `/organizations/${id}/members`, {
        token: plataforma,
      }),
      200,
      `listar los miembros de ${organizacion}`,
    );
    const actual = miembros.find(
      (fila) => fila.user?.id === personas[persona].id,
    );
    if (!actual) {
      exigir(
        await peticion('POST', `/organizations/${id}/members`, {
          token: plataforma,
          cuerpo: { identifier: personas[persona].usuario, role: rol },
        }),
        [201, 409],
        `añadir ${personas[persona].usuario} a ${organizacion}`,
      );
      arreglados += 1;
      continue;
    }
    if (actual.role === rol) continue;
    exigir(
      await peticion(
        'PATCH',
        `/organizations/${id}/members/${personas[persona].id}`,
        { token: plataforma, cuerpo: { role: rol } },
      ),
      200,
      `poner a ${personas[persona].usuario} como ${rol} en ${organizacion}`,
    );
    arreglados += 1;
  }
  log(
    `  · pertenencias: ${pertenencias.length}` +
      (arreglados ? ` (${arreglados} creadas o corregidas)` : ' (ya estaban)'),
  );

  // --- 6) Las categorías ----------------------------------------------------
  const categorias = {};
  for (const organizacion of ORGANIZACIONES) {
    const id = creadas[organizacion.clave];
    const existentes = exigir(
      await peticion('GET', `/organizations/${id}/categories`, {
        token: personas.admin.token,
      }),
      200,
      'listar categorías',
    );
    for (const [nombre, descripcion] of organizacion.categorias) {
      const ya = existentes.find((fila) => fila.name === nombre);
      if (ya) {
        categorias[`${organizacion.clave}:${nombre}`] = ya.id;
        continue;
      }
      const nueva = exigir(
        await peticion('POST', `/organizations/${id}/categories`, {
          token: personas.admin.token,
          cuerpo: { name: nombre, description: descripcion, color: '#0d6c90' },
        }),
        201,
        `crear la categoría ${nombre}`,
      );
      categorias[`${organizacion.clave}:${nombre}`] = nueva.id;
    }
  }
  log(`  · categorías: ${Object.keys(categorias).length}`);

  // --- 7) Los tickets de Vilanova ------------------------------------------
  const vilanova = creadas['vilanova'];
  const yaHay = exigir(
    await peticion('GET', `/organizations/${vilanova}/stats`, {
      token: personas.admin.token,
    }),
    200,
    'leer las estadísticas de Vilanova',
  );
  if (yaHay.total >= TICKETS.length) {
    log(`  · tickets: ya había ${yaHay.total}, no se tocan`);
  } else {
    let puestos = 0;
    for (const [titulo, estado, prioridad, categoria] of TICKETS) {
      const creado = await peticion('POST', '/tickets', {
        token: personas.laura.token,
        cuerpo: {
          organizationId: vilanova,
          title: titulo,
          description: `${titulo}. Sembrado para las pruebas manuales de permisos.`,
          priority: prioridad,
          categoryId: categorias[`vilanova:${categoria}`],
        },
      });
      if (creado.estado !== 201) {
        aviso(`  · no se pudo crear el ticket «${titulo}»: ${creado.estado}`);
        continue;
      }
      puestos += 1;
      if (estado === 'OPEN') continue;
      // Los estados se mueven con la máquina de estados real, uno a uno.
      const camino =
        estado === 'IN_PROGRESS'
          ? ['IN_PROGRESS']
          : estado === 'RESOLVED'
            ? ['IN_PROGRESS', 'RESOLVED']
            : ['IN_PROGRESS', 'RESOLVED', 'CLOSED'];
      for (const paso of camino) {
        const movido = await peticion(
          'PATCH',
          `/tickets/${creado.datos.id}/status`,
          { token: personas.agent.token, cuerpo: { status: paso } },
        );
        if (movido.estado !== 200) {
          aviso(
            `  · «${titulo}» se quedó antes de ${paso}: ${movido.estado} ${movido.texto.slice(0, 120)}`,
          );
          break;
        }
      }
    }
    log(`  · tickets: ${puestos}`);
  }

  // --- 8) La salida ---------------------------------------------------------
  const ahora = new Date().toISOString();
  const filas = [
    ['GLOBAL_ADMIN (del .env)', correoAdmin, claveAdmin],
    ...Object.values(personas).map((persona) => [
      persona.papel,
      persona.email,
      persona.clave,
    ]),
  ];
  const ancho = Math.max(...filas.map((fila) => fila[0].length));
  const anchoCorreo = Math.max(...filas.map((fila) => fila[1].length));
  const contenido = [
    '# Cuentas de desarrollo — HelpDesk Lite',
    `# Generado: ${ahora}`,
    '#',
    '# Entorno local, contraseñas de usar y tirar. Este fichero NO sube al',
    '# repositorio del equipo (doc/ está excluido a propósito).',
    '#',
    '# Volver a generarlo:  node scripts/dev/seed-demo.mjs',
    '',
    '## Cuentas',
    '',
    ...filas.map(
      ([papel, email, clave]) =>
        `${papel.padEnd(ancho)}  ${email.padEnd(anchoCorreo)}  ${clave}`,
    ),
    '',
    '## Organizaciones',
    '',
    ...ORGANIZACIONES.map(
      (organizacion) =>
        `${organizacion.nombre}\n  ${creadas[organizacion.clave]}`,
    ),
    '',
    '## Dónde probar',
    '',
    'Aplicación ............ http://localhost:5173',
    'Buzón (Mailpit) ....... http://localhost:8025',
    'Documentación de la API http://localhost:5000/api/v1/docs',
    '',
    '## Notas',
    '',
    '· El administrador de plataforma del .env lo crea el ARRANQUE de la API',
    '  (BOOTSTRAP_ADMIN_USERNAME / BOOTSTRAP_ADMIN_PASSWORD), no esta siembra.',
    '  En el servidor lo crea el pipeline con los secretos *_BOOTSTRAP_ADMIN_*.',
    '  Se entra con <usuario>@helpdesk.invalid: un dominio reservado, sin buzón.',
    '· demo-sistemas es un SEGUNDO administrador de plataforma, promocionado por',
    '  la API. Sirve para probar qué puede hacerle un administrador a otro sin',
    '  arriesgar la cuenta principal.',
    '· demo-admin creó las tres organizaciones, así que es la única (aparte de',
    '  plataforma) que puede borrarlas.',
    '· Volver a sembrar NO borra nada: reconcilia roles y pertenencias, y deja',
    '  las organizaciones, las categorías y los tickets donde estén. Lo que SÍ',
    '  cambia son las contraseñas de este fichero: las de las cuentas demo se',
    '  generan nuevas en cada pasada y se fijan por el flujo de recuperación,',
    '  así que este fichero es siempre el que vale. La del administrador del',
    '  .env no se toca: la manda la variable.',
    '· Tarda un par de minutos: las rutas de credenciales están limitadas a 10',
    '  por minuto y por IP, y la siembra espera su turno en vez de saltarse el',
    '  limitador.',
    '',
  ].join('\n');

  mkdirSync(dirname(SALIDA), { recursive: true });
  writeFileSync(SALIDA, contenido);
  // `mode` en writeFileSync sólo se aplica al crear: aquí hay contraseñas, así
  // que se fija a mano. En exfat (sgoinfre, en los puestos de 42) no hay
  // permisos Unix y la llamada no hace nada; no es motivo para fallar.
  try {
    chmodSync(SALIDA, 0o600);
  } catch {
    // Sistema de ficheros sin permisos: el aviso de arriba ya lo cubre.
  }

  log('');
  log(`  Credenciales en: ${SALIDA}`);
  log('');
}

main().catch((error) => {
  process.stderr.write(`\x1b[31m\n  ${error.message}\n\n\x1b[0m`);
  process.exit(1);
});
