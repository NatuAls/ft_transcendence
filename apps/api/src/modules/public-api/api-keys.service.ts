import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import type { CreateApiKeyInput } from 'contracts';
import { prisma } from '../../database/prisma.ts';
import { assertPolicy } from '../../rbac/rbac.ts';
import { Errors } from '../../common/errors/domain-error.ts';
import type { RequestActor, RequestMembership } from '../../common/types.ts';

function subject(actor: RequestActor, membership?: RequestMembership) {
  return {
    userId: actor.id,
    isGlobalAdmin: actor.globalRole === 'GLOBAL_ADMIN',
    orgRole: membership?.role,
  };
}

export function list(organizationId: string) {
  return prisma.apiKey.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      rateLimitPerMinute: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
      createdBy: { select: { username: true } },
    },
  });
}

/**
 * The plaintext secret is returned EXACTLY ONCE, here. Afterwards only the
 * Argon2id hash and the 8-character prefix exist, so nobody - including us -
 * can recover it.
 */
export async function create(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  organizationId: string,
  input: CreateApiKeyInput,
) {
  assertPolicy('apiKey:manage', subject(actor, membership));

  const prefix = randomBytes(4).toString('hex');
  const secret = randomBytes(32).toString('base64url');
  const keyHash = await argon2.hash(secret, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });

  const key = await prisma.apiKey.create({
    data: {
      organizationId,
      createdById: actor.id,
      name: input.name,
      prefix,
      keyHash,
      scopes: input.scopes,
      ...(input.expiresInDays ? { expiresAt: new Date(Date.now() + input.expiresInDays * 86_400_000) } : {}),
    },
    select: { id: true, name: true, prefix: true, scopes: true, expiresAt: true, createdAt: true },
  });

  return { ...key, secret: `hdl_live_${prefix}.${secret}` };
}

export async function revoke(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  organizationId: string,
  id: string,
): Promise<void> {
  assertPolicy('apiKey:manage', subject(actor, membership));
  const existing = await prisma.apiKey.findFirst({ where: { id, organizationId }, select: { id: true } });
  if (!existing) throw Errors.resourceNotFound('apiKey');
  await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
}
