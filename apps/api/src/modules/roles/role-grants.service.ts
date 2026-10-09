// =============================================================================
//  Role assignment by e-mail address - platform and organization level.
//
//  An administrator gives a role to an ADDRESS. What happens next depends on
//  who owns that address today:
//
//    · a verified account      -> the role is applied now        (APPLIED)
//    · it already has the role -> nothing to do                  (UNCHANGED)
//    · no account, or one whose
//      address is not verified -> the role is reserved           (RESERVED)
//
//  A reservation reaches the account in `claimReservations`, which runs when
//  the address is verified. Verification is the condition, not registration:
//  anybody can register any address, but only its owner can confirm it, so a
//  reservation for jefa@empresa.com never lands on whoever typed it first.
//
//  The person always creates the account on their own. The administrator only
//  establishes the link; that is the whole point of reserving by address.
//
//  Two levels, two screens, two tables:
//    · platform     -> GLOBAL_ADMIN, by a GLOBAL_ADMIN
//    · organization -> MEMBER / AGENT / ORG_ADMIN, by that organization's
//                      ORG_ADMIN (or a GLOBAL_ADMIN)
// =============================================================================
import type {
  AssignOrganizationRoleInput,
  AssignPlatformRoleInput,
  OrganizationRoleAssignment,
  OrganizationRoleReservation,
  PendingRole,
  PlatformRoleAssignment,
  PlatformRoleReservation,
  ReservationWaitingFor,
  RoleAssignmentAccount,
} from 'contracts';
import type { GlobalRole, OrgRole } from '../../generated/prisma/client.ts';
import { prisma } from '../../database/prisma.ts';
import { DomainEvents, events } from '../../database/events.ts';
import { Errors } from '../../common/errors/domain-error.ts';
import { createLogger } from '../../common/logger.ts';
import { assertPolicy, invalidateMembership } from '../../rbac/rbac.ts';
import type { RequestActor, RequestMembership } from '../../common/types.ts';
import { record } from '../audit/audit.service.ts';
import { sendRoleReserved } from '../mail/mail.service.ts';
import * as orgs from '../organizations/organizations.service.ts';

const logger = createLogger('role-grants');

export const ROLE_LABELS: Record<GlobalRole | OrgRole, string> = {
  GLOBAL_ADMIN: 'Platform administrator',
  USER: 'Standard user',
  ORG_ADMIN: 'Organization administrator',
  AGENT: 'Support agent',
  MEMBER: 'Member',
};

const GRANTOR_SELECT = {
  id: true,
  username: true,
  profile: { select: { displayName: true } },
} as const;

type GrantorRow = {
  id: string;
  username: string;
  profile: { displayName: string } | null;
} | null;

function grantor(row: GrantorRow) {
  return row
    ? {
        id: row.id,
        username: row.username,
        displayName: row.profile?.displayName || row.username,
      }
    : null;
}

/** The account that owns an address today, if any. */
async function accountFor(email: string) {
  return prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: {
      id: true,
      username: true,
      email: true,
      globalRole: true,
      emailVerifiedAt: true,
      profile: { select: { displayName: true } },
    },
  });
}

type Account = NonNullable<Awaited<ReturnType<typeof accountFor>>>;

function summary(account: Account): RoleAssignmentAccount {
  return {
    id: account.id,
    username: account.username,
    displayName: account.profile?.displayName || account.username,
  };
}

/**
 * For each address: does it already have an (unverified) account, or does it
 * still need one? One query for the whole list instead of one per row.
 */
async function waitingFor(
  emails: string[],
): Promise<(email: string) => ReservationWaitingFor> {
  if (!emails.length) return () => 'ACCOUNT';
  const accounts = await prisma.user.findMany({
    where: { email: { in: emails }, deletedAt: null },
    select: { email: true },
  });
  const known = new Set(accounts.map((row) => row.email.toLowerCase()));
  return (email) =>
    known.has(email.toLowerCase()) ? 'VERIFICATION' : 'ACCOUNT';
}

function policySubject(actor: RequestActor, membership?: RequestMembership) {
  return {
    userId: actor.id,
    isGlobalAdmin: actor.globalRole === 'GLOBAL_ADMIN',
    orgRole: membership?.role,
  };
}

/**
 * Where the message sends the person: to sign-up with the address already
 * filled in, or to sign-in when the account exists and only needs confirming.
 */
function nextStepUrl(origin: string, email: string, hasAccount: boolean) {
  return hasAccount
    ? `${origin}/#login`
    : `${origin}/#register?email=${encodeURIComponent(email)}`;
}

