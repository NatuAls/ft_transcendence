import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PendingRolesNotice } from '../src/features/roles/PendingRolesNotice';
import { apiError, mockApi, reply } from './support/api';

const pending = [
  {
    scope: 'PLATFORM' as const,
    role: 'GLOBAL_ADMIN' as const,
    organizationName: null,
  },
  {
    scope: 'ORGANIZATION' as const,
    role: 'AGENT' as const,
    organizationName: 'Acme Support',
  },
];

describe('pending roles notice', () => {
  it('stays hidden when there is nothing waiting or the address is confirmed', () => {
    const { container: none } = render(
      <PendingRolesNotice emailVerified={false} pendingRoles={[]} />,
    );
    expect(none.textContent).toBe('');
    const { container: verified } = render(
      <PendingRolesNotice emailVerified pendingRoles={pending} />,
    );
    expect(verified.textContent).toBe('');
  });

  it('lists what is waiting and sends a fresh link', async () => {
    const { calls } = mockApi({
      'POST /auth/resend-verification': reply(
        'POST /auth/resend-verification',
        202,
        { accepted: true },
      ),
    });
    render(<PendingRolesNotice emailVerified={false} pendingRoles={pending} />);
    expect(screen.getByText('2 roles are waiting for you')).toBeTruthy();
    expect(screen.getByText('Platform administrator')).toBeTruthy();
    expect(screen.getByText('Support agent in Acme Support')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Send the link again' }),
    );
    expect(
      await screen.findByText(/Sent\. Open the newest message/),
    ).toBeTruthy();
    expect(calls).toHaveLength(1);
  });

  it('says so when the link could not be sent', async () => {
    mockApi({
      'POST /auth/resend-verification': apiError(
        'POST /auth/resend-verification',
        429,
        'RATE_LIMITED',
        'Too many requests.',
      ),
    });
    render(
      <PendingRolesNotice
        emailVerified={false}
        pendingRoles={pending.slice(0, 1)}
      />,
    );
    expect(screen.getByText('A role is waiting for you')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Send the link again' }),
    );
    expect(
      await screen.findByText('It could not be sent. Try again in a minute.'),
    ).toBeTruthy();
  });
});
