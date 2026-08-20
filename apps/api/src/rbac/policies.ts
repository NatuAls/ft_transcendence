import type { OrgRole, TicketStatus } from '../generated/prisma/client.ts';
import { ORG_ROLE_RANK } from '../common/types.ts';

/**
 * ============================================================================
 *  RBAC policy table.
 *
 *  Two dimensions:
 *    - global role : USER | GLOBAL_ADMIN
 *    - org role    : MEMBER | AGENT | ORG_ADMIN
 *
 *  GLOBAL_ADMIN bypasses org-role checks but NOT ownership-of-content rules
 *  that exist for integrity reasons (e.g. an admin still cannot rewrite
 *  someone else's comment body silently - they delete it instead).
 *
 *  This is pure TypeScript - no framework, no database, no request object -
 *  which is what makes it exhaustively unit-testable.
 * ============================================================================
 */

export interface PolicySubject {
  userId: string;
  isGlobalAdmin: boolean;
  orgRole?: OrgRole;
}

export interface PolicyResource {
  ownerId?: string | null;
  assigneeId?: string | null;
  status?: TicketStatus;
  createdAt?: Date;
  isInternal?: boolean;
  isLastAdmin?: boolean;
}

interface PolicyRule {
  /** Minimum organization role. `undefined` means no organization needed. */
  minRole?: OrgRole;
  /** If the subject is below `minRole`, this escape hatch can still allow it. */
  ownRecord?: (subject: PolicySubject, resource: PolicyResource) => boolean;
  /** Platform administrators only, ignores organization role entirely. */
  globalAdminOnly?: boolean;
  /** Extra condition that must hold even for higher roles. */
  precondition?: (subject: PolicySubject, resource: PolicyResource) => boolean;
  description: string;
}

const isOwner = (s: PolicySubject, r: PolicyResource) =>
  Boolean(r.ownerId && r.ownerId === s.userId);
const withinMinutes =
  (minutes: number) => (_s: PolicySubject, r: PolicyResource) =>
    Boolean(
      r.createdAt && Date.now() - r.createdAt.getTime() <= minutes * 60_000,
    );

