import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerifyEmailPage } from '../src/features/auth/VerifyEmailPage';
import type { ViewerSession } from '../src/app/session';
import { apiError, mockApi, reply } from './support/api';

/**
 * The link of the confirmation e-mail. Verifying is also the moment every
 * role reserved for the address arrives, so the page shows the access the
 * person has now.
 */
const token = 'a'.repeat(43);

const viewer = {
  globalRole: 'GLOBAL_ADMIN',
  memberships: [
    {
      organizationId: 'o',
      organizationName: 'Acme Support',
      organizationSlug: 'acme',
      role: 'AGENT',
    },
  ],
} as unknown as ViewerSession;

describe('e-mail verification page', () => {
  it('confirms the address once and lists the roles that arrived with it', async () => {
    window.history.replaceState(null, '', `#verify-email?token=${token}`);
    const { calls } = mockApi({
      'POST /auth/verify-email': reply('POST /auth/verify-email', 204),
    });
    const onVerified = vi.fn(async () => viewer);
    render(
      <VerifyEmailPage
        onContinue={vi.fn()}
        onVerified={onVerified}
        token={token}
      />,
    );
    expect(
      await screen.findByRole('heading', { name: 'Address confirmed' }),
    ).toBeTruthy();
    expect(screen.getByText('Platform administrator')).toBeTruthy();
    expect(screen.getByText('Support agent in Acme Support')).toBeTruthy();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ token });
    // The single-use token does not linger in the address bar.
    expect(window.location.hash).toBe('#verify-email');
  });

  it('offers to sign in when the confirmation happened without a session', async () => {
    mockApi({
      'POST /auth/verify-email': reply('POST /auth/verify-email', 204),
    });
    const onContinue = vi.fn();
    render(
      <VerifyEmailPage
        onContinue={onContinue}
        onVerified={async () => null}
        token={token}
      />,
    );
    (await screen.findByRole('button', { name: 'Go to sign in' })).click();
    expect(onContinue).toHaveBeenCalledWith(false);
  });

  it('explains a used or expired link', async () => {
    mockApi({
      'POST /auth/verify-email': apiError(
        'POST /auth/verify-email',
        401,
        'AUTH_TOKEN_INVALID',
        'Token is invalid or expired.',
      ),
    });
    render(
      <VerifyEmailPage
        onContinue={vi.fn()}
        onVerified={async () => null}
        token={token}
      />,
    );
    expect(
      await screen.findByRole('heading', { name: 'The link did not work' }),
    ).toBeTruthy();
    expect(
      screen.getByText(/already used, it expired after 24 hours/),
    ).toBeTruthy();
  });

  it('says what to do when opened without a token', () => {
    const { calls } = mockApi({});
    render(
      <VerifyEmailPage
        onContinue={vi.fn()}
        onVerified={async () => null}
        token=""
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Nothing to confirm' }),
    ).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});
