import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TICKET_TRANSITIONS, canTransition, type TicketStatus } from 'contracts';
import { assertTransition, buildReference, shouldAutoClose, timestampsFor } from '../../src/modules/tickets/domain/state-machine.ts';

const ALL: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

describe('ticket state machine', () => {
  it('accepts exactly the 6 transitions declared in the design document', () => {
    const allowed = ALL.flatMap((from) => TICKET_TRANSITIONS[from].map((to) => `${from}->${to}`));
    assert.deepStrictEqual(
      allowed.sort(),
      ['OPEN->IN_PROGRESS', 'OPEN->CLOSED', 'IN_PROGRESS->RESOLVED', 'RESOLVED->CLOSED', 'RESOLVED->IN_PROGRESS', 'CLOSED->IN_PROGRESS'].sort(),
    );
  });

  for (const from of ALL) {
    for (const to of ALL) {
      it(`is consistent for ${from} -> ${to}`, () => {
        const legal = from !== to && canTransition(from, to);
        if (legal) assert.doesNotThrow(() => assertTransition(from, to));
        else assert.throws(() => assertTransition(from, to));
      });
    }
  }

  it('rejects a no-op transition', () => {
    for (const status of ALL) assert.throws(() => assertTransition(status, status));
  });

  it('stamps resolvedAt when resolving and clears it when reopening', () => {
    assert.ok(timestampsFor('RESOLVED')['resolvedAt'] instanceof Date);
    assert.strictEqual(timestampsFor('IN_PROGRESS')['resolvedAt'], null);
    assert.ok(timestampsFor('CLOSED')['closedAt'] instanceof Date);
  });

  it('auto-closes a resolved ticket only after 7 full days', () => {
    const now = new Date('2026-08-17T12:00:00Z');
    const sixDays = new Date(now.getTime() - 6 * 86_400_000);
    const eightDays = new Date(now.getTime() - 8 * 86_400_000);
    assert.strictEqual(shouldAutoClose('RESOLVED', sixDays, now), false);
    assert.strictEqual(shouldAutoClose('RESOLVED', eightDays, now), true);
    assert.strictEqual(shouldAutoClose('OPEN', eightDays, now), false);
    assert.strictEqual(shouldAutoClose('RESOLVED', null, now), false);
  });

  it('builds a readable, zero-padded, per-organization reference', () => {
    assert.strictEqual(buildReference('acme', 42), 'ACME-0042');
    assert.strictEqual(buildReference('globex-industries', 7), 'GLOBEX-0007');
    assert.strictEqual(buildReference('', 1), 'HD-0001');
  });
});
