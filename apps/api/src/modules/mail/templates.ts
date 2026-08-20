export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

function layout(
  title: string,
  body: string,
  cta?: { label: string; url: string },
): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#f7f9fa;padding:24px">
  <div style="max-width:520px;margin:auto;background:#fff;border:1px solid #dce3e7;border-radius:12px;padding:24px">
    <h1 style="color:#0d6c90;font-size:18px;margin:0 0 12px">HelpDesk Lite</h1>
    <h2 style="font-size:16px;margin:0 0 12px;color:#1a2126">${title}</h2>
    <div style="color:#3e4b53;font-size:14px;line-height:1.6">${body}</div>
    ${
      cta
        ? `<p style="margin:24px 0"><a href="${cta.url}" style="background:#0d6c90;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">${cta.label}</a></p>
           <p style="font-size:12px;color:#6b7c86;word-break:break-all">${cta.url}</p>`
        : ''
    }
    <hr style="border:0;border-top:1px solid #edf1f3;margin:20px 0">
    <p style="font-size:12px;color:#93a3ac;margin:0">
      Sent by HelpDesk Lite. If you did not request this, ignore this message.
    </p>
  </div></body></html>`;
}

export function emailVerificationTemplate(
  name: string,
  url: string,
): EmailContent {
  return {
    subject: 'Confirm your HelpDesk Lite account',
    html: layout(
      `Welcome, ${name}`,
      '<p>Confirm your email address to activate your account.</p><p>This link expires in 24 hours.</p>',
      { label: 'Confirm my email', url },
    ),
    text: `Confirm your email: ${url}`,
  };
}

export function passwordResetTemplate(name: string, url: string): EmailContent {
  return {
    subject: 'Reset your HelpDesk Lite password',
    html: layout(
      `Password reset for ${name}`,
      '<p>Use the button below to choose a new password. The link expires in 30 minutes and can be used once.</p><p>Every active session will be signed out once the password changes.</p>',
      { label: 'Reset my password', url },
    ),
    text: `Reset your password: ${url}`,
  };
}

export function gdprConfirmationTemplate(
  name: string,
  type: 'EXPORT' | 'DELETE',
  url: string,
): EmailContent {
  const isDelete = type === 'DELETE';
  return {
    subject: isDelete
      ? 'Confirm deletion of your HelpDesk Lite data'
      : 'Confirm your data export',
    html: layout(
      isDelete
        ? `Account deletion requested, ${name}`
        : `Data export requested, ${name}`,
      isDelete
        ? '<p>You asked us to permanently delete your account and personal data.</p><p><strong>This cannot be undone.</strong> You will also be asked to type your username to confirm.</p><p>The link expires in 30 minutes.</p>'
        : '<p>You asked for a copy of your personal data. Confirm below and we will build a ZIP archive containing your profile, tickets, comments, messages and attachments in JSON and CSV.</p><p>The link expires in 30 minutes; the download expires 24 hours after that.</p>',
      { label: isDelete ? 'Confirm deletion' : 'Confirm export', url },
    ),
    text: `Confirm your ${type.toLowerCase()} request: ${url}`,
  };
}

export function gdprExportReadyTemplate(
  name: string,
  url: string,
): EmailContent {
  return {
    subject: 'Your HelpDesk Lite data export is ready',
    html: layout(
      `Export ready, ${name}`,
      '<p>Your archive is ready to download. The link works once and expires in 24 hours.</p>',
      { label: 'Download my data', url },
    ),
    text: `Download your data: ${url}`,
  };
}

export function organizationInviteTemplate(
  orgName: string,
  inviter: string,
  url: string,
): EmailContent {
  return {
    subject: `You have been added to ${orgName}`,
    html: layout(
      `${inviter} added you to ${orgName}`,
      `<p>You now have access to the ${orgName} workspace on HelpDesk Lite.</p>`,
      { label: 'Open HelpDesk Lite', url },
    ),
    text: `${inviter} added you to ${orgName}: ${url}`,
  };
}
