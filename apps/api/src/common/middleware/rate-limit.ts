import type { NextFunction, Request, Response } from 'express';
import { hit, type RateVerdict } from '../throttle/sliding-window.ts';
import { loadConfiguration } from '../../config/env.ts';
import { Errors } from '../errors/domain-error.ts';

function applyHeaders(res: Response, verdict: RateVerdict): void {
  res.setHeader('RateLimit-Limit', verdict.limit);
  res.setHeader('RateLimit-Remaining', verdict.remaining);
  res.setHeader('RateLimit-Reset', verdict.resetSeconds);
}

function enforce(verdict: RateVerdict, res: Response): void {
  applyHeaders(res, verdict);
  if (!verdict.allowed) {
    res.setHeader('Retry-After', verdict.resetSeconds);
    throw Errors.rateLimited(verdict.resetSeconds);
  }
}

/**
 * The credential-guessing surface: login, register, forgot-password and
 * reset-password. These get the tight per-IP bucket (10/min by default)
 * instead of the coarse 300/min one.
 *
 * NOTE: this pattern is matched against `req.originalUrl`, never `req.path`.
 * Inside a mounted router (`v1.use('/auth', authRouter)`) `req.path` is
 * relative to the mount point - it reads `/login`, not
 * `/api/v1/auth/login` - so a pattern anchored on `/auth/` never matched and
 * every credential route silently fell back to the 300/min bucket. The `i`
 * flag is deliberate too: Express routing is case-insensitive by default, so
 * `/API/V1/AUTH/LOGIN` reaches the same handler.
 */
const CREDENTIAL_ROUTES =
  /\/auth\/(login|register|forgot-password|reset-password|resend-verification)(\/|\?|$)/i;

/**
 * Tight per-IP limit for the credential routes. Applied explicitly by
 * `auth.router.ts` so the protection does not depend on a path pattern
 * staying in sync with the routing table.
 */
export async function rateLimitAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const config = loadConfiguration();
  const ip = req.ip ?? 'unknown';
  enforce(await hit(`auth:${ip}`, config.RATE_LIMIT_AUTH_PER_MIN, 60), res);
  next();
}

/**
 * Coarse per-IP limit applied to every route (300/min by default), or the
 * tighter auth-route limit when the URL is one of the credential routes.
 * Runs before `requireAuth()` so floods are rejected before paying for a JWT
 * verify + DB lookup.
 */
export async function rateLimitDefault(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const config = loadConfiguration();
  const ip = req.ip ?? 'unknown';
  const isCredentialRoute = CREDENTIAL_ROUTES.test(req.originalUrl ?? req.url);
  const verdict = isCredentialRoute
    ? await hit(`auth:${ip}`, config.RATE_LIMIT_AUTH_PER_MIN, 60)
    : await hit(`req:${ip}`, config.RATE_LIMIT_GLOBAL_PER_MIN, 60);
  enforce(verdict, res);
  next();
}

/**
 * Fine-grained per-API-key limit (60/min + 1000/hour). Only meaningful after
 * `apiKeyAuth()` has populated `req.actor.apiKeyId`.
 */
export async function rateLimitApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const config = loadConfiguration();
  const apiKeyId = req.actor?.apiKeyId;
  if (!apiKeyId) return next();

  const perMinute = await hit(
    `key:${apiKeyId}:m`,
    config.API_KEY_RATE_PER_MIN,
    60,
  );
  const perHour = await hit(
    `key:${apiKeyId}:h`,
    config.API_KEY_RATE_PER_HOUR,
    3600,
  );
  enforce(!perMinute.allowed ? perMinute : perHour, res);
  next();
}
