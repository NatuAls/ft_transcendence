import type { OrgRole } from '../../generated/prisma/client.ts';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  SessionUser,
} from 'contracts';
import { prisma } from '../../database/prisma.ts';
import { DomainEvents, events } from '../../database/events.ts';
import {
  sendEmailVerification,
  sendPasswordReset,
} from '../mail/mail.service.ts';
import { Errors } from '../../common/errors/domain-error.ts';
import { effectivePermissions } from '../../rbac/policies.ts';
import { createLogger } from '../../common/logger.ts';
import {
  claimReservations,
  pendingRolesFor,
} from '../roles/role-grants.service.ts';
import {
  fakeVerifyPassword,
  hashPassword,
  verifyPassword,
} from './password.ts';
import {
  createOneTimeToken,
  hashOneTimeToken,
  issueTokens,
  revokeAccessToken,
  revokeAllForUser,
  revokeByRefreshToken,
  rotateTokens,
  type IssuedTokens,
} from './token.ts';

const logger = createLogger('auth');

const ORG_RANK: Record<OrgRole, number> = { MEMBER: 1, AGENT: 2, ORG_ADMIN: 3 };

/** Highest organization role a user holds anywhere, used only for UI hints. */
function highestRole(roles: OrgRole[]): OrgRole | undefined {
  return roles.reduce<OrgRole | undefined>(
    (best, role) => (!best || ORG_RANK[role] > ORG_RANK[best] ? role : best),
    undefined,
  );
}

const MAX_FAILED_LOGINS = 5;
const LOCK_STEPS_MS = [60_000, 120_000, 300_000, 900_000]; // 1m, 2m, 5m, 15m

export interface RequestContext {
  userAgent?: string;
  ip?: string;
  origin: string;
}

// ------------------------------------------------------------------ register --
export async function register(
  input: RegisterInput,
  ctx: RequestContext,
): Promise<{ user: SessionUser } & IssuedTokens> {
  const [emailTaken, usernameTaken] = await Promise.all([
    prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { username: input.username },
      select: { id: true },
    }),
  ]);
  if (emailTaken) throw Errors.emailTaken();
  if (usernameTaken) throw Errors.usernameTaken();

  const passwordHash = await hashPassword(input.password);
  const { token, hash } = createOneTimeToken();

  const user = await events.runInTransaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        username: input.username,
        passwordHash,
        locale: input.locale,
        profile: {
          create: {
            firstName: input.firstName,
            lastName: input.lastName,
            displayName: `${input.firstName} ${input.lastName}`.trim(),
          },
        },
        preferences: { create: {} },
        verificationTokens: {
          create: {
            purpose: 'EMAIL_VERIFY',
            tokenHash: hash,
            expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
          },
        },
      },
      select: { id: true, username: true, email: true, globalRole: true },
    });
    events.emit(DomainEvents.accountCreated, { userId: created.id });
    return created;
  });

  await sendEmailVerification(
    user.email,
    input.firstName,
    `${ctx.origin}/#verify-email?token=${token}`,
  );

  const issued = await issueTokens(user, ctx);
  return { user: await sessionUser(user.id), ...issued };
}

// ------------------------------------------------------------------------- login --
export async function login(
  input: LoginInput,
  ctx: RequestContext,
): Promise<{ user: SessionUser } & IssuedTokens> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      username: true,
      email: true,
      globalRole: true,
      passwordHash: true,
      isActive: true,
      deletedAt: true,
      failedLoginCount: true,
      lockedUntil: true,
    },
  });

  // Constant-ish time: burn the same CPU whether or not the account exists.
  if (!user || user.deletedAt) {
    await fakeVerifyPassword();
    throw Errors.invalidCredentials();
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw Errors.accountLocked(user.lockedUntil);
  }
  if (!user.isActive) throw Errors.accountDisabled();

  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) {
    await registerFailedLogin(user.id, user.failedLoginCount);
    throw Errors.invalidCredentials();
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const issued = await issueTokens(user, ctx);
  return { user: await sessionUser(user.id), ...issued };
}

