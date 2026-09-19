// =============================================================================
//  Datos de demostración para la defensa.                     (auditoría N40)
//
//  Crea, por la API pública (nada de SQL a mano): una organización, cuatro
//  cuentas con roles distintos y ocho tickets en estados variados con
//  comentarios, notas internas, asignaciones y resoluciones. Lo mismo que
//  haría una persona con la interfaz, en 20 segundos.
//
//  Se ejecuta DENTRO del contenedor de la API (llega a :5000 sin pasar por
//  nginx ni Cloudflare, así no gasta el límite de 5 registros/min). El
//  progreso sale por stderr; por stdout salen SÓLO las cuentas generadas, así
//  que stdout se redirige a un fichero que sólo lea root:
//
//      sudo sh -c 'umask 077; docker exec -i helpdesk-api-prod \
//          node --input-type=module - < scripts/ops/seed-demo.mjs \
//          > /root/helpdesk-demo-prod.txt'
//      sudo cat /root/helpdesk-demo-prod.txt      # cuando haga falta entrar
//
//  Idempotente a su manera: si el primer correo ya existe, se para sin tocar
//  nada (los datos ya están sembrados). Las contraseñas se generan al vuelo;
//  no se registran en ningún log.
//
//  Variables: API_URL (por defecto http://127.0.0.1:5000/api/v1),
//             SEED_DOMAIN (helpdesklite.me).
// =============================================================================
import { randomBytes } from 'node:crypto';

const API = process.env.API_URL ?? 'http://127.0.0.1:5000/api/v1';
const DOMAIN = process.env.SEED_DOMAIN ?? 'helpdesklite.me';
const ORG_SLUG = 'vilanova-ti';

const pw = () => 'Demo-' + randomBytes(9).toString('base64url') + '1a!';
const users = [
  {
    username: 'demo-admin',
    firstName: 'Marta',
    lastName: 'Rius',
    role: 'ORG_ADMIN',
  },
  {
    username: 'demo-agent',
    firstName: 'Joan',
    lastName: 'Ferrer',
    role: 'AGENT',
  },
  {
    username: 'demo-laura',
    firstName: 'Laura',
    lastName: 'Ortiz',
    role: 'MEMBER',
  },
  {
    username: 'demo-marc',
    firstName: 'Marc',
    lastName: 'Vidal',
    role: 'MEMBER',
  },
].map((u) => ({ ...u, email: `${u.username}@${DOMAIN}`, password: pw() }));

async function call(method, path, body, token) {
  const r = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!r.ok)
    throw new Error(
      `${method} ${path} → ${r.status} ${JSON.stringify(json).slice(0, 300)}`,
    );
  return json;
}
const log = (m) => process.stderr.write(`==> ${m}\n`);

// --- 1. cuentas ---------------------------------------------------------------
for (const u of users) {
  try {
    const r = await call('POST', '/auth/register', {
      email: u.email,
      username: u.username,
      password: u.password,
      confirmPassword: u.password,
      firstName: u.firstName,
      lastName: u.lastName,
      acceptTerms: true,
      locale: 'ES',
    });
    u.token = r.accessToken;
    u.id = r.user.id;
    log(`cuenta ${u.username} (${u.role})`);
  } catch (e) {
    if (/409|exist|conflict|taken/i.test(e.message)) {
      // No se asume que "la cuenta existe" signifique "todo sembrado": una
      // ejecución anterior pudo quedarse a medias. Se para con código 2 y se
      // explica cómo comprobarlo y cómo limpiar para volver a sembrar.
      log(`${u.email} ya existe. No se toca nada (código de salida 2).`);
      log(
        'Si la siembra anterior terminó, no hay nada que hacer. Si se quedó a medias,',
      );
      log(
        `limpia y repite:  docker exec helpdesk-db-<env> psql -U <DB_USER> -d <DB_NAME> -c "DELETE FROM organizations WHERE slug='${ORG_SLUG}'" -c "DELETE FROM users WHERE email LIKE 'demo-%@${DOMAIN}'"`,
      );
      process.exit(2);
    }
    throw e;
  }
}
const [admin, agent, laura, marc] = users;

