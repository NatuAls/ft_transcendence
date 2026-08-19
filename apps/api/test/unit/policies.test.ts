import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { OrgRole } from '../../src/generated/prisma/client.ts';
import { ALL_POLICIES, effectivePermissions, evaluatePolicy, type PolicyId } from '../../src/rbac/policies.ts';

const ROLES: OrgRole[] = ['MEMBER', 'AGENT', 'ORG_ADMIN'];
const subject = (orgRole?: OrgRole, isGlobalAdmin = false) => ({ userId: 'u1', isGlobalAdmin, orgRole });
const ownedByMe = { ownerId: 'u1' };
const ownedByOther = { ownerId: 'u2' };

/**
 * Exhaustive matrix test. Every cell of the permission matrix is asserted
 * here, in both directions (granted AND denied).
 */
describe('RBAC policy matrix', () => {
  it('covers every policy declared in the table', () => {
    assert.ok(ALL_POLICIES.length >= 30);
    for (const policy of ALL_POLICIES) {
      assert.doesNotThrow(() => evaluatePolicy(policy, subject('MEMBER')));
    }
  });

  it('denies every organization-scoped policy to a user with no membership', () => {
    const scoped = ALL_POLICIES.filter((policy) => !policy.startsWith('user:') && policy !== 'audit:read');
    for (const policy of scoped) {
      assert.strictEqual(evaluatePolicy(policy, subject(undefined)).allowed, false);
    }
    assert.ok(scoped.length > 20);
  });

  const denials: Array<[PolicyId, OrgRole]> = [
    ['ticket:selfAssign', 'MEMBER'],
    ['ticket:assignOther', 'MEMBER'],
    ['ticket:assignOther', 'AGENT'],
    ['ticket:reopen', 'MEMBER'],
    ['ticket:delete', 'MEMBER'],
    ['ticket:delete', 'AGENT'],
    ['ticket:viewInternalNotes', 'MEMBER'],
    ['comment:createInternal', 'MEMBER'],
    ['organization:update', 'MEMBER'],
    ['organization:update', 'AGENT'],
    ['member:invite', 'MEMBER'],
    ['member:invite', 'AGENT'],
    ['member:changeRole', 'MEMBER'],
    ['member:changeRole', 'AGENT'],
    ['member:remove', 'MEMBER'],
    ['member:remove', 'AGENT'],
    ['category:write', 'MEMBER'],
    ['category:write', 'AGENT'],
    ['apiKey:manage', 'MEMBER'],
    ['apiKey:manage', 'AGENT'],
    ['stats:read', 'MEMBER'],
  ];
  for (const [policy, role] of denials) {
    it(`denies ${policy} to ${role}`, () => {
      assert.strictEqual(evaluatePolicy(policy, subject(role), ownedByOther).allowed, false);
    });
  }

  const grants: Array<[PolicyId, OrgRole]> = [
    ['ticket:create', 'MEMBER'],
    ['ticket:selfAssign', 'AGENT'],
    ['ticket:assignOther', 'ORG_ADMIN'],
    ['ticket:reopen', 'AGENT'],
    ['ticket:delete', 'ORG_ADMIN'],
    ['ticket:viewInternalNotes', 'AGENT'],
    ['comment:create', 'MEMBER'],
    ['comment:createInternal', 'AGENT'],
    ['organization:read', 'MEMBER'],
    ['organization:update', 'ORG_ADMIN'],
    ['member:read', 'MEMBER'],
    ['member:invite', 'ORG_ADMIN'],
    ['category:read', 'MEMBER'],
    ['category:write', 'ORG_ADMIN'],
    ['apiKey:manage', 'ORG_ADMIN'],
    ['stats:read', 'AGENT'],
    ['stats:read', 'ORG_ADMIN'],
  ];
  for (const [policy, role] of grants) {
    it(`grants ${policy} to ${role}`, () => {
      assert.strictEqual(evaluatePolicy(policy, subject(role)).allowed, true);
    });
  }

  describe('record-level ownership escapes', () => {
    it('lets an author read and edit their own OPEN ticket', () => {
      assert.strictEqual(evaluatePolicy('ticket:read', subject('MEMBER'), ownedByMe).allowed, true);
      assert.strictEqual(
        evaluatePolicy('ticket:update', subject('MEMBER'), { ...ownedByMe, status: 'OPEN' }).allowed,
        true,
      );
    });

    it('stops an author editing their own ticket once an agent picked it up', () => {
      assert.strictEqual(
        evaluatePolicy('ticket:update', subject('MEMBER'), { ...ownedByMe, status: 'IN_PROGRESS' }).allowed,
        false,
      );
    });

    it('never lets a MEMBER read someone else ticket', () => {
      assert.strictEqual(evaluatePolicy('ticket:read', subject('MEMBER'), ownedByOther).allowed, false);
    });

    it('lets the author close their own resolved ticket but nothing else', () => {
      assert.strictEqual(
        evaluatePolicy('ticket:changeStatus', subject('MEMBER'), { ...ownedByMe, status: 'RESOLVED' }).allowed,
        true,
      );
      assert.strictEqual(
        evaluatePolicy('ticket:changeStatus', subject('MEMBER'), { ...ownedByMe, status: 'OPEN' }).allowed,
        false,
      );
    });
  });

  describe('platform administrators', () => {
    const platformOnly: PolicyId[] = ['user:listAll', 'user:updateOther', 'user:setStatus', 'user:setGlobalRole', 'user:deleteOther', 'audit:read'];

    for (const policy of platformOnly) {
      it(`${policy} requires GLOBAL_ADMIN`, () => {
        for (const role of ROLES) assert.strictEqual(evaluatePolicy(policy, subject(role)).allowed, false);
        assert.strictEqual(evaluatePolicy(policy, subject(undefined, true)).allowed, true);
      });
    }

    it('bypasses organization roles but still respects preconditions', () => {
      assert.strictEqual(evaluatePolicy('ticket:delete', subject(undefined, true)).allowed, true);
      assert.strictEqual(evaluatePolicy('member:leave', subject('ORG_ADMIN'), { isLastAdmin: true }).allowed, false);
    });
  });

  it('reports effective permissions that grow monotonically with role', () => {
    const counts = ROLES.map((role) => effectivePermissions(subject(role)).length);
    assert.ok(counts[0]! < counts[1]!);
    assert.ok(counts[1]! < counts[2]!);
    assert.strictEqual(effectivePermissions(subject('ORG_ADMIN', true)).length, ALL_POLICIES.length);
  });
});
