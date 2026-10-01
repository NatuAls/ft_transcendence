/**
 * ==============================================================================
 *  Who may read the API documentation
 *
 *  The reference describes 105 routes, their payloads and their rules. That is
 *  a map of the application, and a map is worth more to someone probing it
 *  than to anyone else. So the page is NOT open on the internet: it sits
 *  behind two independent doors, and either one alone is already enough.
 *
 *      1. Nginx asks for a team credential (HTTP Basic, `.htpasswd` injected
 *         at deploy time, never in the repository or the image).
 *      2. This middleware then requires proof that the request really came
 *         through that Nginx - a shared header - or, failing that, a session
 *         of a GLOBAL_ADMIN.
 *
 *  Two doors and not one because each covers the other's blind spot: Basic
 *  Auth alone would be bypassed by anything that reached the container
 *  directly on the internal network, and the header alone would be bypassed by
 *  anyone who could set it from outside - which they cannot, because Nginx
 *  overwrites it on every request.
 *
 *  `DOCS_ACCESS` decides the mode:
 *
 *      gateway   (default in production) header from Nginx, or admin session
 *      session   admin session only - useful when hitting the API directly
 *      public    no check; the default in development, never in production
 *      disabled  the routes answer 404, as if they did not exist
 *
 *  Note the 404: a 401 or a 403 would confirm that the documentation is there
 *  and invite a brute-force attempt. When it is off, it is simply not there.
 * ==============================================================================
 */
import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { loadConfiguration } from '../../config/env.ts';
import { verifyAccessToken } from '../../common/jwt.ts';
import { createLogger } from '../../common/logger.ts';

const logger = createLogger('docs-access');

export type DocsAccessMode = 'gateway' | 'session' | 'public' | 'disabled';

/** Header Nginx sets - and overwrites - after Basic Auth has passed. */
export const GATEWAY_HEADER = 'x-docs-gateway';

/**
 * The effective mode. `public` is only allowed outside production: a
 * deployment that forgets to configure this ends up closed, not open.
 */
export function docsAccessMode(): DocsAccessMode {
  const config = loadConfiguration();
  const declared = config.DOCS_ACCESS;
  if (declared) {
    if (declared === 'public' && config.NODE_ENV === 'production') {
      logger.warn(
        'DOCS_ACCESS=public ignored in production: the documentation stays behind the gateway',
      );
      return 'gateway';
    }
    return declared;
  }
  return config.NODE_ENV === 'production' ? 'gateway' : 'public';
}

/** Constant-time comparison, so the token cannot be guessed character by character. */
function sameToken(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // timingSafeEqual throws on different lengths; compare against itself to
    // spend a comparable amount of time before answering no.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

function cameThroughGateway(req: Request): boolean {
  const expected = loadConfiguration().DOCS_GATEWAY_TOKEN;
  if (!expected) return false;
  const received = req.headers[GATEWAY_HEADER];
  return typeof received === 'string' && sameToken(received, expected);
}

/** A GLOBAL_ADMIN presenting a valid access token. */
function isAdminSession(req: Request): boolean {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return false;
  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length).trim());
    return payload.role === 'GLOBAL_ADMIN';
  } catch {
    return false;
  }
}

/**
 * Guard for the documentation routes. It answers 404 - never 401 or 403 - so
 * that an unauthorised visitor cannot even tell the documentation exists.
 */
export function requireDocsAccess(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const mode = docsAccessMode();
    if (mode === 'public') return next();
    if (mode === 'disabled') return notFound(res);

    if (mode === 'gateway' && cameThroughGateway(req)) return next();
    if (isAdminSession(req)) return next();

    logger.debug(
      `documentation refused (mode ${mode}) for ${req.ip ?? 'unknown'}`,
    );
    return notFound(res);
  };
}

function notFound(res: Response): void {
  res.status(404).json({
    statusCode: 404,
    code: 'NOT_FOUND',
    messageKey: 'errors.common.notFound',
    message: 'Resource not found.',
    requestId: res.getHeader('X-Request-Id') ?? 'unknown',
    timestamp: new Date().toISOString(),
    path: 'unknown',
  });
}
