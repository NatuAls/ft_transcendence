// =============================================================================
//  Sondas y página de estado — v2
//
//  SUSTITUYE a apps/api/src/modules/health/health.router.ts.
//
//  Tres cambios, todos de la tarea DevOps 9:
//
//  1. /api/health/status DEJA DE FILTRAR DETALLE INTERNO.
//     La v1 devolvía a cualquiera, sin autenticación:
//         nombres de dependencias, latencia exacta de cada una, la versión
//         desplegada, el uptime del proceso y, en `detail`, el mensaje de
//         error del fallo (que para SMTP incluye el nombre del host interno).
//     Eso es un mapa de la infraestructura: el uptime dice cuándo se desplegó
//     por última vez, la latencia dice si la base está saturada, y el detalle
//     dice qué software hay detrás. La tarea pide expresamente exponerla
//     «sin revelar detalles internos al público».
//     Ahora la respuesta pública es un semáforo por ÁREA FUNCIONAL, y el
//     detalle completo sólo se sirve con el token de operación.
//
//  2. La sonda de correo deja de bloquear la respuesta pública.
//     verifyMail() tarda 5 s cuando SMTP_HOST no existe —que es lo que pasa
//     hoy en producción—, así que cada llamada anónima a /status costaba cinco
//     segundos de un socket. Con 300 peticiones/minuto permitidas eso es un
//     amplificador de denegación de servicio barato. Ahora el correo se
//     comprueba EN SEGUNDO PLANO cada 60 s y la petición sirve el último
//     resultado conocido.
//
//  3. Se alimentan las métricas de Prometheus con el resultado de las sondas.
// =============================================================================
import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { statfs } from 'node:fs/promises';
import { pingDatabase } from '../../database/prisma.ts';
import { pingRedis } from '../../database/redis.ts';
import { verifyMail } from '../mail/mail.service.ts';
import { loadConfiguration } from '../../config/env.ts';
import { rateLimitDefault } from '../../common/middleware/rate-limit.ts';
import { dependencyUp, dependencyLatency } from '../observability/metrics.ts';

type Health = 'up' | 'degraded' | 'down';

interface ServiceStatus {
  name: string;
  status: Health;
  latencyMs: number | null;
  detail?: string;
}

const bootedAt = Date.now();

async function timed(
  name: string,
  probe: () => Promise<boolean>,
  optional = false,
): Promise<ServiceStatus> {
  const started = Date.now();
  try {
    const ok = await probe();
    const status: Health = ok ? 'up' : optional ? 'degraded' : 'down';
    const latencyMs = Date.now() - started;
    dependencyUp.set({ name }, ok ? 1 : optional ? 0.5 : 0);
    dependencyLatency.set({ name }, latencyMs / 1000);
    return { name, status, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - started;
    dependencyUp.set({ name }, optional ? 0.5 : 0);
    dependencyLatency.set({ name }, latencyMs / 1000);
    return {
      name,
      status: optional ? 'degraded' : 'down',
      latencyMs,
      detail: (error as Error).message.slice(0, 120),
    };
  }
}

// -----------------------------------------------------------------------------
//  Sonda de correo en segundo plano.
//
//  verifyMail() abre un socket SMTP. Cuando el host no existe, el sistema
//  operativo tarda ~5 s en rendirse. Dejar eso en la ruta de una petición
//  anónima significa que cualquiera puede mantener 300 sockets colgando por
//  minuto. Se saca del camino crítico: un temporizador la ejecuta cada minuto
//  y las peticiones leen la última respuesta.
// -----------------------------------------------------------------------------
let mailStatus: ServiceStatus = {
  name: 'mail',
  status: 'degraded',
  latencyMs: null,
  detail: 'aún sin comprobar',
};

async function refreshMail(): Promise<void> {
  mailStatus = await timed('mail', verifyMail, true);
}
void refreshMail();
const mailTimer = setInterval(() => void refreshMail(), 60_000);
mailTimer.unref();

async function probe(): Promise<ServiceStatus[]> {
  const config = loadConfiguration();
  const [database, cache, storage] = await Promise.all([
    timed('database', pingDatabase),
    timed('cache', pingRedis, true),
    timed(
      'storage',
      async () => {
        const stats = await statfs(config.UPLOAD_DIR).catch(() => null);
        if (!stats) return false;
        const freeRatio = Number(stats.bavail) / Number(stats.blocks || 1);
        return freeRatio > 0.05;
      },
      true,
    ),
  ]);
  return [database!, cache!, mailStatus, storage!];
}

/** ¿Trae la petición el token de operación? Decide cuánto detalle se sirve. */
function isOperator(authorization: string | undefined): boolean {
  const expected = process.env['METRICS_TOKEN'];
  if (!expected || !authorization?.startsWith('Bearer ')) return false;
  const provided = Buffer.from(authorization.slice(7));
  const wanted = Buffer.from(expected);
  return provided.length === wanted.length && timingSafeEqual(provided, wanted);
}

export const healthRouter: Router = Router();

/** Liveness. Responde de memoria y NO se limita: lo consulta Docker. */
healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - bootedAt) / 1000),
  });
});

