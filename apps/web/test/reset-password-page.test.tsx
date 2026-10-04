import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ForgotPasswordPage } from '../src/features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../src/features/auth/ResetPasswordPage';
import { apiError, mockApi, reply } from './support/api';

/**
 * Recuperación de contraseña, de punta a punta.
 *
 * Hasta el 04/10 este camino no se podía completar: la pantalla de acceso no
 * enlazaba `POST /auth/forgot-password`, y el enlace del correo apuntaba a
 * `/reset-password`, una ruta que no existe en el router de fragmento.
 */
const token = 'r'.repeat(43);

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('forgot password', () => {
  it('answers the same whether the address exists or not', async () => {
    const { calls } = mockApi({
      'POST /auth/forgot-password': reply('POST /auth/forgot-password', 202, {
        accepted: true,
      }),
    });
    render(<ForgotPasswordPage onBack={vi.fn()} />);
    type('E-mail address', 'someone@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'E-mail me a link' }));

    expect(await screen.findByText('Check your inbox')).toBeTruthy();
    // El mensaje no confirma ni desmiente que la cuenta exista.
    expect(screen.getByRole('status').textContent).toContain('has an account');
    expect(calls).toHaveLength(1);
  });

  it('refuses an address that is not one, without calling the API', () => {
    const { calls } = mockApi({});
    render(<ForgotPasswordPage onBack={vi.fn()} />);
    type('E-mail address', 'no-es-un-correo');
    fireEvent.click(screen.getByRole('button', { name: 'E-mail me a link' }));

    expect(screen.getByText('Enter a valid e-mail address.')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});

describe('reset password page', () => {
  it('changes the password and takes the token out of the address bar', async () => {
    window.history.replaceState(null, '', `#reset-password?token=${token}`);
    const { calls } = mockApi({
      'POST /auth/reset-password': reply('POST /auth/reset-password', 204),
    });
    const onDone = vi.fn();
    render(
      <ResetPasswordPage
        onDone={onDone}
        onRequestNew={vi.fn()}
        token={token}
      />,
    );
    // Un testigo de un solo uso no se queda en el historial.
    expect(window.location.hash).toBe('#reset-password');

    type('New password', 'Nueva-Clave-2026!');
    type('Repeat the new password', 'Nueva-Clave-2026!');
    fireEvent.click(screen.getByRole('button', { name: 'Change my password' }));

    expect(await screen.findByText('Password changed')).toBeTruthy();
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toMatchObject({ token });

    fireEvent.click(screen.getByRole('button', { name: 'Go to sign in' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('applies the same password policy as the API, before sending', () => {
    const { calls } = mockApi({});
    render(
      <ResetPasswordPage
        onDone={vi.fn()}
        onRequestNew={vi.fn()}
        token={token}
      />,
    );
    type('New password', 'corta');
    type('Repeat the new password', 'corta');
    fireEvent.click(screen.getByRole('button', { name: 'Change my password' }));

    expect(screen.getByText('Use at least 10 characters.')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('says so when the two passwords do not match', () => {
    const { calls } = mockApi({});
    render(
      <ResetPasswordPage
        onDone={vi.fn()}
        onRequestNew={vi.fn()}
        token={token}
      />,
    );
    type('New password', 'Nueva-Clave-2026!');
    type('Repeat the new password', 'Otra-Clave-2026!');
    fireEvent.click(screen.getByRole('button', { name: 'Change my password' }));

    expect(screen.getByText('The two passwords do not match.')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('explains a used or expired link and offers a new one', async () => {
    mockApi({
      'POST /auth/reset-password': apiError(
        'POST /auth/reset-password',
        400,
        'AUTH_TOKEN_INVALID',
        'Token is invalid or expired.',
      ),
    });
    const onRequestNew = vi.fn();
    render(
      <ResetPasswordPage
        onDone={vi.fn()}
        onRequestNew={onRequestNew}
        token={token}
      />,
    );
    type('New password', 'Nueva-Clave-2026!');
    type('Repeat the new password', 'Nueva-Clave-2026!');
    fireEvent.click(screen.getByRole('button', { name: 'Change my password' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ask for a new link' }));
    expect(onRequestNew).toHaveBeenCalled();
  });

  it('says what to do when opened without a token', () => {
    render(
      <ResetPasswordPage onDone={vi.fn()} onRequestNew={vi.fn()} token="" />,
    );
    expect(screen.getByText('Nothing to reset')).toBeTruthy();
  });
});
