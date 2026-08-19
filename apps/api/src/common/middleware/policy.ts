import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { canPolicy, type PolicyId } from '../../rbac/rbac.ts';
import { Errors } from '../errors/domain-error.ts';

function isRecordScoped(policy: PolicyId): boolean {
  return (
    policy.startsWith('ticket:') ||
    policy.startsWith('comment:') ||
    policy.startsWith('attachment:') ||
    policy === 'member:leave' ||
    policy === 'organization:delete'
  );
}

/**
 * Step 3 of the guard chain: is your role allowed to perform THIS action?
 * Record-level checks (ownership, ticket status) happen inside the services,
 * where the record has actually been loaded - a record-scoped policy denial
 * here is not rejected, only the cases where no possible record could make
 * it allowed.
 */
export function requirePolicy(policy: PolicyId): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const actor = req.actor;
    if (!actor) return next();

    const allowed = canPolicy(policy, {
      userId: actor.id,
      isGlobalAdmin: actor.globalRole === 'GLOBAL_ADMIN',
      orgRole: req.membership?.role,
    });

    if (!allowed && !isRecordScoped(policy)) {
      throw Errors.forbiddenAction(policy);
    }
    next();
  };
}

/** Platform administrators only. */
export function requireGlobalAdmin(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.actor?.globalRole !== 'GLOBAL_ADMIN') {
      throw Errors.forbiddenAction('administer the platform');
    }
    next();
  };
}
