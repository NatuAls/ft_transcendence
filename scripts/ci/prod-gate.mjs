// =============================================================================
//  Puerta de producción — equivalente por FICHERO a la aprobación del entorno
//  `PROD` y al ruleset «PR aprobada» de GitHub.
//
//  Por qué existe: la aprobación manual de un entorno y las reglas de rama
//  son AJUSTES del repositorio (Settings → Environments / Rules), no ficheros;
//  sólo un administrador puede ponerlas, y no siempre lo somos. Este script
//  reproduce la misma garantía en el punto que importa —justo antes de
//  desplegar a producción— con lo que sí viaja en el repositorio.
//
//  Reglas (falla el job, y por tanto el despliegue, si no se cumplen):
//    · push a main  → el commit debe venir de una PR FUSIONADA contra main con
//                     al menos una aprobación de OTRA persona sobre el último
//                     commit de la PR, y sin «changes requested» pendientes.
//                     Un push directo a main no despliega.
//    · workflow_dispatch (liberación manual) → quien lo lanza debe estar en la
//                     variable de repositorio PROD_APPROVERS (logins separados
//                     por comas). Es el «botón verde» hecho a mano.
//    · PROD_APPROVERS, si está definida, restringe también quién puede
//                     aprobar la PR: al menos una aprobación debe ser suya.
//    · PROD_GATE=off desactiva la comprobación de PR (SÓLO para un repositorio
//                     personal de pruebas donde una sola persona abre y
//                     fusiona sus PR). Nunca en el repositorio del equipo.
//
//  No impide fusionar una PR mala; impide DESPLEGARLA. Se ejecuta con el
//  GITHUB_TOKEN del propio run (permiso pull-requests: read), sin secretos.
// =============================================================================
const {
  GITHUB_TOKEN,
  GITHUB_REPOSITORY,
  GITHUB_SHA,
  GITHUB_EVENT_NAME,
  GITHUB_ACTOR,
  GITHUB_REF_NAME,
  PROD_APPROVERS = '',
  PROD_GATE = '',
} = process.env;

const fail = (msg) => {
  console.log(`::error::${msg}`);
  process.exit(1);
};
const ok = (msg) => console.log(`::notice::${msg}`);

if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !GITHUB_SHA) {
  fail('faltan GITHUB_TOKEN / GITHUB_REPOSITORY / GITHUB_SHA en el entorno.');
}

const approvers = PROD_APPROVERS.split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) fail(`GitHub API ${path} → HTTP ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------- manual --
if (GITHUB_EVENT_NAME === 'workflow_dispatch') {
  const actor = (GITHUB_ACTOR ?? '').toLowerCase();
  if (approvers.length === 0) {
    fail(
      'liberación manual: define la variable de repositorio PROD_APPROVERS (logins separados por comas) con quién puede liberar a producción.',
    );
  }
  if (!approvers.includes(actor)) {
    fail(
      `liberación manual: "${GITHUB_ACTOR}" no está en PROD_APPROVERS (${approvers.join(', ')}).`,
    );
  }
  ok(`liberación manual a producción autorizada por ${GITHUB_ACTOR}.`);
  process.exit(0);
}

// ---------------------------------------------------------- push a main --
if (PROD_GATE.toLowerCase() === 'off') {
  console.log(
    '::warning::PROD_GATE=off: no se exige PR aprobada. Sólo aceptable en un repositorio personal de pruebas.',
  );
  process.exit(0);
}

const prs = await api(
  `/repos/${GITHUB_REPOSITORY}/commits/${GITHUB_SHA}/pulls`,
);
const merged = prs.filter(
  (p) => p.merged_at && p.base?.ref === GITHUB_REF_NAME,
);
if (merged.length === 0) {
  fail(
    `el commit ${GITHUB_SHA.slice(0, 7)} en ${GITHUB_REF_NAME} no viene de una PR fusionada: producción sólo se despliega desde una PR aprobada (no desde un push directo).`,
  );
}
const pr = merged[0];
const author = pr.user.login.toLowerCase();
const reviews = await api(
  `/repos/${GITHUB_REPOSITORY}/pulls/${pr.number}/reviews?per_page=100`,
);

// Último veredicto de cada revisor distinto del autor.
const last = new Map();
for (const r of reviews) {
  const who = r.user.login.toLowerCase();
  if (who === author) continue;
  if (r.state === 'APPROVED' || r.state === 'CHANGES_REQUESTED')
    last.set(who, r);
}
const blocking = [...last.values()].filter(
  (r) => r.state === 'CHANGES_REQUESTED',
);
if (blocking.length > 0) {
  fail(
    `la PR #${pr.number} tiene cambios solicitados sin resolver por ${blocking.map((r) => r.user.login).join(', ')}.`,
  );
}
// La aprobación debe ser sobre el ÚLTIMO commit de la PR: una aprobación
// anterior a un push posterior no cuenta (equivale a «dismiss stale reviews»).
const approved = [...last.values()].filter(
  (r) => r.state === 'APPROVED' && r.commit_id === pr.head.sha,
);
if (approved.length === 0) {
  fail(
    `la PR #${pr.number} («${pr.title}») no tiene ninguna aprobación de otra persona sobre su último commit ${pr.head.sha.slice(0, 7)}. Producción no se despliega sin revisión.`,
  );
}
if (
  approvers.length > 0 &&
  !approved.some((r) => approvers.includes(r.user.login.toLowerCase()))
) {
  fail(
    `la PR #${pr.number} está aprobada por ${approved.map((r) => r.user.login).join(', ')}, pero ninguno está en PROD_APPROVERS (${approvers.join(', ')}).`,
  );
}
ok(
  `PR #${pr.number} aprobada por ${approved.map((r) => r.user.login).join(', ')} sobre ${pr.head.sha.slice(0, 7)}: despliegue a producción autorizado.`,
);