/**
 * Readiness. Sigue siendo pública porque el smoke test del despliegue la lee
 * desde dentro del contenedor, pero el `detail` de los errores —el único
 * campo que puede contener nombres de host internos— se sirve sólo al
 * operador.
 */
healthRouter.get('/ready', rateLimitDefault, async (req, res) => {
  const services = await probe();
  const operator = isOperator(req.header('authorization'));
  const down = services.filter((s) => s.status === 'down');
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    status: down.length === 0 ? 'ok' : 'degraded',
    services: services.map((s) =>
      operator ? s : { name: s.name, status: s.status, latencyMs: s.latencyMs },
    ),
    ...(down.length > 0 ? { failing: down.map((s) => s.name) } : {}),
  });
});

/**
 * Página de estado PÚBLICA.
 *
 * Contrato deliberado: áreas funcionales, no componentes. Al usuario le
 * importa si puede entrar y abrir un ticket, no si el problema es de Redis.
 * Y a quien no sea usuario no le corresponde saber qué hay detrás.
 */
const PUBLIC_AREAS: Array<{ area: string; depends: string[] }> = [
  { area: 'autenticacion', depends: ['database'] },
  { area: 'tickets', depends: ['database'] },
  { area: 'adjuntos', depends: ['database', 'storage'] },
  { area: 'tiempo_real', depends: ['cache'] },
  { area: 'notificaciones_por_correo', depends: ['mail'] },
];

const WORST: Record<Health, number> = { up: 0, degraded: 1, down: 2 };

healthRouter.get('/status', rateLimitDefault, async (req, res) => {
  const services = await probe();
  const byName = new Map(services.map((s) => [s.name, s.status] as const));
  const config = loadConfiguration();

  if (isOperator(req.header('authorization'))) {
    // Vista de operación: todo el detalle, igual que la v1.
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      overall: services.some((s) => s.status === 'down')
        ? 'major_outage'
        : services.some((s) => s.status === 'degraded')
          ? 'degraded'
          : 'operational',
      version: config.APP_VERSION,
      commit: process.env['GIT_COMMIT'] ?? 'local',
      uptimeSeconds: Math.floor((Date.now() - bootedAt) / 1000),
      checkedAt: new Date().toISOString(),
      services,
    });
    return;
  }

  const areas = PUBLIC_AREAS.map(({ area, depends }) => {
    const worst = depends
      .map((d) => byName.get(d) ?? 'degraded')
      .reduce<Health>((a, b) => (WORST[b] > WORST[a] ? b : a), 'up');
    return {
      area,
      // Vocabulario de página de estado, no de infraestructura.
      status:
        worst === 'up'
          ? 'operativo'
          : worst === 'degraded'
            ? 'rendimiento_reducido'
            : 'no_disponible',
    };
  });

  const overall = areas.every((a) => a.status === 'operativo')
    ? 'operational'
    : areas.some((a) => a.status === 'no_disponible')
      ? 'major_outage'
      : 'degraded';

  // 60 s de caché: la página de estado la consulta un uptime checker cada
  // minuto y no tiene sentido volver a sondear la base en cada visita.
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({
    overall,
    areas,
    checkedAt: new Date().toISOString(),
  });
});

export const versionRouter: Router = Router();

/**
 * /api/version identifica el artefacto desplegado. El smoke test del
 * despliegue lo compara con el SHA esperado, así que tiene que seguir
 * respondiendo desde dentro del contenedor; pero el commit exacto y la fecha
 * de construcción son información de infraestructura y ahora sólo se sirven
 * al operador o desde la red interna.
 */
versionRouter.get('/', (req, res) => {
  const config = loadConfiguration();
  const internal =
    isOperator(req.header('authorization')) ||
    // El smoke test corre dentro del propio contenedor.
    ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip ?? '');

  if (!internal) {
    res.json({ name: 'HelpDesk Lite', version: config.APP_VERSION });
    return;
  }

  res.json({
    name: 'HelpDesk Lite',
    version: config.APP_VERSION,
    commit: process.env['GIT_COMMIT'] ?? 'local',
    builtAt: process.env['BUILD_TIME'] ?? null,
    node: process.version,
  });
});