// Las credenciales salen YA por stdout: si algo falla más adelante, quien
// las redirigió a fichero sigue teniendo las cuentas para entrar o limpiar.
process.stdout.write(
  [
    `# Cuentas de demostración (${DOMAIN}). Generado ${new Date().toISOString()}`,
    ...users.map(
      (u) => `${u.role.padEnd(9)} ${u.email.padEnd(32)} ${u.password}`,
    ),
    '',
  ].join('\n'),
);

// --- 2. organización, miembros, categorías ----------------------------------
const org = await call(
  'POST',
  '/organizations',
  {
    name: 'Ayuntamiento de Vilanova — Soporte TI',
    slug: ORG_SLUG,
    description:
      'Incidencias y peticiones del personal municipal (demostración).',
  },
  admin.token,
);
log(`organización ${org.name} (${org.id})`);
for (const u of [agent, laura, marc]) {
  await call(
    'POST',
    `/organizations/${org.id}/members`,
    { identifier: u.username, role: u.role },
    admin.token,
  );
}
const catsRaw = await call(
  'GET',
  `/organizations/${org.id}/categories`,
  null,
  admin.token,
);
const cats = Array.isArray(catsRaw)
  ? catsRaw
  : (catsRaw.items ?? catsRaw.data ?? []);
const cat = (i) => cats[i % Math.max(cats.length, 1)]?.id;
log(`${cats.length} categorías por defecto`);