async function registerFailedLogin(
  userId: string,
  current: number,
): Promise<void> {
  const next = current + 1;
  const overflow = next - MAX_FAILED_LOGINS;
  const lockedUntil =
    overflow >= 0
      ? new Date(
          Date.now() +
            (LOCK_STEPS_MS[Math.min(overflow, LOCK_STEPS_MS.length - 1)] ??
              900_000),
        )
      : null;
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: next, lockedUntil },
  });
  if (lockedUntil)
    logger.warn(`account ${userId} locked until ${lockedUntil.toISOString()}`);
}

// ----------------------------------------------------------------------- refresh --
export async function refresh(
  refreshToken: string,
  ctx: RequestContext,
): Promise<{ user: SessionUser } & IssuedTokens> {
  const rotated = await rotateTokens(refreshToken, ctx);
  return { user: await sessionUser(rotated.userId), ...rotated };
}

/**
 * Ends the current session: the refresh row in Postgres and - just as
 * importantly - the access token the caller is holding right now.
 *
 * Revoking only the refresh token left the JWT usable until it expired on its
 * own, so "log out" did not log anybody out for up to a full access-token
 * lifetime. The `revoked:<jti>` list in Redis exists precisely for this.
 */
export async function logout(
  refreshToken: string | undefined,
  accessToken?: { jti: string; exp?: number },
): Promise<void> {
  if (refreshToken) await revokeByRefreshToken(refreshToken);
  if (accessToken?.jti)
    await revokeAccessToken(accessToken.jti, accessToken.exp);
}

export async function logoutAll(userId: string): Promise<void> {
  await revokeAllForUser(userId);
}

// ----------------------------------------------------------------------- verification --
export async function verifyEmail(token: string): Promise<void> {
  const row = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashOneTimeToken(token) },
    select: {
      id: true,
      userId: true,
      purpose: true,
      expiresAt: true,
      usedAt: true,
    },
  });
  if (
    !row ||
    row.purpose !== 'EMAIL_VERIFY' ||
    row.usedAt ||
    row.expiresAt.getTime() < Date.now()
  ) {
    throw Errors.tokenInvalid();
  }
  await prisma.$transaction([
    prisma.verificationToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: row.userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);
  // The address is now proven to belong to this account: whatever role an
  // administrator reserved for it reaches the account here, and only here.
  await claimReservations(row.userId);
}

/**
 * Issues a fresh email-verification link.
 *
 * Registration mints a token that lives 24 hours. Without this endpoint a user
 * whose token expired - or whose email never arrived - had no way back: the
 * account stays permanently unverified even though `/auth/me` keeps reporting
 * `emailVerified: false`.
 *
 * Any token still pending for this purpose is burnt first, so only the newest
 * link works and an old message forwarded to someone else is dead.
 */
export async function resendVerification(
  userId: string,
  ctx: RequestContext,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      deletedAt: true,
      profile: { select: { firstName: true } },
    },
  });
  if (!user || user.deletedAt) throw Errors.tokenInvalid();
  // Already verified: nothing to send, and saying so is not a leak because the
  // caller is authenticated as this very user.
  if (user.emailVerifiedAt) return;

  const { token, hash } = createOneTimeToken();
  await prisma.$transaction([
    prisma.verificationToken.updateMany({
      where: { userId: user.id, purpose: 'EMAIL_VERIFY', usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.verificationToken.create({
      data: {
        userId: user.id,
        purpose: 'EMAIL_VERIFY',
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    }),
  ]);
  await sendEmailVerification(
    user.email,
    user.profile?.firstName ?? 'there',
    `${ctx.origin}/#verify-email?token=${token}`,
  );
}

/** Always resolves the same way, so nobody can probe which emails exist. */
export async function forgotPassword(
  email: string,
  ctx: RequestContext,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      deletedAt: true,
      profile: { select: { firstName: true } },
    },
  });
  if (!user || user.deletedAt) return;

  const { token, hash } = createOneTimeToken();
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      purpose: 'PASSWORD_RESET',
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  await sendPasswordReset(
    user.email,
    user.profile?.firstName ?? 'there',
    // Con `#`, como el de verificación: el front es un router de fragmento y
    // `/reset-password` a secas no existe en ninguna tabla de rutas. Sin esto,
    // Nginx servía index.html, el router veía el fragmento vacío y el testigo
    // se perdía por el camino: la recuperación no se podía completar.
    `${ctx.origin}/#reset-password?token=${token}`,
  );
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const row = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashOneTimeToken(input.token) },
    select: {
      id: true,
      userId: true,
      purpose: true,
      expiresAt: true,
      usedAt: true,
    },
  });
  if (
    !row ||
    row.purpose !== 'PASSWORD_RESET' ||
    row.usedAt ||
    row.expiresAt.getTime() < Date.now()
  ) {
    throw Errors.tokenInvalid();
  }
  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction([
    prisma.verificationToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    }),
  ]);
  // A password change must invalidate every existing session.
  await revokeAllForUser(row.userId);
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw Errors.wrongPassword();
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.password) },
  });
  await revokeAllForUser(userId);
}

