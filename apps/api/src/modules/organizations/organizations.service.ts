import type {
  CreateCategoryInput,
  CreateOrganizationInput,
  InviteMemberInput,
  UpdateOrganizationInput,
} from 'contracts';
import type { OrgRole } from '../../generated/prisma/client.ts';
import { prisma } from '../../database/prisma.ts';
import { DomainEvents, events } from '../../database/events.ts';
import { invalidateMembership, assertPolicy } from '../../rbac/rbac.ts';
import { sendOrganizationInvite } from '../mail/mail.service.ts';
import { Errors } from '../../common/errors/domain-error.ts';
import type { RequestActor, RequestMembership } from '../../common/types.ts';

const slugify = (value: string): string =>
  (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'org'
  );

function subject(actor: RequestActor, membership?: RequestMembership) {
  return {
    userId: actor.id,
    isGlobalAdmin: actor.globalRole === 'GLOBAL_ADMIN',
    orgRole: membership?.role,
  };
}

export async function listMine(actor: RequestActor) {
  const where =
    actor.globalRole === 'GLOBAL_ADMIN'
      ? { deletedAt: null }
      : { deletedAt: null, members: { some: { userId: actor.id } } };
  const rows = await prisma.organization.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      createdAt: true,
      createdById: true,
      members: { where: { userId: actor.id }, select: { role: true } },
      _count: { select: { members: true, tickets: true, categories: true } },
    },
  });
  return rows.map((row) => {
    const { members, ...org } = row;
    return { ...org, myRole: members[0]?.role ?? null };
  });
}

export async function findOne(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  id: string,
) {
  const org = await prisma.organization.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      createdAt: true,
      createdById: true,
      _count: { select: { members: true, tickets: true, categories: true } },
    },
  });
  if (!org) throw Errors.resourceNotFound('organization');
  assertPolicy('organization:read', subject(actor, membership));
  return { ...org, myRole: membership?.role ?? null };
}

export async function create(actor: RequestActor, input: CreateOrganizationInput) {
  const slug = input.slug ?? slugify(input.name);
  if (await prisma.organization.findUnique({ where: { slug }, select: { id: true } })) {
    throw Errors.slugTaken();
  }
  return events.runInTransaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        createdById: actor.id,
        members: { create: { userId: actor.id, role: 'ORG_ADMIN' } },
        categories: {
          create: [
            { name: 'General', color: '#0d6c90' },
            { name: 'Hardware', color: '#b4690e' },
            { name: 'Software', color: '#1b8a5a' },
            { name: 'Network', color: '#b42318' },
          ],
        },
      },
      select: { id: true, name: true, slug: true, description: true, createdAt: true, createdById: true },
    });
    events.emit(DomainEvents.organizationCreated, { organization: org, actorId: actor.id });
    return { ...org, myRole: 'ORG_ADMIN' as OrgRole };
  });
}

export async function update(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  id: string,
  input: UpdateOrganizationInput,
) {
  await findOne(actor, membership, id);
  assertPolicy('organization:update', subject(actor, membership));
  return events.runInTransaction(async (tx) => {
    const org = await tx.organization.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
      select: { id: true, name: true, slug: true, description: true, createdAt: true, createdById: true },
    });
    events.emit(DomainEvents.organizationUpdated, { organization: org, actorId: actor.id });
    return org;
  });
}

export async function remove(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  id: string,
): Promise<void> {
  const org = await findOne(actor, membership, id);
  assertPolicy('organization:delete', subject(actor, membership), { ownerId: org.createdById });
  await events.runInTransaction(async (tx) => {
    await tx.organization.update({ where: { id }, data: { deletedAt: new Date() } });
    events.emit(DomainEvents.organizationDeleted, { organizationId: id, actorId: actor.id });
  });
}

// ------------------------------------------------------------------- members --
export async function listMembers(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  id: string,
) {
  await findOne(actor, membership, id);
  assertPolicy('member:read', subject(actor, membership));
  return prisma.organizationMember.findMany({
    where: { organizationId: id },
    orderBy: [{ role: 'desc' }, { joinedAt: 'asc' }],
    select: {
      id: true,
      role: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          profile: { select: { displayName: true, avatarUrl: true, isOnline: true, lastSeenAt: true } },
        },
      },
    },
  });
}

