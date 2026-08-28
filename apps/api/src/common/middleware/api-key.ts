import type { NextFunction, Request, RequestHandler, Response } from 'express';
import * as argon2 from 'argon2';
import type { ApiScope } from 'contracts';
import { prisma } from '../../database/prisma.ts';
import { Errors } from '../errors/domain-error.ts';

/**
 * Public API authentication.
 * Key format: hdl_live_<8-char prefix>.<secret>
 * The prefix is indexed and stored in clear so we can find the row in one
 * lookup; the secret is Argon2id-hashed, so a database dump does not hand an
 * attacker working keys.
 */
export function apiKeyAuth(): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.headers['x-api-key'];
    if (typeof raw !== 'string' || raw.length < 20)
      throw Errors.apiKeyInvalid();

    const withoutEnv = raw.replace(/^hdl_(live|test)_/, '');
    const [prefix, secret] = withoutEnv.split('.');
    if (!prefix || !secret) throw Errors.apiKeyInvalid();

    const key = await prisma.apiKey.findUnique({
      where: { prefix },
      select: {
        id: true,
        keyHash: true,
        scopes: true,
        organizationId: true,
        revokedAt: true,
        expiresAt: true,
        createdBy: {
          select: {
            id: true,
            username: true,
            email: true,
            globalRole: true,
            isActive: true,
          },
        },
      },
    });

    if (!key || key.revokedAt) throw Errors.apiKeyInvalid();
    if (key.expiresAt && key.expiresAt.getTime() < Date.now())
      throw Errors.apiKeyInvalid();
    if (!key.createdBy.isActive) throw Errors.apiKeyInvalid();

    const valid = await argon2.verify(key.keyHash, secret).catch(() => false);
    if (!valid) throw Errors.apiKeyInvalid();

    req.actor = {
      id: key.createdBy.id,
      username: key.createdBy.username,
      email: key.createdBy.email,
      globalRole: key.createdBy.globalRole,
      apiKeyId: key.id,
      scopes: key.scopes as ApiScope[],
      organizationId: key.organizationId,
    };

    // Fire-and-forget: last-used tracking must never slow the request down.
    void prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    next();
  };
}

/** Scope required on the API key for a given public-API route. */
export function requireScope(scope: ApiScope): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.actor?.scopes?.includes(scope))
      throw Errors.apiKeyMissingScope(scope);
    next();
  };
}
