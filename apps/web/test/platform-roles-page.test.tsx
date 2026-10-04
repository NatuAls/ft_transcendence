import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { PlatformRolesPage } from '../src/features/roles/PlatformRolesPage';
import { mockApi, reply } from './support/api';
import { adminUser, ids, page, platformReservation } from './support/fixtures';

const administrators = [
  adminUser({
    id: ids.primary,
    username: 'recovery',
    email: 'recovery@helpdesk.example',
    isPrimary: true,
    profile: { displayName: 'Recovery', avatarUrl: null, isOnline: false },
  }),
  adminUser(),
  adminUser({
    id: ids.agent,
    username: 'maya',
    email: 'maya@example.com',
    emailVerifiedAt: null,
    profile: { displayName: 'Maya Singh', avatarUrl: null, isOnline: false },
  }),
];

function api(extra: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    'GET /users': reply('GET /users', 200, page(administrators)),
    'GET /admin/role-grants': reply('GET /admin/role-grants', 200, [
      platformReservation(),
    ]),
    ...extra,
  });
}

describe('Platform roles', () => {
  it('protects the primary administrator and your own role', async () => {
    api();
    render(<PlatformRolesPage currentUserId={ids.admin} />);
    expect(await screen.findByText('Primary · protected')).toBeTruthy();
    expect(screen.getByText('Your own role')).toBeTruthy();
    expect(screen.getByText('Protected')).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: /Withdraw platform administration from Recovery/,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: /Withdraw platform administration from Ana/,
      }),
    ).toBeNull();
    expect(
      screen.getByRole('button', {
        name: 'Withdraw platform administration from Maya Singh',
      }),
    ).toBeTruthy();
    expect(screen.getByText('Address not confirmed')).toBeTruthy();
    expect(screen.getByText('new.admin@example.com')).toBeTruthy();
  });

  it('reserves the role for an address without an account', async () => {
    const { calls } = api({
      'POST /admin/role-grants': reply('POST /admin/role-grants', 201, {
        outcome: 'RESERVED',
        email: 'someone@example.com',
        globalRole: 'GLOBAL_ADMIN',
        user: null,
        reservation: platformReservation({ email: 'someone@example.com' }),
      }),
    });
    render(<PlatformRolesPage currentUserId={ids.admin} />);
    await screen.findByText('Primary · protected');
    fireEvent.change(screen.getByLabelText(/E-mail address/), {
      target: { value: 'Someone@Example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Assign role' }));
    expect(
      await screen.findByText(
        /Reserved for someone@example\.com\. Nobody has registered that address yet/,
      ),
    ).toBeTruthy();
    expect(calls.find((call) => call.method === 'POST')!.body).toEqual({
      email: 'someone@example.com',
      globalRole: 'GLOBAL_ADMIN',
    });
  });

  it('takes the role back after confirming', async () => {
    const { calls } = api({
      [`PATCH /users/${ids.agent}/role`]: reply(
        'PATCH /users/{user}/role',
        200,
        { id: ids.agent, username: 'maya', globalRole: 'USER' },
      ),
    });
    render(<PlatformRolesPage currentUserId={ids.admin} />);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Withdraw platform administration from Maya Singh',
      }),
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Withdraw administration' }),
    );
    expect(
      await screen.findByText(
        'Maya Singh is a standard user again. Their account and organization roles are untouched.',
      ),
    ).toBeTruthy();
    expect(calls.find((call) => call.method === 'PATCH')!.body).toEqual({
      globalRole: 'USER',
    });
  });

  it('cancels a reservation', async () => {
    api({
      [`DELETE /admin/role-grants/${ids.reservation}`]: reply(
        'DELETE /admin/role-grants/{grantId}',
        204,
      ),
    });
    render(<PlatformRolesPage currentUserId={ids.admin} />);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Cancel the reservation for new.admin@example.com',
      }),
    );
    expect(
      await screen.findByText(
        /The reservation for new.admin@example.com was cancelled/,
      ),
    ).toBeTruthy();
  });
});
