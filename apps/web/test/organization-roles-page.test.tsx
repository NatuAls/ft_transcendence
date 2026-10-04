import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { OrganizationRolesPage } from '../src/features/roles/OrganizationRolesPage';
import { apiError, mockApi, reply, type Call } from './support/api';
import { ids, member, organizationReservation } from './support/fixtures';

/**
 * "Roles & access" at organization level: one route, three screens, because
 * the role decides what there is to do. Every answer is checked against the
 * API document before the screen sees it.
 */
const base = `/organizations/${ids.organization}`;
const members = [
  member({
    id: ids.admin,
    role: 'ORG_ADMIN',
    username: 'ana',
    email: 'ana@example.com',
    displayName: 'Ana García',
    isOnline: true,
  }),
  member({
    id: ids.agent,
    role: 'AGENT',
    username: 'maya',
    email: 'maya@example.com',
    displayName: 'Maya Singh',
  }),
  member({ id: ids.member, role: 'MEMBER' }),
];

function api(
  extra: Record<
    string,
    ReturnType<typeof reply> | ((call: Call) => ReturnType<typeof reply>)
  > = {},
) {
  return mockApi({
    [`GET ${base}/members`]: reply(
      'GET /organizations/{organizationId}/members',
      200,
      members,
    ),
    [`GET ${base}/role-grants`]: reply(
      'GET /organizations/{organizationId}/role-grants',
      200,
      [
        organizationReservation({
          email: 'carlos@example.com',
          role: 'MEMBER',
          waitingFor: 'VERIFICATION',
        }),
      ],
    ),
    ...extra,
  });
}

function renderAs(
  viewerRole: 'ORG_ADMIN' | 'AGENT' | 'MEMBER' | 'GLOBAL_ADMIN',
  currentUserId = ids.admin,
) {
  const onAccessChanged = vi.fn();
  render(
    <OrganizationRolesPage
      canManage={viewerRole === 'ORG_ADMIN' || viewerRole === 'GLOBAL_ADMIN'}
      currentUserId={currentUserId}
      onAccessChanged={onAccessChanged}
      onOpenOrganizations={vi.fn()}
      organizationId={ids.organization}
      organizationName="Acme Support"
      viewerRole={viewerRole}
    />,
  );
  return { onAccessChanged };
}

const assignTo = (email: string, role?: string) => {
  fireEvent.change(screen.getByLabelText(/E-mail address/), {
    target: { value: email },
  });
  if (role)
    fireEvent.change(screen.getByLabelText('Role in this organization'), {
      target: { value: role },
    });
  fireEvent.click(screen.getByRole('button', { name: 'Assign role' }));
};

