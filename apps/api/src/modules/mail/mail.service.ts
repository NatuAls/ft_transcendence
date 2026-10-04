import { createTransport, type Transporter } from 'nodemailer';
import { loadConfiguration } from '../../config/env.ts';
import { createLogger } from '../../common/logger.ts';
import {
  emailVerificationTemplate,
  gdprConfirmationTemplate,
  gdprExportReadyTemplate,
  organizationInviteTemplate,
  passwordResetTemplate,
} from './templates.ts';

const logger = createLogger('mail');

/**
 * SMTP with two modes, decided by whether SMTP_USER is set.
 *
 *   · Without it: Mailpit, which ships inside docker-compose. It accepts any
 *     connection, keeps every message and sends nothing to the internet, which
 *     is what makes confirmation e-mails verifiable in dev and in the demo
 *     environments — open its web interface and the message is there.
 *
 *   · With it: a real relay. The transport then authenticates AND refuses to
 *     send in clear: `requireTLS` turns a missing STARTTLS into an error
 *     instead of a silent downgrade, and the certificate is verified like
 *     anybody else's. Without this branch no real provider accepts the
 *     connection, so verification, password recovery and the GDPR
 *     confirmations never reach an actual mailbox.
 *
 * `rejectUnauthorized: false` stays only on the Mailpit side, where the
 * certificate is self-signed and there is nothing to protect: applying it to a
 * real relay would accept any certificate and hand the credentials to whoever
 * answered.
 */
let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  if (!transporter) {
    const config = loadConfiguration();
    const auth = config.SMTP_USER
      ? { user: config.SMTP_USER, pass: config.SMTP_PASS ?? '' }
      : undefined;

    transporter = createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      // Implicit TLS (port 465). On 587 this stays false and STARTTLS lifts
      // the connection, which is what `requireTLS` then makes mandatory.
      secure: config.SMTP_SECURE,
      ...(auth ? { auth, requireTLS: !config.SMTP_SECURE } : {}),
      ...(auth ? {} : { tls: { rejectUnauthorized: false } }),
    });
  }
  return transporter;
}

export async function verifyMail(): Promise<boolean> {
  try {
    await getTransporter().verify();
    return true;
  } catch {
    return false;
  }
}

async function send(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  try {
    const config = loadConfiguration();
    await getTransporter().sendMail({
      from: config.MAIL_FROM,
      to,
      subject,
      html,
      text,
    });
    logger.info(`mail sent to ${to}: ${subject}`);
  } catch (error) {
    // A failing mailbox must never break the request that triggered it.
    logger.error(`mail to ${to} failed`, error);
  }
}

export async function sendEmailVerification(
  to: string,
  name: string,
  url: string,
): Promise<void> {
  const { subject, html, text } = emailVerificationTemplate(name, url);
  await send(to, subject, html, text);
}

export async function sendPasswordReset(
  to: string,
  name: string,
  url: string,
): Promise<void> {
  const { subject, html, text } = passwordResetTemplate(name, url);
  await send(to, subject, html, text);
}

export async function sendGdprConfirmation(
  to: string,
  name: string,
  type: 'EXPORT' | 'DELETE',
  url: string,
): Promise<void> {
  const { subject, html, text } = gdprConfirmationTemplate(name, type, url);
  await send(to, subject, html, text);
}

export async function sendGdprExportReady(
  to: string,
  name: string,
  url: string,
): Promise<void> {
  const { subject, html, text } = gdprExportReadyTemplate(name, url);
  await send(to, subject, html, text);
}

export async function sendOrganizationInvite(
  to: string,
  orgName: string,
  inviter: string,
  url: string,
): Promise<void> {
  const { subject, html, text } = organizationInviteTemplate(
    orgName,
    inviter,
    url,
  );
  await send(to, subject, html, text);
}
