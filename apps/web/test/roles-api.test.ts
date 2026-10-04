import { describe, expect, it } from 'vitest';
import * as roles from '../src/api/roles';
import { mockApi, reply } from './support/api';
import {
  adminUser,
  ids,
  member,
  organizationReservation,
  page,
  platformReservation,
} from './support/fixtures';

/**
 * The role screens' API client, against answers shaped like the API's
 * document. These are the mappings the screens draw from.
 */
describe('roles API client', () => {
  it('lists the platform administrators from GET /users, filtered server-side', async () => {
    const { calls } = mockApi({
      'GET /users': reply(
        'GET /users',
        200,
        page([
          adminUser({
            id: ids.primary,
            username: 'recovery',
            isPrimary: true,
            lastLoginAt: null,
          }),
          adminUser({
            emailVerifiedAt: null,
            profile: { displayName: '', avatarUrl: null, isOnline: false },
          }),
        ]),
      ),
    });
    const administrators = await roles.listPlatformAdministrators();
    expect(Object.fromEntries(calls[0]!.query)).toMatchObject({
      globalRole: 'GLOBAL_ADMIN',
      sort: 'createdAt',
      order: 'asc',
    });
    expect(administrators[0]).toMatchObject({
      id: ids.primary,
      isPrimary: true,
      lastLoginAt: null,
    });
    // No display name: the handle is shown. No verification: it says so.
    expect(administrators[1]).toMatchObject({
      displayName: 'ana',
      emailVerified: false,
      isPrimary: false,
    });
  });

  it('flattens the members of an organization for the table', async () => {
    mockApi({
      [`GET /organizations/${ids.organization}/members`]: reply(
        'GET /organizations/{organizationId}/members',
        200,
        [
          member({ role: 'ORG_ADMIN', isOnline: true }),
          member({ id: ids.agent, username: 'maya', displayName: null }),
        ],
      ),
    });
    const rows = await roles.listMembers(ids.organization);
    expect(rows[0]).toEqual({
      avatarUrl: null,
      displayName: 'John Lee',
      email: 'john@example.com',
      isOnline: true,
      joinedAt: '2026-10-04T09:30:00.000Z',
      role: 'ORG_ADMIN',
      userId: ids.member,
      username: 'john',
    });
    expect(rows[1]).toMatchObject({ userId: ids.agent, displayName: 'maya' });
  });

  it('normalises the address before sending it, and refuses one that is not', async () => {
    const { calls } = mockApi({
      'POST /admin/role-grants': reply('POST /admin/role-grants', 201, {
        outcome: 'RESERVED',
        email: 'new.admin@example.com',
        globalRole: 'GLOBAL_ADMIN',
        user: null,
        reservation: platformReservation(),
      }),
    });
    const result = await roles.assignPlatformRole({
      email: ' New.Admin@Example.com ',
      globalRole: 'GLOBAL_ADMIN',
    });
    expect(result.outcome).toBe('RESERVED');
    expect(calls[0]!.body).toEqual({
      email: 'new.admin@example.com',
      globalRole: 'GLOBAL_ADMIN',
    });

    expect(() =>
      roles.assignPlatformRole({
        email: 'not-an-address',
        globalRole: 'GLOBAL_ADMIN',
      }),
    ).toThrow();
    expect(calls).toHaveLength(1);
  });

  it('assigns, lists and cancels organization roles on the right URLs', async () => {
    const base = `/organizations/${ids.organization}/role-grants`;
    const { calls } = mockApi({
      [`POST ${base}`]: reply(
        'POST /organizations/{organizationId}/role-grants',
        200,
        {
          outcome: 'APPLIED',
          email: 'john@example.com',
          role: 'AGENT',
          user: { id: ids.member, username: 'john', displayName: 'John Lee' },
          reservation: null,
        },
      ),
      [`GET ${base}`]: reply(
        'GET /organizations/{organizationId}/role-grants',
        200,
        [organizationReservation()],
      ),
      [`DELETE ${base}/${ids.reservation}`]: reply(
        'DELETE /organizations/{organizationId}/role-grants/{grantId}',
        204,
      ),
    });
    await roles.assignOrganizationRole(ids.organization, {
      email: 'JOHN@example.com',
      role: 'AGENT',
    });
    expect(calls[0]!.body).toEqual({
      email: 'john@example.com',
      role: 'AGENT',
    });
    expect(
      await roles.listOrganizationReservations(ids.organization),
    ).toHaveLength(1);
    await roles.cancelOrganizationReservation(
      ids.organization,
      ids.reservation,
    );
    expect(calls.map((call) => call.method)).toEqual(['POST', 'GET', 'DELETE']);
  });

  it('takes the platform role back through PATCH /users/{id}/role', async () => {
    const { calls } = mockApi({
      [`PATCH /users/${ids.agent}/role`]: reply(
        'PATCH /users/{user}/role',
        200,
        {
          id: ids.agent,
          username: 'maya',
          globalRole: 'USER',
        },
      ),
    });
    await roles.withdrawPlatformRole(ids.agent);
    expect(calls[0]!.body).toEqual({ globalRole: 'USER' });
  });
});
