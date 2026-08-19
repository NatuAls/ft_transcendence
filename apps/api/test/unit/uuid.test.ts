import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isUuid, uuidv7 } from '../../src/common/utils/uuid.ts';
import {
  decodeCursor,
  encodeCursor,
  paginate,
  MAX_TAKE,
} from '../../src/common/utils/pagination.ts';

describe('uuid v7', () => {
  it('produces valid, version-7, time-ordered identifiers', () => {
    const ids = Array.from({ length: 50 }, () => uuidv7());
    for (const id of ids) {
      assert.strictEqual(isUuid(id), true);
      assert.strictEqual(id[14], '7');
    }
    assert.strictEqual(new Set(ids).size, ids.length);
    // The 48-bit timestamp prefix is non-decreasing, which is what gives v7 its
    // index locality. The random tail inside one millisecond is not ordered.
    const stamps = ids.map((id) => id.slice(0, 13));
    assert.deepStrictEqual([...stamps].sort(), stamps);
  });
});

describe('pagination', () => {
  it('never exceeds the hard page cap', () => {
    assert.strictEqual(paginate([], 0, 1, 5000).meta.take, MAX_TAKE);
  });

  it('round-trips a cursor', () => {
    const value = {
      createdAt: new Date('2026-08-17T10:00:00.000Z'),
      id: 'abc',
    };
    const decoded = decodeCursor(encodeCursor(value));
    assert.strictEqual(decoded?.id, 'abc');
    assert.strictEqual(
      decoded?.createdAt.toISOString(),
      value.createdAt.toISOString(),
    );
  });

  it('returns null for a malformed cursor instead of throwing', () => {
    assert.strictEqual(decodeCursor('not-a-cursor'), null);
    assert.strictEqual(decodeCursor(''), null);
  });
});
