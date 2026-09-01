import { createHash, randomBytes } from 'node:crypto';
import type { GlobalRole } from '../../generated/prisma/client.ts';
import { prisma } from '../../database/prisma.ts';
import {
  revokeJti,
  revokeTokensIssuedBefore,
  tokensRevokedBefore,
} from '../../database/redis.ts';
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

/** Parses the `15m` / `7d` style durations used by the token TTL settings. */
function durationMs(raw: string, fallbackMs: number): number {
  const match = /^(\d+)([smhd])$/.exec(raw);
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = match[2] as 's' | 'm' | 'h' | 'd';
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return amount * factor;
}

function refreshTtlMs(): number {
  return durationMs(
    loadConfiguration().REFRESH_TOKEN_TTL,
    7 * 24 * 3600 * 1000,
  );
}

function accessTtlSeconds(): number {
  return Math.ceil(
    durationMs(loadConfiguration().ACCESS_TOKEN_TTL, 15 * 60_000) / 1000,
  );
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

  // `iat` only has one-second resolution, and requireAuth() has to treat a
  // token minted in the same second as a revocation cutoff as revoked (it
  // cannot tell whether it came before or after). Without this line, logging
  // in during that same second - which is exactly what happens right after a
  // password change or a logout-all - would hand out a token that the very
  // next request rejects. Stamping it one second ahead removes the ambiguity;
  // `jsonwebtoken` derives `exp` from the `iat` we pass, so the lifetime is
  // unchanged.
  const cutoff = await tokensRevokedBefore(user.id);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const iat = cutoff && nowSeconds <= cutoff ? cutoff + 1 : nowSeconds;

  const accessToken = signAccessToken(
    {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.globalRole,
      jti,
      iat,
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

/**
 * Ends every session of a user: the refresh chain in Postgres AND the access
 * tokens already handed out.
 *
 * Revoking only the refresh rows used to leave the JWTs already in browsers
 * valid for up to a full access-token lifetime, so "log out everywhere" and
 * "change my password because it may be compromised" did not actually cut off
 * a device that was already holding a token.
 */
export async function revokeAllForUser(userId: string): Promise<void> {
  await prisma.userSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await revokeAllAccessTokens(userId);
}

/**
 * Invalidates every access token issued to this user up to now. The cutoff
 * only needs to outlive the tokens themselves, hence the access TTL plus a
 * minute of slack for clock skew between the API and Redis.
 */
export async function revokeAllAccessTokens(userId: string): Promise<void> {
  await revokeTokensIssuedBefore(userId, accessTtlSeconds() + 60);
}

/** Adds the current access token's jti to the revocation list until it expires. */
export async function revokeAccessToken(
  jti: string,
  expUnixSeconds?: number,
): Promise<void> {
  const ttl = expUnixSeconds
    ? Math.max(1, expUnixSeconds - Math.floor(Date.now() / 1000))
    : accessTtlSeconds();
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
