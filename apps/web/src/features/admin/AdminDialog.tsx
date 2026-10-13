import { Alert, Button, Dialog, SelectField, TextField } from 'ui';
import { useState } from 'react';
import type { OrgRole } from 'contracts';
import { useTranslation } from '../../core/i18n';
import type { AdminDialogKind, AdminUser, PlatformAccess } from './adminData';

// Las opciones llevan el código como valor y el texto traducido como etiqueta:
// el formulario envía lo mismo en cualquier idioma.
const ORGANIZATION_ROLES: OrgRole[] = ['MEMBER', 'AGENT', 'ORG_ADMIN'];

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
  /** The account being edited; an invitation has none yet. */
  user?: AdminUser;
}) {
  const { t } = useTranslation();
  const create = kind === 'create' || !user;
  const name = user?.name ?? '';
  const [platformAccess, setPlatformAccess] = useState<PlatformAccess>(
    create ? 'USER' : user.role,
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (confirmingDelete && onDelete) {
    return (
      <Dialog
        className="max-w-[500px]"
        description={t('admin.userDialog.deleteConfirm.description', { name })}
        eyebrow={t('admin.eyebrow')}
        footer={
          <>
            <Button
              onClick={() => setConfirmingDelete(false)}
              variant="secondary"
            >
              {t('admin.userDialog.deleteConfirm.keep')}
            </Button>
            <Button type="submit" variant="destructive">
              {t('admin.userDialog.deleteConfirm.confirm')}
            </Button>
          </>
        }
        onClose={onClose}
        onSubmit={(event) => {
          event.preventDefault();
          onDelete();
        }}
        title={t('admin.userDialog.deleteConfirm.title', { name })}
      />
    );
  }

  return (
    <Dialog
      className="max-w-[500px]"
      description={
        create
          ? t('admin.userDialog.inviteDescription')
          : t('admin.userDialog.editDescription', { name })
      }
      eyebrow={t('admin.eyebrow')}
      footer={
        <>
          {!create && onDelete ? (
            <Button
              className="mr-auto max-md:mr-0 max-md:w-full"
              onClick={() => setConfirmingDelete(true)}
              variant="destructive"
            >
              {t('admin.userDialog.delete')}
            </Button>
          ) : null}
          <Button onClick={onClose} variant="secondary">
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit">
            {create ? t('admin.userDialog.send') : t('admin.userDialog.save')}
          </Button>
        </>
      }
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        onSave(new FormData(event.currentTarget));
      }}
      title={
        create
          ? t('admin.userDialog.inviteTitle')
          : t('admin.userDialog.editTitle')
      }
    >
      {create ? null : (
        <TextField
          defaultValue={name}
          label={t('admin.userDialog.fullName')}
          name="name"
          required
        />
      )}
      <TextField
        defaultValue={create ? '' : user.email}
        disabled={!create && locked?.email}
        label={t('admin.userDialog.email')}
        name="email"
        required
        type="email"
      />
      <SelectField
        disabled={!create && locked?.role}
        label={t('admin.userDialog.platformAccess')}
        name="role"
        onChange={(event) =>
          setPlatformAccess(event.target.value as PlatformAccess)
        }
        value={platformAccess}
      >
        <option value="USER">{t('admin.platformRole.USER')}</option>
        <option value="GLOBAL_ADMIN">
          {t('admin.platformRole.GLOBAL_ADMIN')}
        </option>
      </SelectField>
      {create && platformAccess === 'USER' ? (
        <>
          <SelectField
            label={t('admin.userDialog.initialOrganization')}
            name="organization"
          >
            {organizationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t('admin.userDialog.organizationRole')}
            name="organization-role"
          >
            {ORGANIZATION_ROLES.map((role) => (
              <option key={role} value={role}>
                {t(`organization.role.${role}`)}
              </option>
            ))}
          </SelectField>
        </>
      ) : null}
      {!create ? (
        <SelectField
          defaultValue={user.state}
          disabled={locked?.state}
          label={t('admin.userDialog.accountState')}
          name="state"
        >
          <option value="ACTIVE">{t('admin.accountState.ACTIVE')}</option>
          <option value="SUSPENDED">{t('admin.accountState.SUSPENDED')}</option>
        </SelectField>
      ) : null}
      <Alert>
        {create
          ? platformAccess === 'GLOBAL_ADMIN'
            ? t('admin.userDialog.notes.globalAdmin')
            : t('admin.userDialog.notes.standardUser')
          : (locked?.reason ?? t('admin.userDialog.notes.edit'))}
      </Alert>
    </Dialog>
  );
}
