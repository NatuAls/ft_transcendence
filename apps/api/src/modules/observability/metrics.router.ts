// =============================================================================
//  GET /api/metrics — exposición para Prometheus
//
//  Montado FUERA del prefijo versionado, igual que las sondas: un recolector
//  de métricas no debe saber qué versión de la API está desplegada.
//
//  PROTEGIDO POR TOKEN a propósito. Un endpoint de métricas abierto regala:
//  rutas internas, volumen de negocio, versiones, y —con las series de
//  autenticación— una señal de si un ataque de fuerza bruta está funcionando.
//  Prometheus lo lee desde la red interna de Docker con un Bearer; nadie más
//  llega. Si METRICS_TOKEN no está definido, el endpoint responde 404: se
//  prefiere que no exista a que exista abierto.
//
//  Añadir a apps/api/src/app.ts, junto a las otras sondas:
//      import { metricsRouter } from './modules/observability/metrics.router.ts';
//      app.use('/api/metrics', metricsRouter);
//
//  Y a config/env.ts:
//      METRICS_TOKEN: z.string().min(24).optional(),
// =============================================================================
import { Router, type Request, type Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { renderMetrics, dependencyUp, dependencyLatency } from './metrics.ts';
import { pingDatabase } from '../../database/prisma.ts';
import { pingRedis } from '../../database/redis.ts';
import { loadConfiguration } from '../../config/env.ts';

export const metricsRouter: Router = Router();

/** Comparación en tiempo constante: un `===` filtra el token carácter a carácter. */
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Estado de las dependencias, refrescado como mucho cada 15 s.
 *
 * No se llama a las sondas en cada recolección: Prometheus consulta cada 30 s
 * y un `SELECT 1` más un `PING` por consulta es asumible, pero la verificación
 * SMTP de /api/health/ready tarda hasta 5 s cuando el host de correo no
 * existe — exactamente lo que pasa hoy en producción. Meterla aquí convertiría
 * cada recolección en un timeout. El correo se vigila desde el propio
 * /api/health/status, que ya lo hace.
 */
let cachedAt = 0;
let refreshing: Promise<void> | null = null;

async function refreshDependencies(): Promise<void> {
  const probes: Array<[string, () => Promise<boolean>]> = [
    ['database', pingDatabase],
    ['cache', pingRedis],
  ];
  await Promise.all(
    probes.map(async ([name, probe]) => {
      const started = Date.now();
      let up: number;
      try {
        up = (await probe()) ? 1 : 0;
      } catch {
        up = 0;
      }
      dependencyUp.set({ name }, up);
      dependencyLatency.set({ name }, (Date.now() - started) / 1000);
    }),
  );
  cachedAt = Date.now();
}

metricsRouter.get('/', async (req: Request, res: Response) => {
  const expected = process.env['METRICS_TOKEN'];
  if (!expected) {
    // Sin token configurado el endpoint sencillamente no existe.
    res.status(404).json({ statusCode: 404, code: 'ROUTE_NOT_FOUND' });
    return;
  }

  const header = req.header('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!provided || !tokenMatches(provided, expected)) {
    res.status(401).json({ statusCode: 401, code: 'AUTH_TOKEN_INVALID' });
    return;
  }

  if (Date.now() - cachedAt > 15_000 && !refreshing) {
    refreshing = refreshDependencies().finally(() => {
      refreshing = null;
    });
  }
  if (refreshing) await refreshing;

  const config = loadConfiguration();
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(
    `# Entorno: ${config.NODE_ENV} · versión: ${config.APP_VERSION}\n${renderMetrics()}`,
  );
});
