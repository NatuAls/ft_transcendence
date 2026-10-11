import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../src/core/feedback/ToastProvider';
import { ChangePasswordPage } from '../src/features/account/ChangePasswordPage';
import { apiError, mockApi, reply } from './support/api';

function renderPage(onSignOut = vi.fn()) {
  return render(
    <ToastProvider>
      <ChangePasswordPage onBack={vi.fn()} onSignOut={onSignOut} />
    </ToastProvider>,
  );
}

function setField(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function enterValidPasswords(currentPassword = 'Old-Password-2026!') {
  setField('Current password', currentPassword);
  setField('New password', 'New-Password-2026!');
  setField('Confirm new password', 'New-Password-2026!');
}

describe('change password page', () => {
  it('validates empty fields locally without calling the API', () => {
    const { calls } = mockApi({});
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(screen.getByText('This field is required.')).toBeTruthy();
    expect(screen.getByText('At least 10 characters.')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('shows AUTH_WRONG_PASSWORD below the current password field', async () => {
    mockApi({
      'POST /auth/change-password': apiError(
        'POST /auth/change-password',
        400,
        'AUTH_WRONG_PASSWORD',
        'Current password is incorrect.',
      ),
    });
    renderPage();
    enterValidPasswords();
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(
      await screen.findByText('Current password is incorrect.'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Current password').getAttribute('aria-invalid'),
    ).toBe('true');
  });

  it('calls onSignOut after a successful 204 response', async () => {
    const { calls } = mockApi({
      'POST /auth/change-password': reply('POST /auth/change-password', 204),
    });
    const onSignOut = vi.fn();
    renderPage(onSignOut);
    enterValidPasswords();
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(
      await screen.findByText('Password changed successfully.'),
    ).toBeTruthy();
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({
      currentPassword: 'Old-Password-2026!',
      password: 'New-Password-2026!',
      confirmPassword: 'New-Password-2026!',
    });
  });
});
