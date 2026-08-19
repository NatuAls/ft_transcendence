import type { TicketStatus } from '../../generated/prisma/client.ts';
import type {
  AssignTicketInput,
  ChangeStatusInput,
  CreateCommentInput,
  CreateTicketInput,
  UpdateTicketInput,
} from 'contracts';
import { prisma } from '../../database/prisma.ts';
import { DomainEvents, events } from '../../database/events.ts';
import { assertPolicy, canPolicy } from '../../rbac/rbac.ts';
import { Errors } from '../../common/errors/domain-error.ts';
import type { RequestActor, RequestMembership } from '../../common/types.ts';
import {
  assertTransition,
  buildReference,
  timestampsFor,
} from './domain/state-machine.ts';

const TICKET_SELECT = {
  id: true,
  reference: true,
  organizationId: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  resolution: true,
  createdAt: true,
  updatedAt: true,
  firstResponseAt: true,
  resolvedAt: true,
  closedAt: true,
  category: { select: { id: true, name: true, color: true } },
  createdBy: {
    select: {
      id: true,
      username: true,
      profile: { select: { displayName: true, avatarUrl: true } },
    },
  },
  assignedTo: {
    select: {
      id: true,
      username: true,
      profile: { select: { displayName: true, avatarUrl: true } },
    },
  },
  _count: { select: { comments: true, attachments: true } },
} as const;

function subject(actor: RequestActor, membership?: RequestMembership) {
  return {
    userId: actor.id,
    isGlobalAdmin: actor.globalRole === 'GLOBAL_ADMIN',
    orgRole: membership?.role,
  };
}

export async function create(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  input: CreateTicketInput,
) {
  assertPolicy('ticket:create', subject(actor, membership));

  return events.runInTransaction(async (tx) => {
    // Atomically bump the per-organization counter so two concurrent creates
    // can never produce the same ACME-0042 reference.
    const org = await tx.organization.update({
      where: { id: input.organizationId },
      data: { ticketSeq: { increment: 1 } },
      select: { slug: true, ticketSeq: true },
    });

    if (input.categoryId) {
      const category = await tx.category.findFirst({
        where: { id: input.categoryId, organizationId: input.organizationId },
        select: { id: true },
      });
      if (!category) throw Errors.resourceNotFound('category');
    }

    const ticket = await tx.ticket.create({
      data: {
        reference: buildReference(org.slug, org.ticketSeq),
        organizationId: input.organizationId,
        createdById: actor.id,
        categoryId: input.categoryId ?? null,
        title: input.title,
        description: input.description,
        priority: input.priority,
      },
      select: TICKET_SELECT,
    });

    await tx.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        changedById: actor.id,
        field: 'status',
        oldValue: null,
        newValue: 'OPEN',
      },
    });

    events.emit(DomainEvents.ticketCreated, { ticket, actorId: actor.id });
    return ticket;
  });
}

export async function findOne(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  id: string,
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: TICKET_SELECT,
  });
  if (!ticket) throw Errors.resourceNotFound('ticket');

  const isGlobalAdmin = actor.globalRole === 'GLOBAL_ADMIN';
  if (
    !isGlobalAdmin &&
    (!membership || membership.organizationId !== ticket.organizationId)
  ) {
    throw Errors.notAMember();
  }
  assertPolicy('ticket:read', subject(actor, membership), {
    ownerId: ticket.createdBy.id,
  });
  return ticket;
}

