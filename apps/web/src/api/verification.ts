import { verifyEmailSchema } from 'contracts';
import { apiRequest, jsonBody } from './http';

/**
 * Consumes the link of the confirmation e-mail. Public on purpose: the link
 * may be opened in a browser with no session, and the token alone proves the
 * mailbox. This is also the moment the API hands over every role reserved
 * for the address.
 */
export async function verifyEmail(token: string): Promise<void> {
  await apiRequest('/auth/verify-email', {
    method: 'POST',
    ...jsonBody(verifyEmailSchema.parse({ token })),
  });
}

/** Sends a fresh link to the address of the signed-in account. */
export async function resendVerification(): Promise<void> {
  await apiRequest('/auth/resend-verification', { method: 'POST' });
}
