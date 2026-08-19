import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { verifyAccessToken } from '../jwt.ts';
import { isRevoked } from '../../database/redis.ts';
import { prisma } from '../../database/prisma.ts';
import { Errors } from '../errors/domain-error.ts';

/**
 * Step 1 of the guard chain: who are you?
 * Rejects tokens that are expired, malformed, revoked (logout / password
 * change) or that belong to a disabled account.
 *
 * A route that never calls this middleware is simply public - there is no
 * separate "@Public()" flag to forget.
 */
export function requireAuth(): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    // The public API authenticates with X-API-Key and is handled by apiKeyAuth().
    if (req.actor?.apiKeyId) return next();

    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw Errors.tokenInvalid();
    const token = header.slice('Bearer '.length).trim();

    let payload: ReturnType<typeof verifyAccessToken>;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw Errors.tokenInvalid();
    }

    if (await isRevoked(payload.jti)) throw Errors.tokenInvalid();

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        email: true,
        globalRole: true,
        isActive: true,
        deletedAt: true,
      },
    });
    if (!user || user.deletedAt) throw Errors.tokenInvalid();
    if (!user.isActive) throw Errors.accountDisabled();

    req.actor = {
      id: user.id,
      username: user.username,
      email: user.email,
      globalRole: user.globalRole,
    };
    next();
  };
}