export async function update(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  id: string,
  input: UpdateTicketInput,
) {
  const current = await findOne(actor, membership, id);
  assertPolicy('ticket:update', subject(actor, membership), {
    ownerId: current.createdBy.id,
    status: current.status,
  });

  if (input.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: input.categoryId, organizationId: current.organizationId },
      select: { id: true },
    });
    if (!category) throw Errors.resourceNotFound('category');
  }

  return events.runInTransaction(async (tx) => {
    const changes: Array<{
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }> = [];
    if (input.title && input.title !== current.title) {
      changes.push({
        field: 'title',
        oldValue: current.title,
        newValue: input.title,
      });
    }
    if (input.priority && input.priority !== current.priority) {
      changes.push({
        field: 'priority',
        oldValue: current.priority,
        newValue: input.priority,
      });
    }
    if (
      input.categoryId !== undefined &&
      (input.categoryId ?? null) !== (current.category?.id ?? null)
    ) {
      changes.push({
        field: 'category',
        oldValue: current.category?.id ?? null,
        newValue: input.categoryId ?? null,
      });
    }
    if (input.description && input.description !== current.description) {
      changes.push({
        field: 'description',
        oldValue: '(updated)',
        newValue: '(updated)',
      });
    }

    const ticket = await tx.ticket.update({
      where: { id },
      data: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.priority ? { priority: input.priority } : {}),
        ...(input.categoryId !== undefined
          ? { categoryId: input.categoryId }
          : {}),
      },
      select: TICKET_SELECT,
    });

    if (changes.length > 0) {
      await tx.ticketHistory.createMany({
        data: changes.map((change) => ({
          ...change,
          ticketId: id,
          changedById: actor.id,
        })),
      });
    }

    events.emit(DomainEvents.ticketUpdated, {
      ticket,
      changes,
      actorId: actor.id,
    });
    return ticket;
  });
}

export async function changeStatus(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  id: string,
  input: ChangeStatusInput,
) {
  const current = await findOne(actor, membership, id);

  // Authors may only perform the RESOLVED -> CLOSED confirmation on their own
  // ticket; anything else needs at least AGENT. Enforced by the policy table.
  assertPolicy('ticket:changeStatus', subject(actor, membership), {
    ownerId: current.createdBy.id,
    status: current.status,
  });
  if (
    current.createdBy.id === actor.id &&
    membership?.role === 'MEMBER' &&
    !(current.status === 'RESOLVED' && input.status === 'CLOSED')
  ) {
    throw Errors.forbiddenAction('perform this transition');
  }
  if (input.status === 'IN_PROGRESS' && current.status === 'CLOSED') {
    assertPolicy('ticket:reopen', subject(actor, membership));
  }

  assertTransition(current.status as TicketStatus, input.status);

  return events.runInTransaction(async (tx) => {
    const ticket = await tx.ticket.update({
      where: { id },
      data: {
        status: input.status,
        ...(input.resolution ? { resolution: input.resolution } : {}),
        ...timestampsFor(input.status),
        ...(current.firstResponseAt === null && input.status === 'IN_PROGRESS'
          ? { firstResponseAt: new Date() }
          : {}),
        ...(input.status === 'IN_PROGRESS' && !current.assignedTo
          ? { assignedToId: actor.id }
          : {}),
      },
      select: TICKET_SELECT,
    });

    await tx.ticketHistory.create({
      data: {
        ticketId: id,
        changedById: actor.id,
        field: 'status',
        oldValue: current.status,
        newValue: input.status,
        note: input.note ?? null,
      },
    });

    events.emit(DomainEvents.ticketUpdated, {
      ticket,
      changes: [
        { field: 'status', oldValue: current.status, newValue: input.status },
      ],
      actorId: actor.id,
    });
    return ticket;
  });
}

export async function assign(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  id: string,
  input: AssignTicketInput,
) {
  const current = await findOne(actor, membership, id);
  const isSelf = input.assigneeId === actor.id;
  assertPolicy(
    isSelf ? 'ticket:selfAssign' : 'ticket:assignOther',
    subject(actor, membership),
  );

  if (input.assigneeId) {
    const target = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: current.organizationId,
          userId: input.assigneeId,
        },
      },
      select: { role: true },
    });
    if (!target) throw Errors.resourceNotFound('member');
    if (target.role === 'MEMBER') throw Errors.assigneeNotAgent();
  }

  return events.runInTransaction(async (tx) => {
    const ticket = await tx.ticket.update({
      where: { id },
      data: { assignedToId: input.assigneeId },
      select: TICKET_SELECT,
    });
    await tx.ticketHistory.create({
      data: {
        ticketId: id,
        changedById: actor.id,
        field: 'assignee',
        oldValue: current.assignedTo?.id ?? null,
        newValue: input.assigneeId,
      },
    });
    events.emit(DomainEvents.ticketUpdated, {
      ticket,
      changes: [
        {
          field: 'assignee',
          oldValue: current.assignedTo?.id ?? null,
          newValue: input.assigneeId,
        },
      ],
      actorId: actor.id,
    });
    return ticket;
  });
}

