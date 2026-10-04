import { Alert, Button, Dialog, SelectField, TextField } from 'ui';
import { useEffect, useRef, useState } from 'react';
import type {
  DeleteContext,
  OrganizationDialogKind,
  OrganizationRow,
} from './organizationData';

export function OrganizationDialog({
  canDeleteOrganization = true,
  deleteContext,
  dialog,
  onClose,
  onDelete,
  onSave,
  organizationDescription,
  organizationName,
  selectedName,
  selectedRow,
}: {
  /**
   * The API lets only the ORG_ADMIN who created the organization, or a
   * platform administrator, delete it; anybody else would confirm and get a
   * refusal, so the button is not offered to them.
   */
  canDeleteOrganization?: boolean;
  deleteContext: DeleteContext;
  dialog: Exclude<OrganizationDialogKind, null>;
  onClose: () => void;
  onDelete: (context: Exclude<DeleteContext, null>) => void;
  onSave: (data: FormData) => void;
  organizationDescription: string;
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
                  : `Remove ${selectedName} from ${organizationName}?`,
                deletingOrganization
                  ? 'Members lose organization access and its tickets can no longer be changed.'
                  : 'This removes organization access. It does not delete the platform account.',
                deletingOrganization ? 'Delete organization' : 'Remove member',
              ];
  const isDeleteConfirmed =
    dialog !== 'delete' ||
    !deletingOrganization ||
    confirmation === organizationName;

  return (
    <Dialog
      description={config[1]}
      eyebrow="ORGANIZATION"
      footer={
        <>
          {dialog === 'edit-member' ||
          (dialog === 'settings' && canDeleteOrganization) ? (
            <Button
              className="mr-auto max-md:mr-0 max-md:w-full"
              onClick={() => onDelete(dialog as Exclude<DeleteContext, null>)}
              variant="destructive"
            >
              {dialog === 'edit-member' ? 'Remove' : 'Delete'}
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
          <Alert tone="danger">
            The member loses access to this organization. Their platform account
            and data are not deleted.
          </Alert>
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
            <option>Member</option>
            <option>Organization admin</option>
          </SelectField>
          <Alert>
            Ticket access comes from the selected role. The production backend
            will validate the invitation and send it by email.
          </Alert>
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
            defaultValue={organizationDescription}
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
            <option>Member</option>
            <option>Organization admin</option>
          </SelectField>
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
        </>
      )}
    </Dialog>
  );
}