// ------------------------------------------------------------------ platform --
const PLATFORM_SELECT = {
  id: true,
  email: true,
  globalRole: true,
  createdAt: true,
  updatedAt: true,
  grantedBy: { select: GRANTOR_SELECT },
} as const;

export async function listPlatformReservations(): Promise<
  PlatformRoleReservation[]
> {
  const rows = await prisma.platformRoleGrant.findMany({
    orderBy: { createdAt: 'desc' },
    select: PLATFORM_SELECT,
  });
  const reason = await waitingFor(rows.map((row) => row.email));
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    globalRole: row.globalRole,
    waitingFor: reason(row.email),
    grantedBy: grantor(row.grantedBy),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function assignPlatformRole(
  actor: RequestActor,
  input: AssignPlatformRoleInput,
  origin: string,
): Promise<PlatformRoleAssignment & { previousRole: GlobalRole | null }> {
  const account = await accountFor(input.email);
  // The same rule as PATCH /users/:id/role: nobody changes their own platform
  // role, not even to the role they already have.
  if (account?.id === actor.id) {
    throw Errors.forbiddenAction('change your own global role');
  }

  if (account && account.globalRole === input.globalRole) {
    // A reservation left for an address that already holds the role would
    // only ever confuse the list: drop it.
    await prisma.platformRoleGrant.deleteMany({
      where: { email: input.email },
    });
    return {
      outcome: 'UNCHANGED',
      email: input.email,
      globalRole: input.globalRole,
      user: summary(account),
      reservation: null,
      previousRole: account.globalRole,
    };
  }

  if (account?.emailVerifiedAt) {
    await prisma.$transaction([
      prisma.platformRoleGrant.deleteMany({ where: { email: input.email } }),
      prisma.user.update({
        where: { id: account.id },
        data: { globalRole: input.globalRole },
      }),
    ]);
    events.emit(DomainEvents.accountUpdated, { userId: account.id });
    return {
      outcome: 'APPLIED',
      email: input.email,
      globalRole: input.globalRole,
      user: summary(account),
      reservation: null,
      previousRole: account.globalRole,
    };
  }

  const row = await prisma.platformRoleGrant.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      globalRole: input.globalRole,
      grantedById: actor.id,
    },
    update: { globalRole: input.globalRole, grantedById: actor.id },
    select: PLATFORM_SELECT,
  });

  await sendRoleReserved(input.email, {
    roleLabel: ROLE_LABELS[input.globalRole],
    scopeLabel: 'the whole platform',
    grantor: actor.username,
    hasAccount: Boolean(account),
    url: nextStepUrl(origin, input.email, Boolean(account)),
  });
  // The address may have been verified between the lookup and the upsert; in
  // that case nobody would ever claim the row, so claim it now.
  if (account) await claimIfVerifiedMeanwhile(account.id);

  return {
    outcome: 'RESERVED',
    email: input.email,
    globalRole: input.globalRole,
    user: null,
    reservation: {
      id: row.id,
      email: row.email,
      globalRole: row.globalRole,
      waitingFor: account ? 'VERIFICATION' : 'ACCOUNT',
      grantedBy: grantor(row.grantedBy),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
    previousRole: null,
  };
}

export async function cancelPlatformReservation(
  id: string,
): Promise<{ id: string; email: string; globalRole: GlobalRole }> {
  const row = await prisma.platformRoleGrant.findUnique({
    where: { id },
    select: { id: true, email: true, globalRole: true },
  });
  if (!row) throw Errors.resourceNotFound('reservation');
  await prisma.platformRoleGrant.delete({ where: { id } });
  return row;
}

// -------------------------------------------------------------- organization --
const ORGANIZATION_SELECT = {
  id: true,
  organizationId: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  grantedBy: { select: GRANTOR_SELECT },
} as const;

/**
 * Reservations are e-mail addresses of people who are not members yet, so
 * only those who can add members see them: ORG_ADMIN, or a GLOBAL_ADMIN.
 */
export async function listOrganizationReservations(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  organizationId: string,
): Promise<OrganizationRoleReservation[]> {
  await orgs.findOne(actor, membership, organizationId);
  assertPolicy('member:invite', policySubject(actor, membership));
  const rows = await prisma.organizationRoleGrant.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    select: ORGANIZATION_SELECT,
  });
  const reason = await waitingFor(rows.map((row) => row.email));
  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    email: row.email,
    role: row.role,
    waitingFor: reason(row.email),
    grantedBy: grantor(row.grantedBy),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

