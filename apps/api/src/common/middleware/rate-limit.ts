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
 * Coarse per-IP limit applied to every route (300/min by default), or the
 * tighter 10/min auth-route limit for login/register/forgot-password/
 * reset-password. Runs before `requireAuth()` so floods are rejected before
 * paying for a JWT verify + DB lookup.
 */
export async function rateLimitDefault(
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const config = loadConfiguration();
  const ip = req.ip ?? 'unknown';
  const isAuthRoute =
    /\/auth\/(login|register|forgot-password|reset-password)/.test(req.path);
  const verdict = isAuthRoute
    ? await hit(`auth:${ip}`, config.RATE_LIMIT_AUTH_PER_MIN, 60)
    : await hit(`req:${ip}`, config.RATE_LIMIT_GLOBAL_PER_MIN, 60);
  enforce(verdict, res);
  _next();
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