// -------------------------------------------------------------------------- session me --
export async function sessionUser(userId: string): Promise<SessionUser> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      globalRole: true,
      locale: true,
      timezone: true,
      emailVerifiedAt: true,
      createdAt: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          jobTitle: true,
          isOnline: true,
          lastSeenAt: true,
        },
      },
      memberships: {
        select: {
          role: true,
          organizationId: true,
          organization: { select: { name: true, slug: true } },
        },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.profile?.firstName ?? '',
    lastName: user.profile?.lastName ?? '',
    displayName: user.profile?.displayName ?? user.username,
    avatarUrl: user.profile?.avatarUrl ?? null,
    bio: user.profile?.bio ?? null,
    jobTitle: user.profile?.jobTitle ?? null,
    isOnline: user.profile?.isOnline ?? false,
    lastSeenAt: user.profile?.lastSeenAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    globalRole: user.globalRole,
    locale: user.locale,
    timezone: user.timezone,
    emailVerified: Boolean(user.emailVerifiedAt),
    memberships: user.memberships.map((m) => ({
      organizationId: m.organizationId,
      organizationName: m.organization.name,
      organizationSlug: m.organization.slug,
      role: m.role,
    })),
    // Highest role across organizations, used only to grey out UI controls.
    permissions: effectivePermissions({
      userId: user.id,
      isGlobalAdmin: user.globalRole === 'GLOBAL_ADMIN',
      orgRole: highestRole(user.memberships.map((m) => m.role)),
    }),
    pendingRoles: await pendingRolesFor(
      user.email,
      Boolean(user.emailVerifiedAt),
    ),
  };
}

/**
 * The devices with a live refresh token. Every refresh rotates the token into
 * a new row of the same family, so the live row says when the device was last
 * used and the oldest row of its family says when it signed in. `current`
 * marks the device making the call: the refresh cookie travels to every
 * `/auth/*` route. It is matched by FAMILY, not by row: the web app renews its
 * session on navigation, so this request may carry the token that a parallel
 * refresh has just rotated - still the same device.
 */
export async function listSessions(userId: string, refreshToken?: string) {
  const rows = await prisma.userSession.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      familyId: true,
      userAgent: true,
      ip: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  const firsts = rows.length
    ? await prisma.userSession.groupBy({
        by: ['familyId'],
        where: { familyId: { in: rows.map((row) => row.familyId) } },
        _min: { createdAt: true },
      })
    : [];
  const signedInAt = new Map(
    firsts.map((row) => [row.familyId, row._min.createdAt]),
  );
  const presented = refreshToken
    ? await prisma.userSession.findUnique({
        where: { refreshTokenHash: hashOneTimeToken(refreshToken) },
        select: { familyId: true, userId: true },
      })
    : null;
  const currentFamily =
    presented?.userId === userId ? presented.familyId : null;
  return rows.map((row) => ({
    id: row.id,
    userAgent: row.userAgent,
    ip: row.ip,
    createdAt: signedInAt.get(row.familyId) ?? row.createdAt,
    lastUsedAt: row.createdAt,
    expiresAt: row.expiresAt,
    current: row.familyId === currentFamily,
  }));
}

export async function revokeSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  const { count } = await prisma.userSession.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  // Somebody else's session and a session that does not exist answer the
  // same, so the endpoint cannot be used to probe identifiers.
  if (count === 0) throw Errors.resourceNotFound('session');
}
