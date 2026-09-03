import type { SendMessageInput } from 'contracts';
import { prisma } from '../../database/prisma.ts';
import { DomainEvents, events } from '../../database/events.ts';
import { Errors } from '../../common/errors/domain-error.ts';
import { paginate } from '../../common/utils/pagination.ts';

const PUBLIC_USER = {
  id: true,
  username: true,
  profile: {
    select: {
      displayName: true,
      avatarUrl: true,
      isOnline: true,
      lastSeenAt: true,
    },
  },
} as const;

// ------------------------------------------------------------------------- friends --
export async function listFriends(userId: string) {
  const rows = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: {
      id: true,
      createdAt: true,
      requester: { select: PUBLIC_USER },
      addressee: { select: PUBLIC_USER },
    },
    orderBy: { updatedAt: 'desc' },
  });
  return rows.map((row) => ({
    friendshipId: row.id,
    since: row.createdAt,
    user: row.requester.id === userId ? row.addressee : row.requester,
  }));
}

export async function listRequests(userId: string) {
  const [incoming, outgoing] = await Promise.all([
    prisma.friendship.findMany({
      where: { addresseeId: userId, status: 'PENDING' },
      select: { id: true, createdAt: true, requester: { select: PUBLIC_USER } },
    }),
    prisma.friendship.findMany({
      where: { requesterId: userId, status: 'PENDING' },
      select: { id: true, createdAt: true, addressee: { select: PUBLIC_USER } },
    }),
  ]);
  return { incoming, outgoing };
}

export async function requestFriend(
  userId: string,
  target: { userId?: string; username?: string },
) {
  const other = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      ...(target.userId
        ? { id: target.userId }
        : { username: target.username }),
    },
    select: { id: true },
  });
  if (!other) throw Errors.resourceNotFound('user');
  if (other.id === userId) throw Errors.cannotFriendSelf();

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: other.id },
        { requesterId: other.id, addresseeId: userId },
      ],
    },
    select: { id: true, status: true },
  });
  if (existing && existing.status !== 'DECLINED')
    throw Errors.friendshipExists();

  return events.runInTransaction(async (tx) => {
    const friendship = existing
      ? await tx.friendship.update({
          where: { id: existing.id },
          data: {
            status: 'PENDING',
            requesterId: userId,
            addresseeId: other.id,
          },
          select: {
            id: true,
            status: true,
            requesterId: true,
            addresseeId: true,
          },
        })
      : await tx.friendship.create({
          data: { requesterId: userId, addresseeId: other.id },
          select: {
            id: true,
            status: true,
            requesterId: true,
            addresseeId: true,
          },
        });
    events.emit(DomainEvents.friendshipRequested, {
      friendship,
      actorId: userId,
      targetUserId: other.id,
    });
    return friendship;
  });
}

export async function respondRequest(
  userId: string,
  id: string,
  action: 'ACCEPT' | 'DECLINE',
) {
  const friendship = await prisma.friendship.findFirst({
    where: { id, addresseeId: userId, status: 'PENDING' },
    select: { id: true, requesterId: true },
  });
  if (!friendship) throw Errors.resourceNotFound('friendship');

  return events.runInTransaction(async (tx) => {
    const updated = await tx.friendship.update({
      where: { id },
      data: { status: action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED' },
      select: { id: true, status: true, requesterId: true, addresseeId: true },
    });
    if (action === 'ACCEPT') {
      events.emit(DomainEvents.friendshipAccepted, {
        friendship: updated,
        actorId: userId,
      });
    }
    return updated;
  });
}

export async function removeFriend(
  userId: string,
  otherUserId: string,
): Promise<void> {
  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: otherUserId },
        { requesterId: otherUserId, addresseeId: userId },
      ],
    },
    select: { id: true },
  });
  if (!friendship) throw Errors.resourceNotFound('friendship');
  await events.runInTransaction(async (tx) => {
    await tx.friendship.delete({ where: { id: friendship.id } });
    events.emit(DomainEvents.friendshipRemoved, {
      friendshipId: friendship.id,
      otherUserId,
      actorId: userId,
    });
  });
}

