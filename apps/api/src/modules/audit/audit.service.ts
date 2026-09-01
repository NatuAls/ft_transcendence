import type { Request } from 'express';
import { prisma } from '../../database/prisma.ts';
import { createLogger } from '../../common/logger.ts';
import type { RequestActor } from '../../common/types.ts';

const logger = createLogger('audit');

/**
 * ============================================================================
 *  AUDIT TRAIL
 *
 *  `GET /api/v1/admin/audit-logs` reads the `audit_logs` table, and the
 *  `AuditLog` model has been in the schema since the initial migration - but
 *  nothing ever wrote a row, so the endpoint answered an empty page no matter
 *  what happened in the system. This module is the missing writer.
 *
 *  What belongs here, and what does not:
 *
 *    - The audit log records WHO did WHAT, WHEN and FROM WHERE for the actions
 *      an administrator may later have to answer for: role changes, account
 *      suspensions, deletions, organization and API-key management, and the
 *      irreversible GDPR operations.
 *    - `TicketHistory` already records the per-ticket domain trail (status,
 *      assignee, priority) and notifications already tell users what happened
 *      to their own data. Duplicating those here would drown the useful rows.
 *
 *  Writes are deliberately best-effort and never awaited by the caller's
 *  critical path: failing to record an audit row must not roll back the action
 *  that was already committed, and must not turn a 204 into a 500.
 * ============================================================================
 */

export type AuditAction =
  // account and platform
  | 'user.role.changed'
  | 'user.status.changed'
  | 'user.deleted'
  // organizations
  | 'organization.created'
  | 'organization.updated'
  | 'organization.deleted'
  | 'member.invited'
  | 'member.role.changed'
  | 'member.removed'
  // credentials
  | 'apiKey.created'
  | 'apiKey.revoked'
  // privacy
  | 'gdpr.export.confirmed'
  | 'gdpr.delete.confirmed';

export interface AuditContext {
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditEntry {
  actor:
    Pick<RequestActor, 'id' | 'apiKeyId'> | { id: string; apiKeyId?: string };
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  context?: AuditContext;
}

/**
 * `before`/`after` are snapshots, not full records: only the fields the action
 * actually changed, and never anything secret. Password hashes, API-key
 * hashes and tokens must never reach this table - an audit log that leaks
 * credentials is worse than no audit log.
 */
function sanitise(value: unknown): object | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object') return { value };
  const forbidden =
    /password|passwordhash|keyhash|tokenhash|secret|pepper|refreshtoken/i;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (forbidden.test(key)) continue;
    out[key] = val instanceof Date ? val.toISOString() : val;
  }
  return out;
}

/**
 * Records one audited action. Never throws: a failure here is logged and
 * swallowed, because the business action it describes has already happened.
 */
export async function record(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actor.id,
        apiKeyId: entry.actor.apiKeyId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        before: (sanitise(entry.before) ?? null) as never,
        after: (sanitise(entry.after) ?? null) as never,
        ip: entry.context?.ip?.slice(0, 64) ?? null,
        userAgent: entry.context?.userAgent?.slice(0, 400) ?? null,
      },
    });
  } catch (error) {
    logger.error(`could not record audit entry ${entry.action}`, error);
  }
}

/**
 * Fire-and-forget variant for handlers that have already produced their
 * response. Same guarantees, minus the await.
 */
export function recordAsync(entry: AuditEntry): void {
  void record(entry);
}

/** `req.ip` is the real client because app.ts sets `trust proxy`. */
export function contextOf(req: Request): AuditContext {
  return {
    ip: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

/**
 * Router-side shorthand: `audit.from(req)` captures the actor and the request
 * context once, so a handler only states what changed.
 */
export function from(req: Request) {
  const actor = req.actor;
  const context = contextOf(req);
  return (
    action: AuditAction,
    entity: string,
    entityId?: string | null,
    diff: { before?: unknown; after?: unknown } = {},
  ): void => {
    if (!actor) return;
    recordAsync({ actor, action, entity, entityId, context, ...diff });
  };
}
