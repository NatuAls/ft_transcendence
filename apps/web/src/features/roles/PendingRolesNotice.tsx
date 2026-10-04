import { Alert, Button } from 'ui';
import { useState } from 'react';
import type { PendingRole } from 'contracts';
import { resendVerification } from '../../api/verification';
import { previewMode } from '../../app/session';
import { pendingRoleText } from './rolesGateway';

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
          ? 'A role is waiting for you'
          : `${pendingRoles.length} roles are waiting for you`
      }
      tone="info"
    >
      <ul className="my-1 list-disc pl-5">
        {pendingRoles.map((role) => (
          <li key={`${role.scope}-${role.organizationName ?? ''}`}>
            {pendingRoleText(role)}
          </li>
        ))}
      </ul>
      <p>
        An administrator gave it to your e-mail address. It becomes active as
        soon as you confirm the address with the link we sent you.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          disabled={state === 'sending' || state === 'sent'}
          onClick={() => void resend()}
          size="compact"
          variant="secondary"
        >
          {state === 'sending' ? 'Sending…' : 'Send the link again'}
        </Button>
        <span aria-live="polite" className="text-xs">
          {state === 'sent'
            ? 'Sent. Open the newest message; older links no longer work.'
            : state === 'failed'
              ? 'It could not be sent. Try again in a minute.'
              : ''}
        </span>
      </div>
    </Alert>
  );
}
