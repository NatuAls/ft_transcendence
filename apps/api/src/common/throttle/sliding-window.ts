import { redis } from '../../database/redis.ts';

export interface RateVerdict {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

/**
 * Sliding-window rate limiter backed by a Redis sorted set.
 *
 * Why a sliding window and not a fixed one: with a fixed window a caller can
 * fire `limit` requests at 11:59:59 and `limit` again at 12:00:00, so the real
 * burst is 2x the limit. The sorted set stores one entry per request with the
 * timestamp as score, we drop everything older than the window and count what
 * is left.
 */
export async function hit(key: string, limit: number, windowSeconds: number): Promise<RateVerdict> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const redisKey = `rl:${key}:${windowSeconds}`;

  try {
    const pipeline = redis.multi();
    pipeline.zremrangebyscore(redisKey, 0, now - windowMs);
    pipeline.zadd(redisKey, now, `${now}-${Math.random().toString(36).slice(2, 10)}`);
    pipeline.zcard(redisKey);
    pipeline.pexpire(redisKey, windowMs);
    const results = await pipeline.exec();

    const count = Number(results?.[2]?.[1] ?? 0);
    const allowed = count <= limit;
    return {
      allowed,
      limit,
      remaining: Math.max(0, limit - count),
      resetSeconds: windowSeconds,
    };
  } catch {
    // Redis down: do not lock users out of the whole product over rate limiting.
    return { allowed: true, limit, remaining: limit, resetSeconds: windowSeconds };
  }
}
