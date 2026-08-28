import {
  canTransition,
  TICKET_TRANSITIONS,
  type TicketStatus,
} from 'contracts';
import { Errors } from '../../../common/errors/domain-error.ts';

/**
 * Ticket lifecycle - the heart of the domain. Pure functions, no database, no
 * HTTP: exhaustively unit-testable, and the same rules apply to the web app
 * and the public API because both go through the service that calls this.
 *
 *   OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED
 *   RESOLVED -> IN_PROGRESS   (author rejects the fix)
 *   CLOSED   -> IN_PROGRESS   (agent reopens)
 *   OPEN     -> CLOSED        (org admin discards)
 */
export { TICKET_TRANSITIONS, canTransition };

export function assertTransition(from: TicketStatus, to: TicketStatus): void {
  if (from === to) {
    throw Errors.invalidTransition(from, to);
  }
  if (!canTransition(from, to)) {
    throw Errors.invalidTransition(from, to);
  }
}

/** Timestamps that a transition must stamp on the row. */
export function timestampsFor(to: TicketStatus): Record<string, Date | null> {
  switch (to) {
    case 'IN_PROGRESS':
      return { resolvedAt: null, closedAt: null };
    case 'RESOLVED':
      return { resolvedAt: new Date(), closedAt: null };
    case 'CLOSED':
      return { closedAt: new Date() };
    default:
      return {};
  }
}

/** A ticket that has been resolved for 7 days closes itself. */
export const AUTO_CLOSE_AFTER_MS = 7 * 24 * 3600 * 1000;

export function shouldAutoClose(
  status: TicketStatus,
  resolvedAt: Date | null,
  now = new Date(),
): boolean {
  return (
    status === 'RESOLVED' &&
    resolvedAt !== null &&
    now.getTime() - resolvedAt.getTime() >= AUTO_CLOSE_AFTER_MS
  );
}

/** ACME-0042 style reference, unique inside an organization. */
export function buildReference(orgSlug: string, sequence: number): string {
  const prefix =
    orgSlug
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 6)
      .toUpperCase() || 'HD';
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}
