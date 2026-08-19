import { rateLimitDefault, rateLimitApiKey } from './rate-limit.ts';
import { requireAuth } from './auth.ts';
import { apiKeyAuth } from './api-key.ts';

/** Rate-limit -> auth. The common prefix for any session-authenticated route. */
export const authed = [rateLimitDefault, requireAuth()];

/**
 * Coarse per-IP limit (protects against invalid/brute-forced keys) -> key
 * auth -> fine per-key limit. Deliberately rate-limits twice: once before the
 * key is known, once after.
 */
export const apiKeyRoute = [rateLimitDefault, apiKeyAuth(), rateLimitApiKey];
