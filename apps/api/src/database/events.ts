import { EventEmitter } from 'node:events';
import { AsyncLocalStorage } from 'node:async_hooks';
import { prisma } from './prisma.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { createLogger } from '../common/logger.ts';

const logger = createLogger('events');

export interface DomainEvent<P = unknown> {
  name: string;
  payload: P;
}

interface TxContext {
  events: DomainEvent[];
}

/**
 * Emits domain events only AFTER the database transaction has committed.
 *
 * Why it matters: if you emit inside the transaction and the transaction then
 * rolls back, every connected client has been told about a change that never
 * happened. Events are buffered in AsyncLocalStorage for the duration of the
 * transaction and flushed on commit; on rollback they are simply dropped.
 */
class TransactionalEventEmitter {
  private readonly bus = new EventEmitter({ captureRejections: true });
  private readonly storage = new AsyncLocalStorage<TxContext>();

  constructor() {
    this.bus.setMaxListeners(50);
    this.bus.on('error', (error) => logger.error('event handler failed', error));
  }

  on<P>(name: string, handler: (payload: P) => void | Promise<void>): void {
    this.bus.on(name, (payload: P) => {
      void Promise.resolve(handler(payload)).catch((error: unknown) =>
        logger.error(`handler for ${name} failed`, error),
      );
    });
  }

  /** Inside a `runInTransaction` block this buffers; outside it emits immediately. */
  emit<P>(name: string, payload: P): void {
    const ctx = this.storage.getStore();
    if (ctx) {
      ctx.events.push({ name, payload });
      return;
    }
    this.bus.emit(name, payload);
  }

  /**
   * Run `work` in a database transaction. Any event emitted inside is
   * published once, after a successful commit.
   */
  async runInTransaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { timeout?: number; maxWait?: number },
  ): Promise<T> {
    const ctx: TxContext = { events: [] };
    const result = await this.storage.run(ctx, () =>
      prisma.$transaction((tx: Prisma.TransactionClient) => work(tx), {
        timeout: options?.timeout ?? 10_000,
        maxWait: options?.maxWait ?? 5_000,
      }),
    );
    for (const event of ctx.events) {
      this.bus.emit(event.name, event.payload);
    }
    return result;
  }
}

export const events = new TransactionalEventEmitter();

/** Canonical event names. Realtime bridge and notifications both listen here. */
export const DomainEvents = {
  ticketCreated: 'ticket.created',
  ticketUpdated: 'ticket.updated',
  ticketDeleted: 'ticket.deleted',
  commentCreated: 'comment.created',
  commentUpdated: 'comment.updated',
  commentDeleted: 'comment.deleted',
  attachmentCreated: 'attachment.created',
  attachmentDeleted: 'attachment.deleted',
  organizationCreated: 'organization.created',
  organizationUpdated: 'organization.updated',
  organizationDeleted: 'organization.deleted',
  memberAdded: 'member.added',
  memberUpdated: 'member.updated',
  memberRemoved: 'member.removed',
  categoryCreated: 'category.created',
  categoryUpdated: 'category.updated',
  categoryDeleted: 'category.deleted',
  friendshipRequested: 'friendship.requested',
  friendshipAccepted: 'friendship.accepted',
  friendshipRemoved: 'friendship.removed',
  messageCreated: 'message.created',
  messageRead: 'message.read',
  accountCreated: 'account.created',
  accountUpdated: 'account.updated',
  accountDeleted: 'account.deleted',
  notificationCreated: 'notification.created',
  presenceChanged: 'presence.changed',
} as const;
