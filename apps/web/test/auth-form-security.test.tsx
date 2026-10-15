import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ForgotPasswordPage } from '../src/features/auth/ForgotPasswordPage';
import { RegisterPage } from '../src/features/auth/RegisterPage';
import { SignInPage } from '../src/features/auth/SignInPage';
import { initI18n } from '../src/core/i18n';
import { apiError, mockApi } from './support/api';

beforeAll(() => initI18n());

describe('authentication form security', () => {
  it('shows a translated rate limit error on sign in without retrying', async () => {
    const { calls } = mockApi({
      'POST /auth/login': apiError(
        'POST /auth/login',
        429,
        'RATE_LIMITED',
        'Too many requests',
      ),
    });
    render(<SignInPage onCreateAccount={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'person@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Password-2026!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText(
        'Too many requests. Please try again in a minute.',
      ),
    ).toBeTruthy();
    expect(calls).toHaveLength(1);
  });

  it('shows a translated rate limit error on registration without retrying', async () => {
    const { calls } = mockApi({
      'POST /auth/register': apiError(
        'POST /auth/register',
        429,
        'RATE_LIMITED',
        'Too many requests',
      ),
    });
    render(<RegisterPage onSignIn={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('First Name'), {
      target: { value: 'Ada' },
    });
    fireEvent.change(screen.getByLabelText('Last Name'), {
      target: { value: 'Lovelace' },
    });
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'ada-lovelace' },
    });
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Password-2026!' },
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'Password-2026!' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText(
        'Too many requests. Please try again in a minute.',
      ),
    ).toBeTruthy();
    expect(calls).toHaveLength(1);
  });

  it('shows a translated rate limit error on password recovery without retrying', async () => {
    const { calls } = mockApi({
      'POST /auth/forgot-password': apiError(
        'POST /auth/forgot-password',
        429,
        'RATE_LIMITED',
        'Too many requests',
      ),
    });
    render(<ForgotPasswordPage onBack={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('E-mail address'), {
      target: { value: 'person@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'E-mail me a link' }));

    expect(
      await screen.findByText(
        'Too many requests. Please try again in a minute.',
      ),
    ).toBeTruthy();
    expect(calls).toHaveLength(1);
  });

  it('exposes password visibility state to assistive technology', () => {
    render(<SignInPage onCreateAccount={vi.fn()} onSubmit={vi.fn()} />);
    expect(
      screen.getByLabelText('Email address').getAttribute('autocomplete'),
    ).toBe('email');
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(
      screen
        .getByRole('button', { name: 'Hide password' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByLabelText('Password').getAttribute('type')).toBe('text');
  });
});