// --- 3. tickets ---------------------------------------------------------------
const T = [
  {
    by: laura,
    p: 'HIGH',
    c: 0,
    title: 'No puedo entrar en el correo desde esta mañana',
    desc: 'Al abrir Outlook pide la contraseña en bucle. La he cambiado ayer por la política de 90 días y desde entonces no entra. Trabajo en Registro y tengo notificaciones pendientes.',
    flow: 'resolved-closed',
    comments: [
      '¿Has probado a cerrar sesión en el móvil también? A veces el móvil bloquea la cuenta con la contraseña vieja.',
      'Sí, el móvil era. Ya entra, gracias.',
    ],
    resolution:
      'La cuenta se bloqueaba por el móvil con la contraseña antigua. Actualizada en el móvil y desbloqueada en el directorio.',
  },
  {
    by: marc,
    p: 'HIGH',
    c: 1,
    title: 'La impresora de Urbanismo no imprime licencias',
    desc: 'La HP de la segunda planta se queda en "procesando" con cualquier documento. Hay 12 licencias para firmar hoy y no podemos imprimirlas.',
    flow: 'in-progress',
    comments: [
      'Voy para allá. Mientras tanto podéis imprimir en la de Secretaría (cola SEC-2P).',
    ],
    internal:
      'Cola atascada por un PDF de 400 MB del catastro. Reiniciado el spooler; queda revisar el driver.',
  },
  {
    by: laura,
    p: 'MEDIUM',
    c: 2,
    title: 'Solicitud de acceso a la carpeta compartida de Cultura',
    desc: 'Necesito permisos de lectura y escritura en \\\\srv-fs\\Cultura\\Festes2026 para preparar la programación de la Festa Major.',
    flow: 'open',
    comments: [],
  },
  {
    by: marc,
    p: 'LOW',
    c: 3,
    title: 'El portátil de préstamo tiene la batería hinchada',
    desc: 'El portátil DELL-PRES-07 tiene la tapa inferior levantada por la batería. No lo estoy usando; lo he dejado en el armario de informática por seguridad.',
    flow: 'resolved',
    comments: [
      'Buena decisión. Lo retiramos hoy y pedimos batería nueva al proveedor.',
    ],
    resolution:
      'Equipo retirado de circulación y batería solicitada al proveedor (pedido PR-2026-0912). Se repone en 10 días.',
  },
  {
    by: laura,
    p: 'MEDIUM',
    c: 0,
    title: 'Petición: segunda pantalla para el puesto de atención al ciudadano',
    desc: 'En el mostrador de atención trabajamos con el gestor de expedientes y el padrón a la vez; con una sola pantalla perdemos mucho tiempo cambiando de ventana.',
    flow: 'in-progress',
    comments: [
      'Hay dos monitores de 24" en almacén. Te reservo uno; instalación el jueves.',
    ],
  },
  {
    by: marc,
    p: 'HIGH',
    c: 1,
    title:
      'Correo sospechoso pidiendo cambiar la cuenta bancaria de un proveedor',
    desc: 'He recibido un correo que parece de Construcciones Puig pidiendo actualizar el IBAN para la próxima factura. El remitente es parecido pero no idéntico al habitual. No he contestado.',
    flow: 'resolved-closed',
    comments: [
      'Perfecto que no hayas contestado: es un intento de fraude (suplantación de proveedor). Lo hemos bloqueado y avisado a Intervención.',
    ],
    resolution:
      'Phishing confirmado. Remitente bloqueado en el filtro, dominio reportado, aviso a Intervención y a Contratación para verificar cualquier cambio de IBAN por teléfono.',
    internal: 'Cabeceras enviadas al CSIRT-CAT. Ref. INC-2026-0448.',
  },
  {
    by: laura,
    p: 'LOW',
    c: 2,
    title: 'El teclado del puesto 14 tiene la tecla "e" que no responde',
    desc: 'Hay que pulsar la e dos o tres veces. Es molesto para redactar. No es urgente.',
    flow: 'open',
    comments: [],
  },
  {
    by: marc,
    p: 'MEDIUM',
    c: 3,
    title: 'Alta de usuario para la nueva técnica de Medio Ambiente',
    desc: 'Se incorpora el lunes Núria Soler como técnica de Medio Ambiente. Necesita cuenta de correo, acceso al gestor de expedientes (perfil técnico) y a la carpeta del departamento.',
    flow: 'in-progress',
    comments: [
      'Cuenta creada. El acceso al gestor lo activa Secretaría cuando tenga el alta de RRHH firmada.',
    ],
  },
];
let n = 0;
for (const t of T) {
  const tk = await call(
    'POST',
    '/tickets',
    {
      organizationId: org.id,
      title: t.title,
      description: t.desc,
      priority: t.p,
      categoryId: cat(t.c),
    },
    t.by.token,
  );
  const id = tk.id ?? tk.ticket?.id;
  if (t.flow !== 'open') {
    await call(
      'PATCH',
      `/tickets/${id}/assignee`,
      { assigneeId: agent.id },
      agent.token,
    );
    await call(
      'PATCH',
      `/tickets/${id}/status`,
      { status: 'IN_PROGRESS' },
      agent.token,
    );
  }
  for (const [i, body] of t.comments.entries()) {
    await call(
      'POST',
      `/tickets/${id}/comments`,
      { body },
      i % 2 === 0 ? agent.token : t.by.token,
    );
  }
  if (t.internal)
    await call(
      'POST',
      `/tickets/${id}/comments`,
      { body: t.internal, isInternal: true },
      agent.token,
    );
  if (t.flow.startsWith('resolved')) {
    await call(
      'PATCH',
      `/tickets/${id}/status`,
      { status: 'RESOLVED', resolution: t.resolution },
      agent.token,
    );
  }
  if (t.flow === 'resolved-closed') {
    await call(
      'PATCH',
      `/tickets/${id}/status`,
      { status: 'CLOSED' },
      t.by.token,
    );
  }
  n++;
}
log(`${n} tickets creados`);

// --- 4. cierre --------------------------------------------------------------
process.stdout.write(
  `# organización "${org.name}" (${org.id}) · ${n} tickets · siembra completa\n`,
);
log(
  'cuentas emitidas por stdout (redirigido a fichero). No se registran en ningún log.',
);
