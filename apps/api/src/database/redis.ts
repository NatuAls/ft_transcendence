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
export async function revokeJti(
  jti: string,
  ttlSeconds: number,
): Promise<void> {
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

/**
 * Revokes EVERY access token issued to a user before this instant.
 *
 * A per-`jti` deny list can only revoke tokens whose id we happen to know -
 * that covers "log this device out", but not logout-all, a password change or
 * a password reset, where the other devices' `jti` values were never handed to
 * this request. One cutoff timestamp per user solves that: any token whose
 * `iat` is older than the cutoff is refused.
 *
 * The key only has to outlive the longest access token still in circulation,
 * so the caller passes the access-token lifetime plus some clock slack. After
 * that, every token issued before the cutoff has expired on its own anyway.
 */
export async function revokeTokensIssuedBefore(
  userId: string,
  ttlSeconds: number,
): Promise<void> {
  const key = `revoked-before:${userId}`;
  const now = Math.floor(Date.now() / 1000);

  // The cutoff must never move backwards. `issueTokens()` stamps a token minted
  // inside the cutoff second with `iat = cutoff + 1` so that a login right
  // after a logout-all is not killed by its own cutoff - which means a token
  // can legitimately carry an `iat` one second in the future. A second
  // revocation within that same wall-clock second would otherwise write a
  // cutoff BELOW those tokens and leave them alive. Taking `max(now,
  // previous + 1)` keeps the ordering intact; the cutoff can only run ahead of
  // real time by as many seconds as there were revocations inside one second,
  // and it catches up by itself.
  const previous = Number((await redis.get(key).catch(() => null)) ?? 0);
  const cutoff = Math.max(now, previous + 1);

  await redis.set(key, cutoff.toString(), 'EX', Math.max(ttlSeconds, 1));
}

/** Unix seconds before which this user's access tokens are no longer valid. */
export async function tokensRevokedBefore(userId: string): Promise<number> {
  try {
    const value = await redis.get(`revoked-before:${userId}`);
    return value ? Number(value) : 0;
  } catch {
    // Same fail-open reasoning as isRevoked(): Postgres stays the source of
    // truth for the refresh chain and the access token expires by itself.
    return 0;
  }
}

// ---- presence -----------------------------------------------------------------
export async function touchPresence(
  userId: string,
  ttlSeconds = 60,
): Promise<void> {
  await redis.set(
    `presence:${userId}`,
    Date.now().toString(),
    'EX',
    ttlSeconds,
  );
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
