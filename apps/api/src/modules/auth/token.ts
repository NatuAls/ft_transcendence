import { createHash, randomBytes } from 'node:crypto';
import type { GlobalRole } from '../../generated/prisma/client.ts';
import { prisma } from '../../database/prisma.ts';
import { revokeJti } from '../../database/redis.ts';
import { loadConfiguration } from '../../config/env.ts';
import { uuidv7 } from '../../common/utils/uuid.ts';
import { signAccessToken } from '../../common/jwt.ts';
import { Errors } from '../../common/errors/domain-error.ts';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function refreshTtlMs(): number {
  const raw = loadConfiguration().REFRESH_TOKEN_TTL;
  const match = /^(\d+)([smhd])$/.exec(raw);
  if (!match) return 7 * 24 * 3600 * 1000;
  const amount = Number(match[1]);
  const unit = match[2] as 's' | 'm' | 'h' | 'd';
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return amount * factor;
}

/**
 * Access + refresh token lifecycle with rotation and reuse detection.
 *
 * Every refresh belongs to a "family" (one login = one family). Using a
 * refresh token rotates it: the old one is marked replaced. If a token that
 * has already been replaced comes back, we treat it as theft and revoke the
 * ENTIRE family, logging that device chain out everywhere. That is the
 * standard OAuth 2.1 mitigation and it is what makes a stolen refresh token
 * useful only once.
 */
export async function issueTokens(
  user: { id: string; username: string; email: string; globalRole: GlobalRole },
  context: { userAgent?: string; ip?: string; familyId?: string },
): Promise<IssuedTokens> {
  const config = loadConfiguration();
  const jti = uuidv7();
  const accessToken = signAccessToken(
    {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.globalRole,
      jti,
    },
    config.ACCESS_TOKEN_TTL,
  );

  const refreshToken = randomBytes(48).toString('base64url');
  const refreshExpiresAt = new Date(Date.now() + refreshTtlMs());

  await prisma.userSession.create({
    data: {
      userId: user.id,
      familyId: context.familyId ?? uuidv7(),
      refreshTokenHash: sha256(refreshToken),
      userAgent: context.userAgent?.slice(0, 400) ?? null,
      ip: context.ip?.slice(0, 64) ?? null,
      expiresAt: refreshExpiresAt,
    },
  });

  return { accessToken, refreshToken, refreshExpiresAt };
}

/** Rotates a refresh token. Detects and punishes replay. */
export async function rotateTokens(
  refreshToken: string,
  context: { userAgent?: string; ip?: string },
): Promise<IssuedTokens & { userId: string }> {
  const hash = sha256(refreshToken);
  const session = await prisma.userSession.findUnique({
    where: { refreshTokenHash: hash },
    select: {
      id: true,
      userId: true,
      familyId: true,
      expiresAt: true,
      revokedAt: true,
      replacedById: true,
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          globalRole: true,
          isActive: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!session) throw Errors.tokenInvalid();

  // Replay of an already-rotated or revoked token => assume compromise.
  if (session.replacedById || session.revokedAt) {
    await revokeFamily(session.familyId);
    throw Errors.refreshReused();
  }
  if (session.expiresAt.getTime() < Date.now()) throw Errors.tokenInvalid();
  if (!session.user.isActive || session.user.deletedAt)
    throw Errors.accountDisabled();

  const issued = await issueTokens(session.user, {
    ...context,
    familyId: session.familyId,
  });

  const newSession = await prisma.userSession.findUnique({
    where: { refreshTokenHash: sha256(issued.refreshToken) },
    select: { id: true },
  });
  await prisma.userSession.update({
    where: { id: session.id },
    data: { replacedById: newSession?.id, revokedAt: new Date() },
  });

  return { ...issued, userId: session.userId };
}

export async function revokeByRefreshToken(
  refreshToken: string,
): Promise<void> {
  await prisma.userSession.updateMany({
    where: { refreshTokenHash: sha256(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeFamily(familyId: string): Promise<void> {
  await prisma.userSession.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await prisma.userSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Adds the current access token's jti to the revocation list until it expires. */
export async function revokeAccessToken(
  jti: string,
  expUnixSeconds: number,
): Promise<void> {
  const ttl = Math.max(1, expUnixSeconds - Math.floor(Date.now() / 1000));
  await revokeJti(jti, ttl);
}

/** One-time tokens for email verification, password reset and GDPR confirmations. */
export function createOneTimeToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: sha256(token) };
}

export function hashOneTimeToken(token: string): string {
  return sha256(token);
}
