import type { Socket } from 'socket.io';
import type { SocketUser } from '../realtime/socket-server.ts';
import { prisma } from '../../database/prisma.ts';

export interface ChatSocketBody {
  conversationId?: string;
}

/**
 * Registers the chat-only Socket.IO protocol on an already authenticated
 * realtime socket. Authorization is checked before joining every room.
 */
export function registerChatSocketHandlers(
  client: Socket,
  getUser: () => SocketUser | undefined,
): void {
  client.on(
    'conversation.subscribe',
    (body: ChatSocketBody, ack?: (result: { ok: boolean }) => void) => {
      void (async () => {
        const user = getUser();
        if (!user || !body?.conversationId) return ack?.({ ok: false });

        const member = await prisma.conversationMember.findUnique({
          where: {
            conversationId_userId: {
              conversationId: body.conversationId,
              userId: user.id,
            },
          },
          select: { userId: true },
        });

        if (!member) return ack?.({ ok: false });
        await client.join(`conv:${body.conversationId}`);
        ack?.({ ok: true });
      })().catch(() => ack?.({ ok: false }));
    },
  );

  client.on(
    'conversation.unsubscribe',
    (body: ChatSocketBody, ack?: (result: { ok: true }) => void) => {
      void (async () => {
        if (body?.conversationId) {
          await client.leave(`conv:${body.conversationId}`);
        }
        ack?.({ ok: true });
      })();
    },
  );
}
