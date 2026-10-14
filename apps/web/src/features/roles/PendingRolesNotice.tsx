import { Alert, Button } from 'ui';
import { useState } from 'react';
import type { PendingRole } from 'contracts';
import { resendVerification } from '../../api/verification';
import { previewMode } from '../../app/session';
import { useTranslation } from '../../core/i18n';

/**
 * Tells somebody whose address is not confirmed that an administrator has
 * already reserved a role for it, and gives them the one thing that activates
 * it: a fresh confirmation e-mail.
 */
export function PendingRolesNotice({
  className = '',
  emailVerified,
  pendingRoles,
}: {
  className?: string;
  emailVerified: boolean;
  pendingRoles: PendingRole[];
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>(
    'idle',
  );
  if (emailVerified || pendingRoles.length === 0) return null;

  async function resend() {
    setState('sending');
    try {
      if (!previewMode) await resendVerification();
      setState('sent');
    } catch {
      setState('failed');
    }
  }

  return (
    <Alert
      className={`text-left ${className}`.trim()}
      title={
        pendingRoles.length === 1
          ? t('account.pendingRoles.title_one')
          : t('account.pendingRoles.title_other', {
              count: pendingRoles.length,
            })
      }
      tone="info"
    >
      <ul className="my-1 list-disc pl-5">
        {pendingRoles.map((role) => (
          <li key={`${role.scope}-${role.organizationName ?? ''}`}>
            {role.scope === 'PLATFORM'
              ? t('account.pendingRoles.platformAdmin')
              : t('account.pendingRoles.organizationRole', {
                  role: t(`account.roles.${role.role}`),
                  organization:
                    role.organizationName ??
                    t('account.pendingRoles.organizationFallback'),
                })}
          </li>
        ))}
      </ul>
      <p>{t('account.pendingRoles.description')}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          disabled={state === 'sending' || state === 'sent'}
          onClick={() => void resend()}
          size="compact"
          variant="secondary"
        >
          {state === 'sending'
            ? t('account.pendingRoles.sending')
            : t('account.pendingRoles.resend')}
        </Button>
        <span aria-live="polite" className="text-xs">
          {state === 'sent'
            ? t('account.pendingRoles.sent')
            : state === 'failed'
              ? t('account.pendingRoles.failed')
              : ''}
        </span>
      </div>
    </Alert>
  );
}
