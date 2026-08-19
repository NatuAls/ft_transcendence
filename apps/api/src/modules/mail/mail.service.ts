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
 * SMTP through Mailpit, which ships inside docker-compose. This is what makes
 * confirmation emails verifiable in dev/demo: open http://localhost:8025 and
 * see the message. No external provider, nothing to configure.
 */
let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  if (!transporter) {
    const config = loadConfiguration();
    transporter = createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: false,
      tls: { rejectUnauthorized: false },
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
