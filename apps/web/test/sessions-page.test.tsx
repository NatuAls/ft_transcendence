import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { SessionsPage } from '../src/features/account/SessionsPage';
import { mockApi, reply } from './support/api';
import { deviceSession, ids } from './support/fixtures';

const iphone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';

function api(extra: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    'GET /auth/sessions': reply('GET /auth/sessions', 200, [
      deviceSession(),
      deviceSession({
        id: ids.otherSession,
        current: false,
        userAgent: iphone,
        ip: null,
      }),
    ]),
    ...extra,
  });
}

describe('sessions and devices', () => {
  it('names each device and marks the one in use', async () => {
    api();
    render(<SessionsPage onBack={vi.fn()} onSignedOut={vi.fn()} />);
    expect(await screen.findByText('This device')).toBeTruthy();
    expect(screen.getByText('Chrome on macOS')).toBeTruthy();
    expect(screen.getByText('Safari on iOS')).toBeTruthy();
    // Only the other device can be signed out from here.
    expect(
      screen.getAllByRole('button', { name: /^Sign out (?!everywhere)/ }),
    ).toHaveLength(1);
  });

  it('signs a device out and reloads the list', async () => {
    const { calls } = api({
      [`DELETE /auth/sessions/${ids.otherSession}`]: reply(
        'DELETE /auth/sessions/{id}',
        204,
      ),
    });
    render(<SessionsPage onBack={vi.fn()} onSignedOut={vi.fn()} />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Sign out Safari on iOS' }),
    );
    expect(
      await screen.findByText(
        'Safari on iOS was signed out. It has to sign in again to come back.',
      ),
    ).toBeTruthy();
    expect(calls.filter((call) => call.path === '/auth/sessions')).toHaveLength(
      2,
    );
  });

  it('signs out everywhere only after confirming', async () => {
    const { calls } = api({
      'POST /auth/logout-all': reply('POST /auth/logout-all', 204),
    });
    const onSignedOut = vi.fn();
    render(<SessionsPage onBack={vi.fn()} onSignedOut={onSignedOut} />);
    await screen.findByText('This device');
    fireEvent.click(
      screen.getByRole('button', { name: 'Sign out everywhere' }),
    );
    expect(calls.some((call) => call.path === '/auth/logout-all')).toBe(false);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Sign out everywhere' }),
    );
    await vi.waitFor(() => expect(onSignedOut).toHaveBeenCalled());
    expect(calls.some((call) => call.path === '/auth/logout-all')).toBe(true);
  });
});
