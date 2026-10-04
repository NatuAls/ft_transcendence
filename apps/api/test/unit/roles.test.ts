import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  adminUpdateUserSchema,
  assignOrganizationRoleSchema,
  assignPlatformRoleSchema,
  listUsersQuerySchema,
} from 'contracts';
import { roleReservedTemplate } from '../../src/modules/mail/templates.ts';
import { originOf, param } from '../../src/common/utils/http.ts';

/**
 * The pieces of the role assignment by e-mail that run without a database:
 * the contracts both ends validate with, the e-mail that tells the person a
 * role is waiting, and the origin its link is built from.
 */
describe('roles by e-mail · contracts', () => {
  it('normalises the address, so the link matches whatever case was typed', () => {
    const parsed = assignPlatformRoleSchema.parse({
      email: '  Ana.Admin@Example.COM ',
      globalRole: 'GLOBAL_ADMIN',
    });
    assert.equal(parsed.email, 'ana.admin@example.com');
    assert.equal(
      assignOrganizationRoleSchema.parse({ email: 'X@Y.io', role: 'AGENT' })
        .email,
      'x@y.io',
    );
  });

  it('only grants GLOBAL_ADMIN by e-mail: demoting is PATCH /users/{id}/role', () => {
    for (const globalRole of ['USER', 'ORG_ADMIN', 'ROOT', undefined])
      assert.equal(
        assignPlatformRoleSchema.safeParse({ email: 'a@b.io', globalRole })
          .success,
        false,
        `${String(globalRole)} must be refused`,
      );
  });

  it('accepts the three organization roles and nothing else', () => {
    for (const role of ['MEMBER', 'AGENT', 'ORG_ADMIN'])
      assert.ok(
        assignOrganizationRoleSchema.safeParse({ email: 'a@b.io', role })
          .success,
      );
    for (const role of ['GLOBAL_ADMIN', 'OWNER', ''])
      assert.equal(
        assignOrganizationRoleSchema.safeParse({ email: 'a@b.io', role })
          .success,
        false,
      );
  });

  it('refuses something that is not an e-mail address', () => {
    for (const email of ['', 'ana', 'ana@', '@example.com', 'a b@c.io'])
      assert.equal(
        assignOrganizationRoleSchema.safeParse({ email, role: 'MEMBER' })
          .success,
        false,
        `"${email}" must be refused`,
      );
  });

  it('lets an administrator correct a name, never suspend through the edit', () => {
    const parsed = adminUpdateUserSchema.parse({
      firstName: ' Lucía ',
      isActive: false,
      globalRole: 'GLOBAL_ADMIN',
    });
    assert.deepEqual(parsed, { firstName: 'Lucía' });
  });

  it('lists users newest first by default and only sorts by known columns', () => {
    const defaults = listUsersQuerySchema.parse({});
    assert.equal(defaults.sort, 'createdAt');
    assert.equal(defaults.order, 'desc');
    assert.equal(
      listUsersQuerySchema.parse({
        globalRole: 'GLOBAL_ADMIN',
        isActive: 'false',
      }).isActive,
      false,
    );
    for (const query of [
      { sort: 'passwordHash' },
      { order: 'up' },
      { globalRole: 'ROOT' },
    ])
      assert.equal(listUsersQuerySchema.safeParse(query).success, false);
  });
});

describe('roles by e-mail · the e-mail', () => {
  const base = {
    roleLabel: 'Agent',
    scopeLabel: 'Acme Support',
    grantor: 'ana',
    hasAccount: false,
    url: 'https://helpdesk.example/#register?email=new%40example.com',
  };

  it('tells somebody without an account to create one with this address', () => {
    const mail = roleReservedTemplate(base);
    assert.match(mail.subject, /role is waiting/);
    assert.match(mail.html, /Create my account/);
    assert.match(
      mail.html,
      /create your HelpDesk Lite account with this same address/,
    );
    assert.match(mail.text, /#register\?email=new%40example\.com/);
  });

  it('tells somebody with an unconfirmed account to confirm it', () => {
    const mail = roleReservedTemplate({
      ...base,
      hasAccount: true,
      url: 'https://helpdesk.example/#login',
    });
    assert.match(mail.html, />Sign in</);
    assert.match(mail.html, /has not been confirmed yet/);
    assert.doesNotMatch(mail.html, /Create my account/);
  });

  it('says nothing changes until the address is verified', () => {
    assert.match(
      roleReservedTemplate(base).html,
      /nothing changes until an account with this address is verified/,
    );
  });

  it('escapes every value it did not write itself', () => {
    const mail = roleReservedTemplate({
      ...base,
      scopeLabel: '<img src=x onerror=alert(1)>',
      grantor: '"><script>alert(1)</script>',
      url: 'https://evil.example/"><script>alert(2)</script>',
    });
    assert.doesNotMatch(mail.html, /<script>|<img/);
    assert.match(mail.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(mail.html, /href="https:\/\/evil\.example\/&quot;&gt;/);
  });
});

describe('roles by e-mail · the link origin', () => {
  const request = (headers: Record<string, string>) =>
    ({ headers }) as unknown as Parameters<typeof originOf>[0];

  it('follows the proxy headers, which is where TLS ends', () => {
    assert.equal(
      originOf(
        request({
          host: 'api:5000',
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'helpdesk.example',
        }),
      ),
      'https://helpdesk.example',
    );
  });

  it('falls back to the Host header, and to https', () => {
    assert.equal(
      originOf(request({ host: 'localhost:5173' })),
      'https://localhost:5173',
    );
    assert.equal(
      originOf(
        request({ host: 'localhost:5173', 'x-forwarded-proto': 'http' }),
      ),
      'http://localhost:5173',
    );
    assert.equal(originOf(request({})), 'https://localhost');
  });

  it('takes the single value of a route parameter', () => {
    assert.equal(param('abc'), 'abc');
    assert.equal(param(['first', 'second']), 'first');
  });
});
