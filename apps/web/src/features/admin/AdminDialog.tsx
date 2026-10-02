import { Alert, Button, Dialog, SelectField, TextField } from 'ui';
import { useState } from 'react';
import type { AdminDialogKind, AdminUser } from './adminData';

export function AdminDialog({
  kind,
  onClose,
  onSave,
  user,
}: {
  kind: Exclude<AdminDialogKind, null>;
  onClose: () => void;
  onSave: (data: FormData) => void;
  user: AdminUser;
}) {
  const create = kind === 'create';
  const [platformAccess, setPlatformAccess] = useState(
    create ? 'Standard user' : user[4],
  );

  return (
    <Dialog
      className="max-w-[500px]"
      description={
        create
          ? 'Send a single-use invitation. The recipient creates their password before the account becomes active.'
          : `Update identity, role and account state for ${user[1]}.`
      }
      eyebrow="PLATFORM ADMINISTRATION"
      footer={
        <>
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
      <TextField
        defaultValue={create ? '' : user[1]}
        label={create ? 'Display name (optional)' : 'Full name'}
        name="name"
      />
      <TextField
        defaultValue={create ? '' : user[2]}
        label="Email address"
        name="email"
        required
        type="email"
      />
      <SelectField
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
            <option>Northstar Studio</option>
            <option>Helio Labs</option>
            <option>Orbit Finance</option>
          </SelectField>
          <SelectField label="Organization role" name="organization-role">
            <option>Member</option>
            <option>Agent</option>
            <option>Organization admin</option>
          </SelectField>
        </>
      ) : null}
      {!create ? (
        <SelectField defaultValue={user[5]} label="Account state" name="state">
          <option>Active</option>
          <option>Suspended</option>
        </SelectField>
      ) : null}
      <Alert>
        {create
          ? platformAccess === 'Global admin'
            ? 'Global administrators receive platform access without a synthetic organization membership.'
            : 'The account remains invitation pending until the recipient opens the single-use link and creates a password.'
          : 'Suspending blocks access. Personal-data deletion remains a separate, user-confirmed privacy request.'}
      </Alert>
    </Dialog>
  );
}