describe('Roles & access · organization administrator', () => {
  it('lists members with their role and what is still waiting for an account', async () => {
    api();
    renderAs('ORG_ADMIN');
    expect(await screen.findByText('Ana García (you)')).toBeTruthy();
    expect(
      (screen.getByLabelText('Role of Maya Singh') as HTMLSelectElement).value,
    ).toBe('AGENT');
    expect(screen.getByText('carlos@example.com')).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Assign a role by e-mail' }),
    ).toBeTruthy();
    // You cannot remove yourself from here; everybody else can be removed.
    expect(
      screen.queryByRole('button', { name: /Remove Ana García/ }),
    ).toBeNull();
    expect(
      screen.getByRole('button', {
        name: 'Remove Maya Singh from Acme Support',
      }),
    ).toBeTruthy();
  });

  it('reserves a role for an address nobody has registered, and says what happens next', async () => {
    const { calls } = api({
      [`POST ${base}/role-grants`]: reply(
        'POST /organizations/{organizationId}/role-grants',
        201,
        {
          outcome: 'RESERVED',
          email: 'new.hire@example.com',
          role: 'AGENT',
          user: null,
          reservation: organizationReservation(),
        },
      ),
    });
    renderAs('ORG_ADMIN');
    await screen.findByText('Ana García (you)');
    assignTo('New.Hire@Example.com', 'AGENT');
    expect(
      await screen.findByText(
        /Support agent reserved for new.hire@example.com\. Nobody has registered that address yet/,
      ),
    ).toBeTruthy();
    expect(calls.find((call) => call.method === 'POST')!.body).toEqual({
      email: 'new.hire@example.com',
      role: 'AGENT',
    });
  });

  it('applies the role at once to a verified account', async () => {
    api({
      [`POST ${base}/role-grants`]: reply(
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
    });
    renderAs('ORG_ADMIN');
    await screen.findByText('Ana García (you)');
    assignTo('john@example.com', 'AGENT');
    expect(
      await screen.findByText(
        'John Lee now has the role Support agent in Acme Support.',
      ),
    ).toBeTruthy();
  });

  it('refuses an invalid address without calling the API', async () => {
    const { calls } = api();
    renderAs('ORG_ADMIN');
    await screen.findByText('Ana García (you)');
    assignTo('not-an-address');
    expect(
      await screen.findByText('Enter a valid e-mail address.'),
    ).toBeTruthy();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('shows the API refusal when the last administrator would be lost', async () => {
    api({
      [`PATCH ${base}/members/${ids.admin}`]: apiError(
        'PATCH /organizations/{organizationId}/members/{userId}',
        409,
        'ORG_LAST_ADMIN',
        'An organization must keep at least one administrator.',
      ),
    });
    renderAs('ORG_ADMIN');
    await screen.findByText('Ana García (you)');
    // Demoting yourself asks first.
    fireEvent.change(screen.getByLabelText('Role of Ana García'), {
      target: { value: 'MEMBER' },
    });
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('Give up your own administration?'),
    ).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Become Member' }),
    );
    expect(
      await screen.findByText(
        'An organization must keep at least one administrator.',
      ),
    ).toBeTruthy();
  });

  it('cancels a reservation', async () => {
    const { calls } = api({
      [`DELETE ${base}/role-grants/${ids.reservation}`]: reply(
        'DELETE /organizations/{organizationId}/role-grants/{grantId}',
        204,
      ),
    });
    renderAs('ORG_ADMIN');
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Cancel the reservation for carlos@example.com',
      }),
    );
    expect(
      await screen.findByText(
        'The reservation for carlos@example.com was cancelled.',
      ),
    ).toBeTruthy();
    expect(calls.some((call) => call.method === 'DELETE')).toBe(true);
  });

  it('works the same for a platform administrator who is not a member', async () => {
    api();
    renderAs('GLOBAL_ADMIN', ids.primary);
    expect(await screen.findByText('Ana García')).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Assign a role by e-mail' }),
    ).toBeTruthy();
  });
});

describe('Roles & access · agent and member', () => {
  it('shows an agent who does what, read only', async () => {
    const { calls } = api();
    renderAs('AGENT', ids.agent);
    expect(await screen.findByText('Maya Singh')).toBeTruthy();
    expect(
      screen.queryByRole('heading', { name: 'Assign a role by e-mail' }),
    ).toBeNull();
    expect(screen.queryByLabelText(/Role of/)).toBeNull();
    // The reservations are addresses of people who are not members: not theirs to see.
    expect(calls.some((call) => call.path.endsWith('/role-grants'))).toBe(
      false,
    );
  });

  it('shows a member their access and whom to ask', async () => {
    api();
    renderAs('MEMBER', ids.member);
    expect(
      await screen.findByText(
        /Only an organization administrator can change it/,
      ),
    ).toBeTruthy();
    expect(await screen.findByText('Ana García')).toBeTruthy();
    expect(
      screen.queryByRole('heading', { name: 'Assign a role by e-mail' }),
    ).toBeNull();
  });

  it('explains what to do when there is no organization yet', () => {
    mockApi({});
    render(
      <OrganizationRolesPage
        canManage={false}
        currentUserId={ids.member}
        onAccessChanged={vi.fn()}
        onOpenOrganizations={vi.fn()}
        organizationId=""
        organizationName=""
        viewerRole="MEMBER"
      />,
    );
    expect(screen.getByText('No organization selected')).toBeTruthy();
  });
});
