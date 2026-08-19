import { prisma } from '../../database/prisma.ts';
import { createLogger } from '../../common/logger.ts';
import { AUTO_CLOSE_AFTER_MS } from './domain/state-machine.ts';

const logger = createLogger('maintenance');

/** Resolved tickets nobody confirmed close themselves after 7 days. */
async function autoCloseResolvedTickets(): Promise<void> {
  const cutoff = new Date(Date.now() - AUTO_CLOSE_AFTER_MS);
  const stale = await prisma.ticket.findMany({
    where: { status: 'RESOLVED', resolvedAt: { lt: cutoff } },
    select: { id: true, organizationId: true, createdById: true },
    take: 200,
  });
  if (stale.length === 0) return;

  for (const ticket of stale) {
    await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'CLOSED', closedAt: new Date() },
      }),
      prisma.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          changedById: ticket.createdById,
          field: 'status',
          oldValue: 'RESOLVED',
          newValue: 'CLOSED',
          note: 'Automatically closed after 7 days without confirmation',
        },
      }),
    ]);
  }
  logger.info(`auto-closed ${stale.length} resolved tickets`);
}

/** Expired sessions, used one-time tokens and stale GDPR artefacts. */
async function pruneExpired(): Promise<void> {
  const now = new Date();
  const [sessions, tokens, requests] = await Promise.all([
    prisma.userSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.verificationToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.gdprRequest.updateMany({
      where: { status: 'AWAITING_CONFIRMATION', expiresAt: { lt: now } },
      data: { status: 'EXPIRED' },
    }),
  ]);
  logger.info(
    `pruned ${sessions.count} sessions, ${tokens.count} tokens, expired ${requests.count} GDPR requests`,
  );
}

function everyHour(fn: () => Promise<void>): void {
  const HOUR_MS = 3_600_000;
  setInterval(
    () =>
      void fn().catch((error: unknown) =>
        logger.error('hourly job failed', error),
      ),
    HOUR_MS,
  );
}

function dailyAt(hour: number, fn: () => Promise<void>): void {
  const DAY_MS = 86_400_000;
  const schedule = () => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
    setTimeout(() => {
      void fn().catch((error: unknown) =>
        logger.error('daily job failed', error),
      );
      setInterval(
        () =>
          void fn().catch((error: unknown) =>
            logger.error('daily job failed', error),
          ),
        DAY_MS,
      );
    }, next.getTime() - now.getTime());
  };
  schedule();
}

/** Wires the scheduled housekeeping jobs. Call once at boot. */
export function startMaintenanceJobs(): void {
  everyHour(autoCloseResolvedTickets);
  dailyAt(3, pruneExpired);
}
