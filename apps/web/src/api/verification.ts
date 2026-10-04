import {
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  type ResetPasswordInput,
} from 'contracts';
import { request } from '../core/api/client';

/**
 * Consumes the link of the confirmation e-mail. Public on purpose: the link
 * may be opened in a browser with no session, and the token alone proves the
 * mailbox. This is also the moment the API hands over every role reserved
 * for the address.
 */
export async function verifyEmail(token: string): Promise<void> {
  await request('/auth/verify-email', {
    method: 'POST',
    body: verifyEmailSchema.parse({ token }),
  });
}

/** Sends a fresh link to the address of the signed-in account. */
export async function resendVerification(): Promise<void> {
  await request('/auth/resend-verification', { method: 'POST' });
}

/**
 * Pide el correo de recuperación. La API responde 202 SIEMPRE, exista o no la
 * dirección: decir «esa cuenta no existe» convertiría este formulario en un
 * comprobador de quién está registrado. La pantalla dice lo mismo en los dos
 * casos por la misma razón.
 */
export async function forgotPassword(email: string): Promise<void> {
  await request('/auth/forgot-password', {
    method: 'POST',
    body: forgotPasswordSchema.parse({ email }),
  });
}

/**
 * Consume el enlace del correo y cambia la contraseña. Público a propósito: el
 * testigo llega por correo y prueba el buzón, que es justo lo que no se puede
 * exigir a quien no puede entrar.
 */
export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  await request('/auth/reset-password', {
    method: 'POST',
    body: resetPasswordSchema.parse(input),
  });
}