/**
 * Sets the role of an address inside one organization.
 *
 * Changing the role of somebody who is ALREADY a member does not wait for
 * anything - that is what `PATCH /members/:userId` does too, and it goes
 * through the same function, last-administrator rule included. Verification
 * only gates the moment a new person ENTERS the organization.
 */
export async function assignOrganizationRole(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  organizationId: string,
  input: AssignOrganizationRoleInput,
  origin: string,
): Promise<OrganizationRoleAssignment & { previousRole: OrgRole | null }> {
  const org = await orgs.findOne(actor, membership, organizationId);
  assertPolicy('member:invite', policySubject(actor, membership));

  const account = await accountFor(input.email);
  const current = account
    ? await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: account.id },
        },
        select: { role: true },
      })
    : null;

  if (account && current) {
    await prisma.organizationRoleGrant.deleteMany({
      where: { organizationId, email: input.email },
    });
    if (current.role !== input.role) {
      await orgs.changeRole(
        actor,
        membership,
        organizationId,
        account.id,
        input.role,
      );
    }
    return {
      outcome: current.role === input.role ? 'UNCHANGED' : 'APPLIED',
      email: input.email,
      role: input.role,
      user: summary(account),
      reservation: null,
      previousRole: current.role,
    };
  }

  if (account?.emailVerifiedAt) {
    await prisma.organizationRoleGrant.deleteMany({
      where: { organizationId, email: input.email },
    });
    await orgs.addMembership(actor, org, account, input.role, origin);
    return {
      outcome: 'APPLIED',
      email: input.email,
      role: input.role,
      user: summary(account),
      reservation: null,
      previousRole: null,
    };
  }

  const row = await prisma.organizationRoleGrant.upsert({
    where: {
      organizationId_email: { organizationId, email: input.email },
    },
    create: {
      organizationId,
      email: input.email,
      role: input.role,
      grantedById: actor.id,
    },
    update: { role: input.role, grantedById: actor.id },
    select: ORGANIZATION_SELECT,
  });

  await sendRoleReserved(input.email, {
    roleLabel: ROLE_LABELS[input.role],
    scopeLabel: org.name,
    grantor: actor.username,
    hasAccount: Boolean(account),
    url: nextStepUrl(origin, input.email, Boolean(account)),
  });
  events.emit(DomainEvents.roleReserved, {
    organizationId,
    email: input.email,
    role: input.role,
    actorId: actor.id,
  });
  if (account) await claimIfVerifiedMeanwhile(account.id);

  return {
    outcome: 'RESERVED',
    email: input.email,
    role: input.role,
    user: null,
    reservation: {
      id: row.id,
      organizationId: row.organizationId,
      email: row.email,
      role: row.role,
      waitingFor: account ? 'VERIFICATION' : 'ACCOUNT',
      grantedBy: grantor(row.grantedBy),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
    previousRole: null,
  };
}

export async function cancelOrganizationReservation(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  organizationId: string,
  id: string,
): Promise<{ id: string; email: string; role: OrgRole }> {
  await orgs.findOne(actor, membership, organizationId);
  assertPolicy('member:invite', policySubject(actor, membership));
  // Scoped by organization on purpose: an id from another organization is a
  // 404 here, exactly like any other resource of a tenant you cannot see.
  const row = await prisma.organizationRoleGrant.findFirst({
    where: { id, organizationId },
    select: { id: true, email: true, role: true },
  });
  if (!row) throw Errors.resourceNotFound('reservation');
  await prisma.organizationRoleGrant.delete({ where: { id } });
  events.emit(DomainEvents.roleReservationCancelled, {
    organizationId,
    email: row.email,
    actorId: actor.id,
  });
  return row;
}

// --------------------------------------------------------------------- claim --
export interface ClaimedRoles {
  globalRole: GlobalRole | null;
  memberships: Array<{ organizationId: string; role: OrgRole }>;
}

/**
 * Hands every reservation of the account's address over to the account.
 * Called when the address is verified. Idempotent: a second call finds no
 * rows. All of it in one transaction, so a failure halfway leaves the
 * reservations in place to be claimed again rather than half-applied.
 *
 * When the account already belongs to an organization the reservation names,
 * the membership is left as it is: somebody acted on the account directly,
 * and that is the more recent decision.
 */
