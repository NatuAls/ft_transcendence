import { Router } from 'express';
import { statfs } from 'node:fs/promises';
import { pingDatabase } from '../../database/prisma.ts';
import { pingRedis } from '../../database/redis.ts';
import { verifyMail } from '../mail/mail.service.ts';
import { loadConfiguration } from '../../config/env.ts';
import { rateLimitDefault } from '../../common/middleware/rate-limit.ts';

interface ServiceStatus {
  name: string;
  status: 'up' | 'degraded' | 'down';
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
    return {
      name,
      status: ok ? 'up' : optional ? 'degraded' : 'down',
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      name,
      status: optional ? 'degraded' : 'down',
      latencyMs: Date.now() - started,
      detail: (error as Error).message.slice(0, 120),
    };
  }
}

async function probe(): Promise<ServiceStatus[]> {
  const config = loadConfiguration();
  return Promise.all([
    timed('database', () => pingDatabase()),
    timed('cache', () => pingRedis(), true),
    timed('mail', () => verifyMail(), true),
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
}

/**
 * Health checks and status page.
 *   /api/health        liveness  - is the process alive? (used by Docker)
 *   /api/health/ready  readiness - can it actually serve? (DB, Redis, disk, SMTP)
 *   /api/health/status public payload behind a status page
 *
 * Mounted OUTSIDE the versioned /api/v1 prefix (see routing.ts) - Docker's
 * HEALTHCHECK should never have to know which API version is deployed.
 */
export const healthRouter: Router = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - bootedAt) / 1000),
  });
});

/**
 * `/ready` and `/status` are not the same kind of endpoint as `/api/health`.
 *
 * The liveness probe above answers from memory, so it stays unlimited: Docker's
 * HEALTHCHECK must never be throttled into marking a healthy container
 * unhealthy. These two are anonymous endpoints that make the API do real work
 * on every call - a Postgres query, a Redis PING, an SMTP connection to the
 * mail host and a filesystem stat. Left unlimited (and they were: the probes
 * sit outside the versioned prefix, where none of the middleware runs) they let
 * anyone turn one cheap HTTP request into four dependency round trips,
 * including a TCP handshake against the mail server.
 */
healthRouter.get('/ready', rateLimitDefault, async (_req, res) => {
  const services = await probe();
  const down = services.filter((s) => s.status === 'down');
  res.json({
    status: down.length === 0 ? 'ok' : 'degraded',
    services,
    ...(down.length > 0 ? { failing: down.map((s) => s.name) } : {}),
  });
});

healthRouter.get('/status', rateLimitDefault, async (_req, res) => {
  const config = loadConfiguration();
  const services = await probe();
  const worst = services.some((s) => s.status === 'down')
    ? 'major_outage'
    : services.some((s) => s.status === 'degraded')
      ? 'degraded'
      : 'operational';
  res.json({
    overall: worst,
    version: config.APP_VERSION,
    uptimeSeconds: Math.floor((Date.now() - bootedAt) / 1000),
    checkedAt: new Date().toISOString(),
    services,
  });
});

export const versionRouter: Router = Router();

versionRouter.get('/', (_req, res) => {
  const config = loadConfiguration();
  res.json({
    name: 'HelpDesk Lite',
    version: config.APP_VERSION,
    commit: process.env['GIT_COMMIT'] ?? 'local',
    builtAt: process.env['BUILD_TIME'] ?? null,
    node: process.version,
  });
});