export async function invite(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  id: string,
  input: InviteMemberInput,
  origin: string,
) {
  const org = await findOne(actor, membership, id);
  assertPolicy('member:invite', subject(actor, membership));

  const identifier = input.identifier.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }], deletedAt: null },
    select: { id: true, email: true, username: true },
  });
  if (!user) throw Errors.resourceNotFound('user');

  const existing = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: id, userId: user.id } },
    select: { id: true },
  });
  if (existing) throw Errors.alreadyMember();

  const created = await events.runInTransaction(async (tx) => {
    const member = await tx.organizationMember.create({
      data: { organizationId: id, userId: user.id, role: input.role, invitedById: actor.id },
      select: {
        id: true,
        role: true,
        joinedAt: true,
        organizationId: true,
        user: { select: { id: true, username: true, email: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      },
    });
    events.emit(DomainEvents.memberAdded, { member, organization: org, actorId: actor.id });
    return member;
  });

  await invalidateMembership(user.id, id);
  await sendOrganizationInvite(user.email, org.name, actor.username, `${origin}/app/organizations/${org.slug}`);
  return created;
}

export async function changeRole(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  id: string,
  userId: string,
  role: OrgRole,
) {
  await findOne(actor, membership, id);
  assertPolicy('member:changeRole', subject(actor, membership));
  if (role !== 'ORG_ADMIN' && (await isLastAdmin(id, userId))) throw Errors.lastAdmin();

  const member = await events.runInTransaction(async (tx) => {
    const updated = await tx.organizationMember.update({
      where: { organizationId_userId: { organizationId: id, userId } },
      data: { role },
      select: { id: true, role: true, organizationId: true, user: { select: { id: true, username: true } } },
    });
    events.emit(DomainEvents.memberUpdated, { member: updated, actorId: actor.id });
    return updated;
  });
  await invalidateMembership(userId, id);
  return member;
}

export async function removeMember(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  id: string,
  userId: string,
): Promise<void> {
  await findOne(actor, membership, id);
  const isSelf = userId === actor.id;
  const lastAdmin = await isLastAdmin(id, userId);
  assertPolicy(isSelf ? 'member:leave' : 'member:remove', subject(actor, membership), {
    isLastAdmin: lastAdmin,
  });
  if (lastAdmin) throw Errors.lastAdmin();

  await events.runInTransaction(async (tx) => {
    // Open tickets assigned to the departing member go back to the pool,
    // otherwise they would silently become unreachable work.
    await tx.ticket.updateMany({
      where: { organizationId: id, assignedToId: userId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      data: { assignedToId: null },
    });
    await tx.organizationMember.delete({ where: { organizationId_userId: { organizationId: id, userId } } });
    events.emit(DomainEvents.memberRemoved, { organizationId: id, userId, actorId: actor.id });
  });
  await invalidateMembership(userId, id);
}

async function isLastAdmin(organizationId: string, userId: string): Promise<boolean> {
  const [target, adminCount] = await Promise.all([
    prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true },
    }),
    prisma.organizationMember.count({ where: { organizationId, role: 'ORG_ADMIN' } }),
  ]);
  return target?.role === 'ORG_ADMIN' && adminCount <= 1;
}

// ----------------------------------------------------------------- categories --
export async function listCategories(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  id: string,
) {
  await findOne(actor, membership, id);
  assertPolicy('category:read', subject(actor, membership));
  return prisma.category.findMany({
    where: { organizationId: id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, description: true, color: true, isActive: true, _count: { select: { tickets: true } } },
  });
}

export async function createCategory(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  id: string,
  input: CreateCategoryInput,
) {
  await findOne(actor, membership, id);
  assertPolicy('category:write', subject(actor, membership));
  if (
    await prisma.category.findUnique({
      where: { organizationId_name: { organizationId: id, name: input.name } },
      select: { id: true },
    })
  ) {
    throw Errors.categoryNameTaken();
  }
  return events.runInTransaction(async (tx) => {
    const category = await tx.category.create({
      data: { organizationId: id, name: input.name, description: input.description ?? null, color: input.color },
      select: { id: true, name: true, description: true, color: true, isActive: true },
    });
    events.emit(DomainEvents.categoryCreated, { category, organizationId: id, actorId: actor.id });
    return category;
  });
}

export async function updateCategory(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  id: string,
  categoryId: string,
  input: Partial<CreateCategoryInput> & { isActive?: boolean },
) {
  await findOne(actor, membership, id);
  assertPolicy('category:write', subject(actor, membership));
  const existing = await prisma.category.findFirst({ where: { id: categoryId, organizationId: id }, select: { id: true } });
  if (!existing) throw Errors.resourceNotFound('category');
  return events.runInTransaction(async (tx) => {
    const category = await tx.category.update({
      where: { id: categoryId },
      data: input,
      select: { id: true, name: true, description: true, color: true, isActive: true },
    });
    events.emit(DomainEvents.categoryUpdated, { category, organizationId: id, actorId: actor.id });
    return category;
  });
}

export async function removeCategory(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  id: string,
  categoryId: string,
): Promise<void> {
  await findOne(actor, membership, id);
  assertPolicy('category:write', subject(actor, membership));
  const existing = await prisma.category.findFirst({ where: { id: categoryId, organizationId: id }, select: { id: true } });
  if (!existing) throw Errors.resourceNotFound('category');
  await events.runInTransaction(async (tx) => {
    await tx.category.delete({ where: { id: categoryId } });
    events.emit(DomainEvents.categoryDeleted, { categoryId, organizationId: id, actorId: actor.id });
  });
}

// --------------------------------------------------------------------- stats --
export async function stats(actor: RequestActor, membership: RequestMembership | undefined, id: string) {
  await findOne(actor, membership, id);
  assertPolicy('stats:read', subject(actor, membership));

  const [byStatus, byPriority, total, unassigned, avgFirstResponse] = await Promise.all([
    prisma.ticket.groupBy({ by: ['status'], where: { organizationId: id }, _count: true }),
    prisma.ticket.groupBy({ by: ['priority'], where: { organizationId: id }, _count: true }),
    prisma.ticket.count({ where: { organizationId: id } }),
    prisma.ticket.count({ where: { organizationId: id, assignedToId: null, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.$queryRawUnsafe<Array<{ avg: number | null }>>(
      `SELECT avg(extract(epoch FROM ("firstResponseAt" - "createdAt")))::float AS avg
       FROM tickets WHERE "organizationId" = $1::uuid AND "firstResponseAt" IS NOT NULL`,
      id,
    ),
  ]);

  const toMap = (rows: Array<{ _count: number } & Record<string, unknown>>, key: string) =>
    Object.fromEntries(rows.map((row) => [String(row[key]), row._count])) as Record<string, number>;

  return {
    total,
    unassigned,
    byStatus: toMap(byStatus as never, 'status'),
    byPriority: toMap(byPriority as never, 'priority'),
    avgFirstResponseSeconds: Math.round(avgFirstResponse[0]?.avg ?? 0),
  };
}