// ---------------------------------------------------------------------------- chat --
export async function listConversations(userId: string) {
  const rows = await prisma.conversation.findMany({
    where: { members: { some: { userId } } },
    orderBy: { lastMessageAt: 'desc' },
    take: 50,
    select: {
      id: true,
      lastMessageAt: true,
      members: {
        select: {
          userId: true,
          lastReadAt: true,
          user: { select: PUBLIC_USER },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { body: true, createdAt: true, senderId: true },
      },
    },
  });

  return Promise.all(
    rows.map(async (row) => {
      const me = row.members.find((m) => m.userId === userId);
      const other = row.members.find((m) => m.userId !== userId);
      const unread = await prisma.message.count({
        where: {
          conversationId: row.id,
          senderId: { not: userId },
          deletedAt: null,
          ...(me?.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}),
        },
      });
      return {
        id: row.id,
        lastMessageAt: row.lastMessageAt,
        participant: other?.user ?? null,
        lastMessage: row.messages[0] ?? null,
        unreadCount: unread,
      };
    }),
  );
}

/** Idempotent: opening a chat twice returns the same conversation. */
export async function openConversation(userId: string, otherUserId: string) {
  if (userId === otherUserId) throw Errors.cannotFriendSelf();
  const other = await prisma.user.findFirst({
    where: { id: otherUserId, deletedAt: null },
    select: { id: true },
  });
  if (!other) throw Errors.resourceNotFound('user');

  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { members: { some: { userId } } },
        { members: { some: { userId: otherUserId } } },
      ],
    },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.conversation.create({
    data: { members: { create: [{ userId }, { userId: otherUserId }] } },
    select: { id: true },
  });
}

async function assertMember(
  conversationId: string,
  userId: string,
): Promise<void> {
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { userId: true },
  });
  if (!member) throw Errors.resourceNotFound('conversation');
}

export async function listMessages(
  userId: string,
  conversationId: string,
  page: number,
  take: number,
) {
  await assertMember(conversationId, userId);
  const where = { conversationId, deletedAt: null };
  const [rows, total] = await Promise.all([
    prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * take,
      take,
      select: {
        id: true,
        body: true,
        createdAt: true,
        editedAt: true,
        sender: { select: PUBLIC_USER },
      },
    }),
    prisma.message.count({ where }),
  ]);
  return paginate(rows.reverse(), total, page, take);
}

export async function sendMessage(
  userId: string,
  conversationId: string,
  input: SendMessageInput,
) {
  await assertMember(conversationId, userId);
  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });

  return events.runInTransaction(async (tx) => {
    const message = await tx.message.create({
      data: { conversationId, senderId: userId, body: input.body },
      select: {
        id: true,
        body: true,
        createdAt: true,
        conversationId: true,
        sender: { select: PUBLIC_USER },
      },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });
    events.emit(DomainEvents.messageCreated, {
      message,
      recipientIds: members.map((m) => m.userId),
      actorId: userId,
    });
    return message;
  });
}

/**
 * Moves the caller's read marker in a conversation.
 *
 * With no `messageId` the whole conversation is marked read - the previous
 * behaviour, and still the default. With one, the marker moves to that
 * message's timestamp: the case `markReadSchema` in `packages/contracts`
 * describes and that nothing implemented, so a client that had scrolled
 * through only part of the backlog could pick between "everything read" and
 * "nothing read" and nothing in between.
 *
 * The marker never moves backwards, so a late acknowledgement from a second
 * tab cannot resurrect messages the user has already seen.
 */
export async function markRead(
  userId: string,
  conversationId: string,
  messageId?: string,
): Promise<{ lastReadAt: Date }> {
  await assertMember(conversationId, userId);

  let lastReadAt = new Date();
  if (messageId) {
    const message = await prisma.message.findFirst({
      // Scoped to the conversation on purpose: an id borrowed from another
      // conversation must not be usable to probe or to move anything here.
      where: { id: messageId, conversationId },
      select: { createdAt: true },
    });
    if (!message) throw Errors.resourceNotFound('message');
    lastReadAt = message.createdAt;
  }

  const current = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { lastReadAt: true },
  });
  if (current?.lastReadAt && current.lastReadAt >= lastReadAt) {
    return { lastReadAt: current.lastReadAt };
  }

  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt },
  });
  events.emit(DomainEvents.messageRead, { conversationId, userId, lastReadAt });
  return { lastReadAt };
}
