import type {
  NotificationAction,
  NotificationEntity,
} from '../../generated/prisma/client.ts';
import type { ListNotificationsQuery } from 'contracts';
import { prisma } from '../../database/prisma.ts';
import { DomainEvents, events } from '../../database/events.ts';
import { paginate } from '../../common/utils/pagination.ts';
import { createLogger } from '../../common/logger.ts';

const logger = createLogger('notifications');

async function organizationStaff(
  organizationId: string,
  exclude: string,
): Promise<string[]> {
  const rows = await prisma.organizationMember.findMany({
    where: {
      organizationId,
      role: { in: ['AGENT', 'ORG_ADMIN'] },
      userId: { not: exclude },
    },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}

async function organizationEveryone(
  organizationId: string,
  exclude: string,
): Promise<string[]> {
  const rows = await prisma.organizationMember.findMany({
    where: { organizationId, userId: { not: exclude } },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}

/** Author + assignee + everyone who has commented on the ticket. */
async function ticketWatchers(
  ticketId: string,
  exclude: string,
): Promise<string[]> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      createdById: true,
      assignedToId: true,
      comments: { select: { authorId: true }, distinct: ['authorId'] },
    },
  });
  if (!ticket) return [];
  const set = new Set<string>([
    ticket.createdById,
    ...(ticket.assignedToId ? [ticket.assignedToId] : []),
  ]);
  for (const comment of ticket.comments) set.add(comment.authorId);
  set.delete(exclude);
  return [...set];
}

