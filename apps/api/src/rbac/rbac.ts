import type { OrgRole } from '../generated/prisma/client.ts';
import { prisma } from '../database/prisma.ts';
import { redis } from '../database/redis.ts';
import type { RequestMembership } from '../common/types.ts';
import { evaluatePolicy, type PolicyId, type PolicyResource } from './policies.ts';
import { Errors } from '../common/errors/domain-error.ts';

const CACHE_TTL = 30;

/**
 * Resolves memberships (cached 30s in Redis, because it runs on every
 * request) and enforces policies.
 */
export async function membershipOf(
  userId: string,
  organizationId: string,
): Promise<RequestMembership | undefined> {
  const cacheKey = `membership:${userId}:${organizationId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached === 'none') return undefined;
    if (cached) return { userId, organizationId, role: cached as OrgRole };
  } catch {
    /* cache miss on redis failure is fine, we fall through to the database */
  }

  const row = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true },
  });

  try {
    await redis.set(cacheKey, row?.role ?? 'none', 'EX', CACHE_TTL);
  } catch {
    /* ignore */
  }

  return row ? { userId, organizationId, role: row.role } : undefined;
}

export async function invalidateMembership(userId: string, organizationId: string): Promise<void> {
  try {
    await redis.del(`membership:${userId}:${organizationId}`);
  } catch {
    /* ignore */
  }
}

/** Throws 403 when denied. Use this in services, not `if` statements sprinkled around. */
export function assertPolicy(
  policy: PolicyId,
  subject: { userId: string; isGlobalAdmin: boolean; orgRole?: OrgRole },
  resource: PolicyResource = {},
): void {
  const decision = evaluatePolicy(policy, subject, resource);
  if (!decision.allowed) {
    throw Errors.forbiddenAction(policy);
  }
}

export function canPolicy(
  policy: PolicyId,
  subject: { userId: string; isGlobalAdmin: boolean; orgRole?: OrgRole },
  resource: PolicyResource = {},
): boolean {
  return evaluatePolicy(policy, subject, resource).allowed;
}

export * from './policies.ts';