export async function remove(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  id: string,
): Promise<void> {
  const current = await findOne(actor, membership, id);
  assertPolicy('ticket:delete', subject(actor, membership));
  await events.runInTransaction(async (tx) => {
    await tx.ticket.delete({ where: { id } });
    events.emit(DomainEvents.ticketDeleted, {
      ticketId: id,
      organizationId: current.organizationId,
      actorId: actor.id,
    });
  });
}

export async function history(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  id: string,
) {
  await findOne(actor, membership, id);
  return prisma.ticketHistory.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      field: true,
      oldValue: true,
      newValue: true,
      note: true,
      createdAt: true,
      changedBy: {
        select: {
          id: true,
          username: true,
          profile: { select: { displayName: true, avatarUrl: true } },
        },
      },
    },
  });
}

// ----------------------------------------------------------------------- comments --
export async function listComments(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  ticketId: string,
) {
  await findOne(actor, membership, ticketId);
  const canSeeInternal = canPolicy(
    'ticket:viewInternalNotes',
    subject(actor, membership),
  );
  return prisma.ticketComment.findMany({
    where: {
      ticketId,
      deletedAt: null,
      ...(canSeeInternal ? {} : { isInternal: false }),
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      body: true,
      isInternal: true,
      createdAt: true,
      updatedAt: true,
      author: {
        select: {
          id: true,
          username: true,
          profile: { select: { displayName: true, avatarUrl: true } },
        },
      },
      attachments: {
        where: { deletedAt: null },
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
        },
      },
    },
  });
}

export async function addComment(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  ticketId: string,
  input: CreateCommentInput,
) {
  const ticket = await findOne(actor, membership, ticketId);
  assertPolicy('comment:create', subject(actor, membership));
  if (input.isInternal)
    assertPolicy('comment:createInternal', subject(actor, membership));

  return events.runInTransaction(async (tx) => {
    const comment = await tx.ticketComment.create({
      data: {
        ticketId,
        authorId: actor.id,
        body: input.body,
        isInternal: input.isInternal,
      },
      select: {
        id: true,
        body: true,
        isInternal: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    // First agent reply stamps the first-response metric.
    if (!ticket.firstResponseAt && membership && membership.role !== 'MEMBER') {
      await tx.ticket.update({
        where: { id: ticketId },
        data: { firstResponseAt: new Date() },
      });
    }

    events.emit(DomainEvents.commentCreated, {
      comment,
      ticket: {
        id: ticket.id,
        reference: ticket.reference,
        organizationId: ticket.organizationId,
        title: ticket.title,
      },
      actorId: actor.id,
    });
    return comment;
  });
}

export async function updateComment(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  ticketId: string,
  commentId: string,
  body: string,
) {
  await findOne(actor, membership, ticketId);
  const comment = await prisma.ticketComment.findFirst({
    where: { id: commentId, ticketId, deletedAt: null },
    select: { id: true, authorId: true, createdAt: true },
  });
  if (!comment) throw Errors.resourceNotFound('comment');
  assertPolicy('comment:update', subject(actor, membership), {
    ownerId: comment.authorId,
    createdAt: comment.createdAt,
  });

  return events.runInTransaction(async (tx) => {
    const updated = await tx.ticketComment.update({
      where: { id: commentId },
      data: { body },
      select: {
        id: true,
        body: true,
        isInternal: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    events.emit(DomainEvents.commentUpdated, {
      comment: updated,
      ticketId,
      actorId: actor.id,
    });
    return updated;
  });
}

export async function removeComment(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  ticketId: string,
  commentId: string,
): Promise<void> {
  await findOne(actor, membership, ticketId);
  const comment = await prisma.ticketComment.findFirst({
    where: { id: commentId, ticketId, deletedAt: null },
    select: { id: true, authorId: true, createdAt: true },
  });
  if (!comment) throw Errors.resourceNotFound('comment');
  assertPolicy('comment:delete', subject(actor, membership), {
    ownerId: comment.authorId,
  });

  await events.runInTransaction(async (tx) => {
    await tx.ticketComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date(), body: '' },
    });
    events.emit(DomainEvents.commentDeleted, {
      commentId,
      ticketId,
      actorId: actor.id,
    });
  });
}
