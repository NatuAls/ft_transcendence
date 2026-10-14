import { ACCOUNT_ERASURE_GRACE_DAYS } from 'contracts';
import { prisma } from '../../database/prisma.ts';
import { createLogger } from '../../common/logger.ts';
import { record } from '../audit/audit.service.ts';
import { erase, pruneExpiredExports } from '../gdpr/gdpr.service.ts';
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

/**
 * How long the audit trail keeps an entry: a year, long enough to answer for
 * what was done on the platform and no longer. The privacy policy says so.
 */
export const AUDIT_RETENTION_DAYS = 365;

/**
 * Expired sessions, used one-time tokens, stale GDPR artefacts — the archive
 * of an export whose download window has closed included — and audit entries
 * older than `AUDIT_RETENTION_DAYS`.
 */
export async function pruneExpired(now = new Date()): Promise<void> {
  const auditCutoff = new Date(
    now.getTime() - AUDIT_RETENTION_DAYS * 86_400_000,
  );
  const [sessions, tokens, requests, audit] = await Promise.all([
    prisma.userSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.verificationToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.gdprRequest.updateMany({
      where: { status: 'AWAITING_CONFIRMATION', expiresAt: { lt: now } },
      data: { status: 'EXPIRED' },
    }),
    prisma.auditLog.deleteMany({ where: { createdAt: { lt: auditCutoff } } }),
  ]);
  const exports = await pruneExpiredExports();
  logger.info(
    `pruned ${sessions.count} sessions, ${tokens.count} tokens, expired ${requests.count} GDPR requests, removed ${exports} export archives and ${audit.count} audit entries`,
  );
}

/**
 * Accounts an administrator closed lose their personal data when their grace
 * period ends. Every hour, so the date the screen announced holds to within
 * the hour. Returns how many were erased.
 */
export async function eraseClosedAccounts(now = new Date()): Promise<number> {
  const cutoff = new Date(
    now.getTime() - ACCOUNT_ERASURE_GRACE_DAYS * 86_400_000,
  );
  const due = await prisma.user.findMany({
    where: { deletedAt: { lte: cutoff }, erasedAt: null },
    select: { id: true },
    take: 100,
  });
  for (const { id } of due) {
    await erase(id);
    // Nobody did it: the system did, on the date it had announced.
    await record({
      actor: null,
      action: 'user.erased',
      entity: 'User',
      entityId: id,
      after: { by: 'grace period' },
    });
  }
  if (due.length) logger.info(`erased ${due.length} closed accounts`);
  return due.length;
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
  everyHour(async () => {
    await eraseClosedAccounts();
  });
  dailyAt(3, () => pruneExpired());
}
