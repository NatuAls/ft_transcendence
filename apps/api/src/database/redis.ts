import { Redis } from 'ioredis';
import { loadConfiguration } from '../config/env.ts';
import { createLogger } from '../common/logger.ts';

const logger = createLogger('redis');

/**
 * Redis holds only ephemeral state: JWT revocation list, sliding-window rate
 * limit counters, presence and the RBAC membership cache. Nothing here is a
 * source of truth, so losing Redis degrades the app but never corrupts data.
 *
 * NOTE: `import { Redis }` (named), not `import Redis from 'ioredis'`
 * (default) - ioredis is a CJS package, and under native ESM a default
 * import of a CJS module binds to the whole `module.exports` namespace
 * object, not to `exports.default`. The named export is the one Node's
 * CJS/ESM interop resolves correctly at runtime.
 */
export const redis = new Redis(loadConfiguration().REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 200, 3000),
});

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
    logger.info('redis connected');
  } catch (error) {
    logger.error('redis unavailable at boot; running in degraded mode', error);
  }
}

export function disconnectRedis(): void {
  redis.disconnect();
}

export async function pingRedis(): Promise<boolean> {
  try {
    return (await redis.ping()) === 'PONG';
  } catch {
    return false;
  }
}

// ---- token revocation -------------------------------------------------------
export async function revokeJti(jti: string, ttlSeconds: number): Promise<void> {
  await redis.set(`revoked:${jti}`, '1', 'EX', Math.max(ttlSeconds, 1));
}

export async function isRevoked(jti: string): Promise<boolean> {
  try {
    return (await redis.exists(`revoked:${jti}`)) === 1;
  } catch {
    // Fail open: locking everyone out on a Redis blip is worse than the risk -
    // the token still has a short lifetime, and refresh rotation is checked
    // against Postgres separately.
    return false;
  }
}

// ---- presence -----------------------------------------------------------------
export async function touchPresence(userId: string, ttlSeconds = 60): Promise<void> {
  await redis.set(`presence:${userId}`, Date.now().toString(), 'EX', ttlSeconds);
}

export async function clearPresence(userId: string): Promise<void> {
  await redis.del(`presence:${userId}`);
}

export async function isOnline(userId: string): Promise<boolean> {
  try {
    return (await redis.exists(`presence:${userId}`)) === 1;
  } catch {
    return false;
  }
}
