import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { OrgRole } from '../../generated/prisma/client.ts';
import { ORG_ROLE_RANK } from '../types.ts';
import { membershipOf } from '../../rbac/rbac.ts';
import { Errors } from '../errors/domain-error.ts';

function resolveOrganizationId(req: Request): string | undefined {
  const params = req.params as Record<string, string | undefined>;
  const query = req.query as Record<string, unknown>;
  const body = (req.body ?? {}) as Record<string, unknown>;
  return (
    params['organizationId'] ??
    params['orgId'] ??
    (typeof query['organizationId'] === 'string' ? query['organizationId'] : undefined) ??
    (typeof body['organizationId'] === 'string' ? (body['organizationId'] as string) : undefined) ??
    req.actor?.organizationId
  );
}

/**
 * Step 2 of the guard chain: do you belong to this organization, and with
 * what role? This is what makes multi-tenant isolation real rather than a
 * frontend filter.
 *
 * Note the deliberate choice of status code: a non-member gets 404, not 403.
 * Returning 403 would confirm that the resource exists, which is an
 * information leak between organizations.
 */
export function orgScope(options: { minRoles?: OrgRole[] } = {}): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const actor = req.actor;
    if (!actor) return next();

    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      // No organization in scope: nothing for this middleware to enforce.
      if (options.minRoles?.length) throw Errors.notAMember();
      return next();
    }

    const membership = await membershipOf(actor.id, organizationId);
    req.membership = membership;

    if (!membership) {
      if (actor.globalRole === 'GLOBAL_ADMIN') return next();
      throw Errors.notAMember();
    }

    if (options.minRoles?.length) {
      const needed = Math.min(...options.minRoles.map((role) => ORG_ROLE_RANK[role]));
      if (ORG_ROLE_RANK[membership.role] < needed && actor.globalRole !== 'GLOBAL_ADMIN') {
        throw Errors.forbiddenAction(`act as ${options.minRoles.join(' or ')}`);
      }
    }

    next();
  };
}
