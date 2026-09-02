import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { verifyAccessToken } from '../jwt.ts';
import { isRevoked, tokensRevokedBefore } from '../../database/redis.ts';
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

    // Two revocation checks, because they cover different situations:
    //   - the jti deny list kills THIS token (logout of one device, refresh
    //     reuse detection);
    //   - the per-user cutoff kills every token issued before an instant,
    //     which is the only way to cover logout-all, a password change or a
    //     reset, where the other devices' jti values are unknown here.
    if (await isRevoked(payload.jti)) throw Errors.tokenInvalid();
    const cutoff = await tokensRevokedBefore(payload.sub);
    // `<=`, not `<`: `iat` has one-second resolution, so a token minted in the
    // same second as the revocation is ambiguous and has to be treated as
    // older. `issueTokens()` compensates by stamping a token issued in that
    // same second with `iat = cutoff + 1`, so a fresh login right after a
    // logout-all is never caught by its own cutoff.
    if (cutoff && (payload.iat ?? 0) <= cutoff) throw Errors.tokenInvalid();

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
    // Kept on the request so /auth/logout can revoke this exact token instead
    // of leaving it valid until it expires on its own.
    req.accessToken = payload;
    next();
  };
}