export const POLICIES = {
  // ---- tickets ----------------------------------------------------------------
  'ticket:create': { minRole: 'MEMBER', description: 'create a ticket' },
  'ticket:read': {
    minRole: 'AGENT',
    ownRecord: isOwner,
    description: 'read a ticket',
  },
  'ticket:update': {
    minRole: 'AGENT',
    ownRecord: (s, r) => isOwner(s, r) && r.status === 'OPEN',
    description: 'edit ticket title, description or priority',
  },
  'ticket:changeStatus': {
    minRole: 'AGENT',
    // The author may only perform the RESOLVED -> CLOSED confirmation.
    ownRecord: (s, r) => isOwner(s, r) && r.status === 'RESOLVED',
    description: 'change ticket status',
  },
  'ticket:selfAssign': {
    minRole: 'AGENT',
    description: 'assign a ticket to yourself',
  },
  'ticket:assignOther': {
    minRole: 'ORG_ADMIN',
    description: 'assign a ticket to another agent',
  },
  'ticket:reopen': { minRole: 'AGENT', description: 'reopen a closed ticket' },
  'ticket:delete': { minRole: 'ORG_ADMIN', description: 'delete a ticket' },
  'ticket:viewInternalNotes': {
    minRole: 'AGENT',
    description: 'read internal notes',
  },

  // ---- comments and attachments -------------------------------------------------
  'comment:create': {
    minRole: 'MEMBER',
    description: 'comment on a visible ticket',
  },
  'comment:createInternal': {
    minRole: 'AGENT',
    description: 'write an internal note',
  },
  'comment:update': {
    minRole: 'ORG_ADMIN',
    ownRecord: (s, r) =>
      isOwner(s, r) && (s.orgRole !== 'MEMBER' || withinMinutes(15)(s, r)),
    description: 'edit a comment',
  },
  'comment:delete': {
    minRole: 'ORG_ADMIN',
    ownRecord: isOwner,
    description: 'delete a comment',
  },
  'attachment:create': {
    minRole: 'MEMBER',
    description: 'upload an attachment',
  },
  'attachment:read': {
    minRole: 'AGENT',
    ownRecord: isOwner,
    description: 'download an attachment',
  },
  'attachment:delete': {
    minRole: 'AGENT',
    ownRecord: isOwner,
    description: 'delete an attachment',
  },

  // ---- organization, members, categories -----------------------------------------
  'organization:read': {
    minRole: 'MEMBER',
    description: 'view the organization',
  },
  'organization:update': {
    minRole: 'ORG_ADMIN',
    description: 'edit the organization',
  },
  'organization:delete': {
    minRole: 'ORG_ADMIN',
    precondition: (s, r) =>
      Boolean(r.ownerId && r.ownerId === s.userId) || s.isGlobalAdmin,
    description: 'delete the organization',
  },
  'member:read': { minRole: 'MEMBER', description: 'list members' },
  'member:invite': { minRole: 'ORG_ADMIN', description: 'invite a member' },
  'member:changeRole': {
    minRole: 'ORG_ADMIN',
    description: 'change a member role',
  },
  'member:remove': { minRole: 'ORG_ADMIN', description: 'remove a member' },
  'member:leave': {
    minRole: 'MEMBER',
    precondition: (_s, r) => r.isLastAdmin !== true,
    description: 'leave the organization',
  },
  'category:read': { minRole: 'MEMBER', description: 'list categories' },
  'category:write': {
    minRole: 'ORG_ADMIN',
    description: 'create, edit or delete a category',
  },
  'apiKey:manage': {
    minRole: 'ORG_ADMIN',
    description: 'create, rotate or revoke API keys',
  },
  'stats:read': {
    minRole: 'AGENT',
    description: 'read organization statistics',
  },

  // ---- platform -------------------------------------------------------------------
  'user:listAll': {
    globalAdminOnly: true,
    description: 'list every user on the platform',
  },
  'user:updateOther': {
    globalAdminOnly: true,
    description: 'edit another user profile',
  },
  'user:setStatus': {
    globalAdminOnly: true,
    description: 'suspend or reactivate an account',
  },
  'user:setGlobalRole': {
    globalAdminOnly: true,
    description: 'change a global role',
  },
  'user:deleteOther': {
    globalAdminOnly: true,
    description: 'delete another account',
  },
  'audit:read': { globalAdminOnly: true, description: 'read the audit log' },
} as const satisfies Record<string, PolicyRule>;

export type PolicyId = keyof typeof POLICIES;
export const ALL_POLICIES = Object.keys(POLICIES) as PolicyId[];

export interface PolicyDecision {
  allowed: boolean;
  policy: PolicyId;
  reason: string;
}

/**
 * The single function that decides every authorisation question in the
 * system. Pure: no database, no request object.
 */
export function evaluatePolicy(
  policy: PolicyId,
  subject: PolicySubject,
  resource: PolicyResource = {},
): PolicyDecision {
  const rule = POLICIES[policy] as PolicyRule;
  const deny = (reason: string): PolicyDecision => ({
    allowed: false,
    policy,
    reason,
  });
  const allow = (): PolicyDecision => ({
    allowed: true,
    policy,
    reason: 'granted',
  });

  if (rule.precondition && !rule.precondition(subject, resource)) {
    return deny('precondition-failed');
  }

  if (rule.globalAdminOnly) {
    return subject.isGlobalAdmin ? allow() : deny('global-admin-required');
  }

  if (subject.isGlobalAdmin) return allow();

  if (rule.minRole) {
    if (!subject.orgRole) return deny('not-a-member');
    if (ORG_ROLE_RANK[subject.orgRole] >= ORG_ROLE_RANK[rule.minRole])
      return allow();
    if (rule.ownRecord?.(subject, resource)) return allow();
    return deny('insufficient-org-role');
  }

  return allow();
}

/**
 * Effective permission list returned by GET /auth/me. The frontend uses it to
 * hide controls; it is NEVER trusted for the actual decision, which is taken
 * again on the server for every single request.
 */
export function effectivePermissions(subject: PolicySubject): PolicyId[] {
  return ALL_POLICIES.filter(
    (policy) => evaluatePolicy(policy, subject, {}).allowed,
  );
}
