import { Button, Dialog, SelectField, TextField } from 'ui';
import { useEffect, useRef, useState } from 'react';
import type {
  DeleteContext,
  OrganizationDialogKind,
  OrganizationRow,
} from './organizationData';

export function OrganizationDialog({
  deleteContext,
  dialog,
  onClose,
  onDelete,
  onSave,
  organizationName,
  selectedName,
  selectedRow,
}: {
  deleteContext: DeleteContext;
  dialog: Exclude<OrganizationDialogKind, null>;
  onClose: () => void;
  onDelete: (context: Exclude<DeleteContext, null>) => void;
  onSave: (data: FormData) => void;
  organizationName: string;
  selectedName: string;
  selectedRow?: OrganizationRow;
}) {
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submitTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (submitTimer.current) window.clearTimeout(submitTimer.current);
    },
    [],
  );
  const deletingOrganization =
    dialog === 'delete' && deleteContext === 'settings';
  const roleHasMembers = dialog === 'role' && selectedRow?.[3] !== '0 members';
  const config =
    dialog === 'add-member'
      ? [
          'Add organization member',
          `Invite a user to ${organizationName} and assign the access they need.`,
          'Send invitation',
        ]
      : dialog === 'edit-member'
        ? [
            'Edit organization member',
            `Change ${selectedName}’s access inside ${organizationName}.`,
            'Save access',
          ]
        : dialog === 'settings'
          ? [
              'Organization settings',
              `Edit the identity and operational details of ${organizationName}.`,
              'Save changes',
            ]
          : dialog === 'role'
            ? [
                selectedName
                  ? 'Edit organization role'
                  : 'Create organization role',
                'Configure a reusable set of organization permissions.',
                'Save role',
              ]
            : dialog === 'category'
              ? [
                  selectedName
                    ? 'Edit ticket category'
                    : 'Create ticket category',
                  'Configure how requests are classified and routed.',
                  'Save category',
                ]
              : [
                  deletingOrganization
                    ? `Delete ${organizationName}?`
                    : deleteContext === 'category'
                      ? `Archive ${selectedName}?`
                      : `Delete ${selectedName}?`,
                  deletingOrganization
                    ? 'Members lose organization access and its tickets can no longer be changed.'
                    : deleteContext === 'category'
                      ? 'Existing tickets keep this category, but it cannot be selected for new tickets.'
                      : 'This removes the item from the organization preview.',
                  deletingOrganization
                    ? 'Delete organization'
                    : deleteContext === 'category'
                      ? 'Archive category'
                      : 'Delete',
                ];
  const isDeleteConfirmed =
    dialog !== 'delete' ||
    !deletingOrganization ||
    confirmation === organizationName;

  return (
    <Dialog
      className="organization-dialog"
      description={config[1]}
      eyebrow="ORGANIZATION"
      footer={
        <>
          {!['add-member', 'delete'].includes(dialog) ? (
            <Button
              className="organization-dialog__delete"
              disabled={roleHasMembers}
              onClick={() => onDelete(dialog as Exclude<DeleteContext, null>)}
              title={
                roleHasMembers
                  ? 'Reassign members before deleting this role.'
                  : undefined
              }
              variant="destructive"
            >
              {dialog === 'category' ? 'Archive' : 'Delete'}
            </Button>
          ) : null}
          <Button disabled={submitting} onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={!isDeleteConfirmed || submitting}
            type="submit"
            variant={dialog === 'delete' ? 'destructive' : 'primary'}
          >
            {submitting
              ? dialog === 'add-member'
                ? 'Sending…'
                : 'Saving…'
              : config[2]}
          </Button>
        </>
      }
      onClose={() => {
        if (!submitting) onClose();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (!isDeleteConfirmed || submitting) return;
        const data = new FormData(event.currentTarget);
        setSubmitting(true);
        submitTimer.current = window.setTimeout(() => onSave(data), 250);
      }}
      title={config[0]}
    >
      {dialog === 'delete' ? (
        deletingOrganization ? (
          <TextField
            label="Type the organization name"
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={organizationName}
            required
            value={confirmation}
          />
        ) : (
          <p className="organization-dialog__warning">
            This action cannot be undone in the current preview.
          </p>
        )
      ) : dialog === 'add-member' ? (
        <>
          <TextField
            label="Email address"
            name="email"
            placeholder="name@company.com"
            required
            type="email"
          />
          <SelectField label="Organization role" name="role">
            <option>Agent</option>
            <option>User</option>
            <option>Org admin</option>
          </SelectField>
          <p className="organization-dialog__notice">
            Ticket access comes from the selected role. The production backend
            will validate the invitation and send it by email.
          </p>
        </>
      ) : dialog === 'settings' ? (
        <>
          <TextField
            defaultValue={organizationName}
            label="Organization name"
            name="organization-name"
            required
          />
          <TextField
            defaultValue="Design and product operations"
            label="Description"
            name="description"
          />
        </>
      ) : dialog === 'edit-member' ? (
        <>
          <TextField disabled label="Member" value={selectedName} />
          <SelectField
            defaultValue={selectedRow?.[3]}
            label="Organization role"
            name="role"
          >
            <option>Agent</option>
            <option>User</option>
            <option>Org admin</option>
          </SelectField>
          <SelectField
            defaultValue={selectedRow?.[4]}
            label="Membership state"
            name="state"
          >
            <option>Active</option>
            <option>Invited</option>
            <option>Suspended</option>
          </SelectField>
        </>
      ) : dialog === 'role' ? (
        <>
          <TextField
            defaultValue={selectedRow?.[1] ?? ''}
            label="Role name"
            name="role-name"
            required
          />
          <TextField
            defaultValue={selectedRow?.[2] ?? ''}
            label="Description"
            name="description"
            required
          />
          <fieldset>
            <legend>Permissions</legend>
            {[
              'View organization',
              'View assigned tickets',
              'Update ticket status',
              'Manage members',
            ].map((permission) => (
              <label key={permission}>
                <input
                  defaultChecked={permission !== 'Manage members'}
                  name="permissions"
                  type="checkbox"
                  value={permission}
                />{' '}
                {permission}
              </label>
            ))}
          </fieldset>
          {roleHasMembers ? (
            <p className="organization-dialog__warning">
              Reassign all members before deleting this role.
            </p>
          ) : null}
        </>
      ) : (
        <>
          <TextField
            defaultValue={selectedRow?.[1] ?? ''}
            label="Category name"
            name="category-name"
            required
          />
          <TextField
            defaultValue={selectedRow?.[2] ?? ''}
            label="Description"
            name="description"
            required
          />
          <SelectField label="Default assignee" name="assignee">
            <option>Support agents</option>
            <option>Unassigned</option>
          </SelectField>
          <SelectField
            defaultValue={selectedRow?.[4] ?? 'Active'}
            label="Status"
            name="state"
          >
            <option>Active</option>
            <option>Review</option>
            <option>Archived</option>
          </SelectField>
        </>
      )}
    </Dialog>
  );
}
