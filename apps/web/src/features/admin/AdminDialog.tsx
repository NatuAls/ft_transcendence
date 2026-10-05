import { Alert, Button, Dialog, SelectField, TextField } from 'ui';
import { useState } from 'react';
import type { AdminDialogKind, AdminUser } from './adminData';

export function AdminDialog({
  kind,
  locked,
  onClose,
  onDelete,
  onSave,
  organizationOptions,
  user,
}: {
  kind: Exclude<AdminDialogKind, null>;
  /**
   * Fields the API would refuse to change for this account: your own role and
   * state, everything about the primary administrator, and the e-mail address
   * (it is the sign-in identity, so it is not edited from here).
   */
  locked?: {
    email?: boolean;
    reason?: string;
    role?: boolean;
    state?: boolean;
  };
  onClose: () => void;
  /** Present when the account may be deleted from here. */
  onDelete?: () => void;
  onSave: (data: FormData) => void;
  organizationOptions: Array<{ label: string; value: string }>;
  user: AdminUser;
}) {
  const create = kind === 'create';
  const [platformAccess, setPlatformAccess] = useState(
    create ? 'Standard user' : user[4],
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (confirmingDelete && onDelete) {
    return (
      <Dialog
        className="max-w-[500px]"
        description={`${user[1]} will no longer be able to sign in: every session is closed now and the account disappears from the platform. Their tickets and comments stay, for the people who depend on them.`}
        eyebrow="PLATFORM ADMINISTRATION"
        footer={
          <>
            <Button
              onClick={() => setConfirmingDelete(false)}
              variant="secondary"
            >
              Keep account
            </Button>
            <Button type="submit" variant="destructive">
              Delete account
            </Button>
          </>
        }
        onClose={onClose}
        onSubmit={(event) => {
          event.preventDefault();
          onDelete();
        }}
        title={`Delete ${user[1]}?`}
      />
    );
  }

  return (
    <Dialog
      className="max-w-[500px]"
      description={
        create
          ? 'The person creates their own account and password with this address. The access you choose is reserved for it and becomes active when they confirm it — at once if they already have a confirmed account.'
          : `Update identity, role and account state for ${user[1]}.`
      }
      eyebrow="PLATFORM ADMINISTRATION"
      footer={
        <>
          {!create && onDelete ? (
            <Button
              className="mr-auto max-md:mr-0 max-md:w-full"
              onClick={() => setConfirmingDelete(true)}
              variant="destructive"
            >
              Delete
            </Button>
          ) : null}
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button type="submit">
            {create ? 'Send invitation' : 'Save changes'}
          </Button>
        </>
      }
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        onSave(new FormData(event.currentTarget));
      }}
      title={create ? 'Invite user' : 'Edit platform user'}
    >
      {create ? null : (
        <TextField
          defaultValue={user[1]}
          label="Full name"
          name="name"
          required
        />
      )}
      <TextField
        defaultValue={create ? '' : user[2]}
        disabled={!create && locked?.email}
        label="Email address"
        name="email"
        required
        type="email"
      />
      <SelectField
        disabled={!create && locked?.role}
        label="Platform access"
        name="role"
        onChange={(event) => setPlatformAccess(event.target.value)}
        value={platformAccess}
      >
        <option>Standard user</option>
        <option>Global admin</option>
      </SelectField>
      {create && platformAccess === 'Standard user' ? (
        <>
          <SelectField label="Initial organization" name="organization">
            {organizationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Organization role" name="organization-role">
            <option>Member</option>
            <option>Agent</option>
            <option>Organization admin</option>
          </SelectField>
        </>
      ) : null}
      {!create ? (
        <SelectField
          defaultValue={user[5]}
          disabled={locked?.state}
          label="Account state"
          name="state"
        >
          <option>Active</option>
          <option>Suspended</option>
        </SelectField>
      ) : null}
      <Alert>
        {create
          ? platformAccess === 'Global admin'
            ? 'Global administrators receive platform access without a synthetic organization membership.'
            : 'Nothing is active until the person confirms the address: registering it is not enough, so nobody can claim somebody else’s invitation.'
          : (locked?.reason ??
            'Suspending blocks access. Personal-data deletion remains a separate, user-confirmed privacy request.')}
      </Alert>
    </Dialog>
  );
}