export async function claimReservations(userId: string): Promise<ClaimedRoles> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      globalRole: true,
      emailVerifiedAt: true,
      deletedAt: true,
    },
  });
  const nothing: ClaimedRoles = { globalRole: null, memberships: [] };
  if (!user || user.deletedAt || !user.emailVerifiedAt) return nothing;

  const claimed = await events.runInTransaction(async (tx) => {
    const result: ClaimedRoles & {
      grantors: Map<string, string | null>;
    } = { globalRole: null, memberships: [], grantors: new Map() };

    const platform = await tx.platformRoleGrant.findUnique({
      where: { email: user.email },
      select: { id: true, globalRole: true },
    });
    if (platform) {
      await tx.platformRoleGrant.delete({ where: { id: platform.id } });
      if (user.globalRole !== platform.globalRole) {
        await tx.user.update({
          where: { id: user.id },
          data: { globalRole: platform.globalRole },
        });
        result.globalRole = platform.globalRole;
        events.emit(DomainEvents.accountUpdated, { userId: user.id });
      }
    }

    const grants = await tx.organizationRoleGrant.findMany({
      where: { email: user.email },
      select: {
        id: true,
        role: true,
        grantedById: true,
        organization: {
          select: { id: true, name: true, slug: true, deletedAt: true },
        },
      },
    });
    for (const grant of grants) {
      await tx.organizationRoleGrant.delete({ where: { id: grant.id } });
      if (grant.organization.deletedAt) continue;
      const existing = await tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: grant.organization.id,
            userId: user.id,
          },
        },
        select: { id: true },
      });
      if (existing) continue;

      const member = await tx.organizationMember.create({
        data: {
          organizationId: grant.organization.id,
          userId: user.id,
          role: grant.role,
          invitedById: grant.grantedById,
        },
        select: orgs.MEMBER_ADDED_SELECT,
      });
      events.emit(DomainEvents.memberAdded, {
        member,
        organization: {
          id: grant.organization.id,
          name: grant.organization.name,
          slug: grant.organization.slug,
        },
        actorId: grant.grantedById ?? user.id,
      });
      result.memberships.push({
        organizationId: grant.organization.id,
        role: grant.role,
      });
      result.grantors.set(grant.organization.id, grant.grantedById);
    }
    return result;
  });

  for (const { organizationId } of claimed.memberships) {
    await invalidateMembership(user.id, organizationId);
  }

  // The account is the actor: it is the one whose verification completed the
  // link. Who established the link is kept in `after`.
  if (claimed.globalRole) {
    await record({
      actor: { id: user.id },
      action: 'role.reservation.claimed',
      entity: 'User',
      entityId: user.id,
      before: { globalRole: user.globalRole },
      after: { globalRole: claimed.globalRole, via: 'e-mail verification' },
    });
  }
  for (const { organizationId, role } of claimed.memberships) {
    await record({
      actor: { id: user.id },
      action: 'role.reservation.claimed',
      entity: 'OrganizationMember',
      entityId: organizationId,
      after: {
        userId: user.id,
        role,
        grantedById: claimed.grantors.get(organizationId) ?? null,
        via: 'e-mail verification',
      },
    });
  }
  if (claimed.globalRole || claimed.memberships.length) {
    logger.info(
      `account ${user.id} claimed ${claimed.memberships.length} organization role(s)` +
        (claimed.globalRole
          ? ` and the platform role ${claimed.globalRole}`
          : ''),
    );
  }
  return { globalRole: claimed.globalRole, memberships: claimed.memberships };
}

async function claimIfVerifiedMeanwhile(userId: string): Promise<void> {
  const fresh = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  });
  if (fresh?.emailVerifiedAt) await claimReservations(userId);
}

/**
 * What waits for an account, for `/auth/me`. Only an unverified address can
 * have anything waiting: a verified one receives its roles at once.
 */
export async function pendingRolesFor(
  email: string,
  verified: boolean,
): Promise<PendingRole[]> {
  if (verified) return [];
  const [platform, organizations] = await Promise.all([
    prisma.platformRoleGrant.findUnique({
      where: { email },
      select: { globalRole: true },
    }),
    prisma.organizationRoleGrant.findMany({
      where: { email, organization: { deletedAt: null } },
      orderBy: { createdAt: 'asc' },
      select: { role: true, organization: { select: { name: true } } },
    }),
  ]);
  return [
    ...(platform
      ? [
          {
            scope: 'PLATFORM' as const,
            role: platform.globalRole,
            organizationName: null,
          },
        ]
      : []),
    ...organizations.map((grant) => ({
      scope: 'ORGANIZATION' as const,
      role: grant.role,
      organizationName: grant.organization.name,
    })),
  ];
}
