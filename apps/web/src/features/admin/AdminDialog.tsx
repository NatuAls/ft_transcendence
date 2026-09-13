import { Button, Dialog, SelectField, TextField } from 'ui';
import { useState } from 'react';
import type { AdminDialogKind, AdminUser } from './adminData';

export function AdminDialog({
  kind,
  onClose,
  onDelete,
  onSave,
  user,
}: {
  kind: Exclude<AdminDialogKind, null>;
  onClose: () => void;
  onDelete: () => void;
  onSave: (data: FormData) => void;
  user: AdminUser;
}) {
  const create = kind === 'create';
  const remove = kind === 'delete';
  const [confirmation, setConfirmation] = useState('');

  return (
    <Dialog
      className="admin-dialog"
      description={
        remove
          ? 'This permanently removes the platform account. Organization ownership must be transferred before deletion.'
          : create
            ? 'Create an account and assign its initial platform access.'
            : `Update identity, role and account state for ${user[1]}.`
      }
      eyebrow="PLATFORM ADMINISTRATION"
      footer={
        <>
          {!create && !remove ? (
            <Button
              className="admin-dialog__delete"
              onClick={onDelete}
              variant="destructive"
            >
              Delete user
            </Button>
          ) : null}
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={remove && confirmation !== 'DELETE'}
            type="submit"
            variant={remove ? 'destructive' : 'primary'}
          >
            {remove ? 'Delete user' : create ? 'Create user' : 'Save changes'}
          </Button>
        </>
      }
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        if (!remove || confirmation === 'DELETE') {
          onSave(new FormData(event.currentTarget));
        }
      }}
      title={
        remove
          ? `Delete ${user[1]}?`
          : create
            ? 'Create platform user'
            : 'Edit platform user'
      }
    >
      {!remove ? (
        <>
          <TextField
            defaultValue={create ? 'New team member' : user[1]}
            label="Full name"
            name="name"
            required
          />
          <TextField
            defaultValue={create ? '' : user[2]}
            label="Email address"
            name="email"
            required
            type="email"
          />
          <SelectField
            defaultValue={create ? 'User' : user[4]}
            label="Global role"
            name="role"
          >
            <option>User</option>
            <option>Global admin</option>
          </SelectField>
          <SelectField
            defaultValue={create ? 'Active' : user[5]}
            label="Account state"
            name="state"
          >
            <option>Active</option>
            <option>Suspended</option>
          </SelectField>
          <p className="admin-dialog__notice">
            Changes are enforced by the backend on the next authorized action.
          </p>
        </>
      ) : (
        <>
          <strong>This action cannot be undone.</strong>
          <TextField
            label="Type DELETE to continue"
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="DELETE"
            value={confirmation}
          />
        </>
      )}
    </Dialog>
  );
}