async function fanOut(input: {
  recipients: string[];
  entity: NotificationEntity;
  action: NotificationAction;
  entityId?: string;
  actorId: string;
  organizationId?: string;
  titleKey: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  if (input.recipients.length === 0) return;
  const created = await prisma.notification.createManyAndReturn({
    data: input.recipients.map((userId) => ({
      userId,
      entity: input.entity,
      action: input.action,
      entityId: input.entityId ?? null,
      actorId: input.actorId,
      organizationId: input.organizationId ?? null,
      titleKey: input.titleKey,
      payload: input.payload as never,
    })),
  });
  for (const notification of created) {
    events.emit(DomainEvents.notificationCreated, { notification });
  }
}

/**
 * Generic notification engine.
 *
 * Rather than sprinkling ad-hoc calls through every service, every domain
 * event is mapped here to (entity, action, recipients) - a 9 entities x 3
 * actions grid. Notifications store i18n KEYS plus a payload, never rendered
 * sentences, so a notification created while the actor used English still
 * reads correctly for a recipient in any other locale.
 */
export function registerNotificationListeners(): void {
  const on = <P>(event: string, handler: (payload: P) => Promise<void>) =>
    events.on<P>(event, (payload) =>
      handler(payload).catch((error: unknown) =>
        logger.error(`notification for ${event} failed`, error),
      ),
    );

  // ---- TICKET -------------------------------------------------------------------
  on<{
    ticket: {
      id: string;
      organizationId: string;
      reference: string;
      title: string;
      createdBy: { id: string };
    };
    actorId: string;
  }>(DomainEvents.ticketCreated, async ({ ticket, actorId }) => {
    await fanOut({
      recipients: await organizationStaff(ticket.organizationId, actorId),
      entity: 'TICKET',
      action: 'CREATED',
      entityId: ticket.id,
      actorId,
      organizationId: ticket.organizationId,
      titleKey: 'notifications.ticket.created',
      payload: { reference: ticket.reference, title: ticket.title },
    });
  });

  on<{
    ticket: {
      id: string;
      organizationId: string;
      reference: string;
      title: string;
      createdBy: { id: string };
      assignedTo: { id: string } | null;
    };
    changes: Array<{ field: string }>;
    actorId: string;
  }>(DomainEvents.ticketUpdated, async ({ ticket, changes, actorId }) => {
    const targets = new Set<string>([ticket.createdBy.id]);
    if (ticket.assignedTo) targets.add(ticket.assignedTo.id);
    await fanOut({
      recipients: [...targets].filter((id) => id !== actorId),
      entity: 'TICKET',
      action: 'UPDATED',
      entityId: ticket.id,
      actorId,
      organizationId: ticket.organizationId,
      titleKey: 'notifications.ticket.updated',
      payload: {
        reference: ticket.reference,
        title: ticket.title,
        fields: changes.map((c) => c.field),
      },
    });
  });

  on<{ ticketId: string; organizationId: string; actorId: string }>(
    DomainEvents.ticketDeleted,
    async ({ ticketId, organizationId, actorId }) => {
      await fanOut({
        recipients: await organizationStaff(organizationId, actorId),
        entity: 'TICKET',
        action: 'DELETED',
        entityId: ticketId,
        actorId,
        organizationId,
        titleKey: 'notifications.ticket.deleted',
        payload: {},
      });
    },
  );

  // ---- COMMENT ------------------------------------------------------------------
  on<{
    comment: { id: string };
    ticket: { id: string; organizationId: string; reference: string };
    actorId: string;
  }>(DomainEvents.commentCreated, async ({ comment, ticket, actorId }) => {
    await fanOut({
      recipients: await ticketWatchers(ticket.id, actorId),
      entity: 'COMMENT',
      action: 'CREATED',
      entityId: comment.id,
      actorId,
      organizationId: ticket.organizationId,
      titleKey: 'notifications.comment.created',
      payload: { ticketId: ticket.id, reference: ticket.reference },
    });
  });
  on<{ comment: { id: string }; ticketId: string; actorId: string }>(
    DomainEvents.commentUpdated,
    async ({ comment, ticketId, actorId }) => {
      await fanOut({
        recipients: await ticketWatchers(ticketId, actorId),
        entity: 'COMMENT',
        action: 'UPDATED',
        entityId: comment.id,
        actorId,
        titleKey: 'notifications.comment.updated',
        payload: { ticketId },
      });
    },
  );
  on<{ commentId: string; ticketId: string; actorId: string }>(
    DomainEvents.commentDeleted,
    async ({ commentId, ticketId, actorId }) => {
      await fanOut({
        recipients: await ticketWatchers(ticketId, actorId),
        entity: 'COMMENT',
        action: 'DELETED',
        entityId: commentId,
        actorId,
        titleKey: 'notifications.comment.deleted',
        payload: { ticketId },
      });
    },
  );

  // ---- ATTACHMENT ---------------------------------------------------------------
  on<{
    attachment: { id: string; originalName: string };
    ticketId: string;
    organizationId: string;
    actorId: string;
  }>(
    DomainEvents.attachmentCreated,
    async ({ attachment, ticketId, organizationId, actorId }) => {
      await fanOut({
        recipients: await ticketWatchers(ticketId, actorId),
        entity: 'ATTACHMENT',
        action: 'CREATED',
        entityId: attachment.id,
        actorId,
        organizationId,
        titleKey: 'notifications.attachment.created',
        payload: { ticketId, name: attachment.originalName },
      });
    },
  );
  on<{ attachmentId: string; ticketId: string; actorId: string }>(
    DomainEvents.attachmentDeleted,
    async ({ attachmentId, ticketId, actorId }) => {
      await fanOut({
        recipients: await ticketWatchers(ticketId, actorId),
        entity: 'ATTACHMENT',
        action: 'DELETED',
        entityId: attachmentId,
        actorId,
        titleKey: 'notifications.attachment.deleted',
        payload: { ticketId },
      });
    },
  );

  // ---- ORGANIZATION / MEMBERSHIP / CATEGORY --------------------------------------
  on<{ organization: { id: string; name: string }; actorId: string }>(
    DomainEvents.organizationCreated,
    async ({ organization, actorId }) => {
      await fanOut({
        recipients: [actorId],
        entity: 'ORGANIZATION',
        action: 'CREATED',
        entityId: organization.id,
        actorId,
        organizationId: organization.id,
        titleKey: 'notifications.organization.created',
        payload: { name: organization.name },
      });
    },
  );
  on<{ organization: { id: string; name: string }; actorId: string }>(
    DomainEvents.organizationUpdated,
    async ({ organization, actorId }) => {
      await fanOut({
        recipients: await organizationEveryone(organization.id, actorId),
        entity: 'ORGANIZATION',
        action: 'UPDATED',
        entityId: organization.id,
        actorId,
        organizationId: organization.id,
        titleKey: 'notifications.organization.updated',
        payload: { name: organization.name },
      });
    },
  );
  on<{ organizationId: string; actorId: string }>(
    DomainEvents.organizationDeleted,
    async ({ organizationId, actorId }) => {
      await fanOut({
        recipients: await organizationEveryone(organizationId, actorId),
        entity: 'ORGANIZATION',
        action: 'DELETED',
        entityId: organizationId,
        actorId,
        titleKey: 'notifications.organization.deleted',
        payload: {},
      });
    },
  );
  on<{
    member: { organizationId: string; user: { id: string } };
    actorId: string;
  }>(DomainEvents.memberAdded, async ({ member, actorId }) => {
    await fanOut({
      recipients: [member.user.id],
      entity: 'MEMBERSHIP',
      action: 'CREATED',
      entityId: member.organizationId,
      actorId,
      organizationId: member.organizationId,
      titleKey: 'notifications.membership.created',
      payload: {},
    });
  });
  on<{
    member: { organizationId: string; role: string; user: { id: string } };
    actorId: string;
  }>(DomainEvents.memberUpdated, async ({ member, actorId }) => {
    await fanOut({
      recipients: [member.user.id],
      entity: 'MEMBERSHIP',
      action: 'UPDATED',
      entityId: member.organizationId,
      actorId,
      organizationId: member.organizationId,
      titleKey: 'notifications.membership.updated',
      payload: { role: member.role },
    });
  });
  on<{ organizationId: string; userId: string; actorId: string }>(
    DomainEvents.memberRemoved,
    async ({ organizationId, userId, actorId }) => {
      await fanOut({
        recipients: [userId],
        entity: 'MEMBERSHIP',
        action: 'DELETED',
        entityId: organizationId,
        actorId,
        titleKey: 'notifications.membership.deleted',
        payload: {},
      });
    },
  );
  for (const [event, action] of [
    [DomainEvents.categoryCreated, 'CREATED'],
    [DomainEvents.categoryUpdated, 'UPDATED'],
    [DomainEvents.categoryDeleted, 'DELETED'],
  ] as const) {
    on<{
      category?: { id: string; name: string };
      categoryId?: string;
      organizationId: string;
      actorId: string;
    }>(event, async ({ category, categoryId, organizationId, actorId }) => {
      await fanOut({
        recipients: await organizationStaff(organizationId, actorId),
        entity: 'CATEGORY',
        action,
        entityId: category?.id ?? categoryId,
        actorId,
        organizationId,
        titleKey: `notifications.category.${action.toLowerCase()}`,
        payload: { name: category?.name },
      });
    });
  }

  // ---- FRIENDSHIP / MESSAGE / ACCOUNT --------------------------------------------
  on<{
    friendship: { id: string; addresseeId: string; requesterId: string };
    actorId: string;
  }>(DomainEvents.friendshipRequested, async ({ friendship, actorId }) => {
    await fanOut({
      recipients: [friendship.addresseeId],
      entity: 'FRIENDSHIP',
      action: 'CREATED',
      entityId: friendship.id,
      actorId,
      titleKey: 'notifications.friendship.created',
      payload: {},
    });
  });
  on<{ friendship: { id: string; requesterId: string }; actorId: string }>(
    DomainEvents.friendshipAccepted,
    async ({ friendship, actorId }) => {
      await fanOut({
        recipients: [friendship.requesterId],
        entity: 'FRIENDSHIP',
        action: 'UPDATED',
        entityId: friendship.id,
        actorId,
        titleKey: 'notifications.friendship.updated',
        payload: {},
      });
    },
  );
  on<{ friendshipId: string; otherUserId: string; actorId: string }>(
    DomainEvents.friendshipRemoved,
    async ({ friendshipId, otherUserId, actorId }) => {
      await fanOut({
        recipients: [otherUserId],
        entity: 'FRIENDSHIP',
        action: 'DELETED',
        entityId: friendshipId,
        actorId,
        titleKey: 'notifications.friendship.deleted',
        payload: {},
      });
    },
  );
  on<{
    message: { id: string; conversationId: string };
    recipientIds: string[];
    actorId: string;
  }>(
    DomainEvents.messageCreated,
    async ({ message, recipientIds, actorId }) => {
      await fanOut({
        recipients: recipientIds.filter((id) => id !== actorId),
        entity: 'MESSAGE',
        action: 'CREATED',
        entityId: message.id,
        actorId,
        titleKey: 'notifications.message.created',
        payload: { conversationId: message.conversationId },
      });
    },
  );
  for (const [event, action] of [
    [DomainEvents.accountCreated, 'CREATED'],
    [DomainEvents.accountUpdated, 'UPDATED'],
    [DomainEvents.accountDeleted, 'DELETED'],
  ] as const) {
    on<{ userId: string }>(event, async ({ userId }) => {
      await fanOut({
        recipients: [userId],
        entity: 'ACCOUNT',
        action,
        entityId: userId,
        actorId: userId,
        titleKey: `notifications.account.${action.toLowerCase()}`,
        payload: {},
      });
    });
  }
}

// -------------------------------------------------------------------- read API --
export async function list(userId: string, query: ListNotificationsQuery) {
  const where = {
    userId,
    ...(query.unread ? { readAt: null } : {}),
    ...(query.entity ? { entity: query.entity } : {}),
    ...(query.action ? { action: query.action } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.take,
      take: query.take,
      select: {
        id: true,
        entity: true,
        action: true,
        entityId: true,
        organizationId: true,
        titleKey: true,
        payload: true,
        readAt: true,
        createdAt: true,
        actor: {
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    }),
    prisma.notification.count({ where }),
  ]);
  return paginate(rows, total, query.page, query.take);
}

export function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markRead(userId: string, id: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function remove(userId: string, id: string): Promise<void> {
  await prisma.notification.deleteMany({ where: { id, userId } });
}
