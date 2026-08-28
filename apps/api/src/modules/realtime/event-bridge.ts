import { prisma } from '../../database/prisma.ts';
import { DomainEvents, events } from '../../database/events.ts';
import type { RealtimeServer } from './socket-server.ts';

/**
 * Generic DomainEvents -> room relay. Services never import the realtime
 * layer directly; they just emit on the shared event bus, and this is the
 * one place that maps an event name to the rooms it should reach.
 */
export function attachEventBridge({ io, sockets }: RealtimeServer): void {
  const relay = <P>(
    event: string,
    route: (payload: P) => { rooms: string[]; body: unknown },
  ) =>
    events.on<P>(event, (payload) => {
      const { rooms, body } = route(payload);
      for (const room of rooms) io.to(room).emit(event, body);
    });

  relay<{ ticket: { id: string; organizationId: string } }>(
    DomainEvents.ticketCreated,
    ({ ticket }) => ({
      rooms: [`org:${ticket.organizationId}`],
      body: { ticket },
    }),
  );
  relay<{ ticket: { id: string; organizationId: string }; changes: unknown }>(
    DomainEvents.ticketUpdated,
    ({ ticket, changes }) => ({
      rooms: [`org:${ticket.organizationId}`, `ticket:${ticket.id}`],
      body: { ticket, changes },
    }),
  );
  relay<{ ticketId: string; organizationId: string }>(
    DomainEvents.ticketDeleted,
    (p) => ({
      rooms: [`org:${p.organizationId}`],
      body: p,
    }),
  );
  relay<{ comment: unknown; ticket: { id: string } }>(
    DomainEvents.commentCreated,
    (p) => ({
      rooms: [`ticket:${p.ticket.id}`],
      body: p,
    }),
  );
  for (const event of [
    DomainEvents.commentUpdated,
    DomainEvents.commentDeleted,
  ]) {
    relay<{ ticketId: string }>(event, (p) => ({
      rooms: [`ticket:${p.ticketId}`],
      body: p,
    }));
  }
  for (const event of [
    DomainEvents.attachmentCreated,
    DomainEvents.attachmentDeleted,
  ]) {
    relay<{ ticketId: string }>(event, (p) => ({
      rooms: [`ticket:${p.ticketId}`],
      body: p,
    }));
  }
  for (const event of [
    DomainEvents.categoryCreated,
    DomainEvents.categoryUpdated,
    DomainEvents.categoryDeleted,
  ]) {
    relay<{ organizationId: string }>(event, (p) => ({
      rooms: [`org:${p.organizationId}`],
      body: p,
    }));
  }

  // memberAdded/memberRemoved don't just relay: SocketUser.organizationIds is
  // cached at connection time and used to authorise ticket.subscribe/sync, so
  // a membership change has to patch that cache (and the socket's actual room
  // membership) for every live socket of the affected user, or a removed
  // member keeps read access to that org's tickets until they reconnect.
  events.on<{ member: { organizationId: string; user: { id: string } } }>(
    DomainEvents.memberAdded,
    async (payload) => {
      const { organizationId } = payload.member;
      const userId = payload.member.user.id;
      io.to(`org:${organizationId}`).emit(DomainEvents.memberAdded, payload);
      for (const [socketId, user] of sockets) {
        if (user.id !== userId) continue;
        if (!user.organizationIds.includes(organizationId))
          user.organizationIds.push(organizationId);
        await io.in(socketId).socketsJoin(`org:${organizationId}`);
      }
    },
  );
  relay<{ member: { organizationId: string } }>(
    DomainEvents.memberUpdated,
    (p) => ({
      rooms: [`org:${p.member.organizationId}`],
      body: p,
    }),
  );
  events.on<{ organizationId: string; userId: string }>(
    DomainEvents.memberRemoved,
    async (payload) => {
      const { organizationId, userId } = payload;
      io.to([`org:${organizationId}`, `user:${userId}`]).emit(
        DomainEvents.memberRemoved,
        payload,
      );
      for (const [socketId, user] of sockets) {
        if (user.id !== userId) continue;
        user.organizationIds = user.organizationIds.filter(
          (id) => id !== organizationId,
        );
        await io.in(socketId).socketsLeave(`org:${organizationId}`);
      }
    },
  );

  relay<{ message: { conversationId: string } }>(
    DomainEvents.messageCreated,
    (p) => ({
      rooms: [`conv:${p.message.conversationId}`],
      body: p,
    }),
  );
  relay<{ conversationId: string }>(DomainEvents.messageRead, (p) => ({
    rooms: [`conv:${p.conversationId}`],
    body: p,
  }));

  for (const event of [
    DomainEvents.friendshipRequested,
    DomainEvents.friendshipAccepted,
    DomainEvents.friendshipRemoved,
  ]) {
    relay<{
      targetUserId?: string;
      otherUserId?: string;
      friendship?: { addresseeId?: string; requesterId?: string };
    }>(event, (p) => ({
      rooms: [
        ...(p.targetUserId ? [`user:${p.targetUserId}`] : []),
        ...(p.otherUserId ? [`user:${p.otherUserId}`] : []),
        ...(p.friendship?.addresseeId
          ? [`user:${p.friendship.addresseeId}`]
          : []),
        ...(p.friendship?.requesterId
          ? [`user:${p.friendship.requesterId}`]
          : []),
      ],
      body: p,
    }));
  }

  events.on<{ notification: { userId: string } }>(
    DomainEvents.notificationCreated,
    async ({ notification }) => {
      const unreadCount = await prisma.notification.count({
        where: { userId: notification.userId, readAt: null },
      });
      io.to(`user:${notification.userId}`).emit(
        DomainEvents.notificationCreated,
        { notification, unreadCount },
      );
    },
  );
}

/** Used by the status page to push service health live. */
export function broadcastStatus(
  { io }: RealtimeServer,
  payload: unknown,
): void {
  io.to('presence').emit('system.status', payload);
}
