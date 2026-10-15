import { Alert, Button, Dialog, SelectField, TextField } from 'ui';
import { useEffect, useRef, useState } from 'react';
import type { OrgRole } from 'contracts';
import { useTranslation } from '../../core/i18n';
import type {
  CategoryRow,
  DeleteContext,
  MemberRow,
  OrganizationDialogKind,
} from './organizationData';

// El valor de cada opción es el código del rol; la etiqueta, su traducción.
const ROLE_OPTIONS: OrgRole[] = ['AGENT', 'MEMBER', 'ORG_ADMIN'];

export function OrganizationDialog({
  canDeleteOrganization = true,
  deleteContext,
  dialog,
  editingSelf = false,
  onClose,
  onDelete,
  onSave,
  organizationDescription,
  organizationName,
  selectedCategory,
  selectedMember,
  selectedName,
}: {
  /**
   * The API lets only the ORG_ADMIN who created the organization, or a
   * platform administrator, delete it; anybody else would confirm and get a
   * refusal, so the button is not offered to them.
   */
  canDeleteOrganization?: boolean;
  deleteContext: DeleteContext;
  dialog: Exclude<OrganizationDialogKind, null>;
  /**
   * El miembro que se está editando eres tú.
   *
   * Bajarse el rol a uno mismo no tiene vuelta —cambiar roles exige ser
   * administrador—, así que quien lo hacía quedaba dentro de la organización
   * sin poder gestionar nada ni deshacerlo. La API lo rechaza
   * (`ORG_CANNOT_LOWER_OWN_ROLE`); aquí, además, no se ofrece: ni el
   * desplegable ni el botón de quitar, y se dice por qué. Irse de la
   * organización es una decisión aparte, con su propia acción.
   */
  editingSelf?: boolean;
  onClose: () => void;
  onDelete: (context: Exclude<DeleteContext, null>) => void;
  onSave: (data: FormData) => void;
  organizationDescription: string;
  organizationName: string;
  selectedCategory?: CategoryRow;
  selectedMember?: MemberRow;
  selectedName: string;
}) {
  const { t } = useTranslation();
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
  const values = { name: selectedName, organization: organizationName };
  const section =
    dialog === 'add-member'
      ? 'addMember'
      : dialog === 'edit-member'
        ? 'editMember'
        : dialog === 'settings'
          ? 'settings'
          : dialog === 'category'
            ? 'category'
            : deletingOrganization
              ? 'deleteOrganization'
              : 'removeMember';
  const config = [
    section === 'category'
      ? t(
          selectedName
            ? 'organization.dialog.category.titleEdit'
            : 'organization.dialog.category.titleCreate',
        )
      : t(`organization.dialog.${section}.title`, values),
    t(`organization.dialog.${section}.description`, values),
    t(`organization.dialog.${section}.submit`),
  ];
  const isDeleteConfirmed =
    dialog !== 'delete' ||
    !deletingOrganization ||
    confirmation === organizationName;

  return (
    <Dialog
      description={config[1]}
      eyebrow={t('organization.eyebrow')}
      footer={
        <>
          {(dialog === 'edit-member' && !editingSelf) ||
          (dialog === 'settings' && canDeleteOrganization) ? (
            <Button
              className="mr-auto max-md:mr-0 max-md:w-full"
              onClick={() => onDelete(dialog as Exclude<DeleteContext, null>)}
              variant="destructive"
            >
              {dialog === 'edit-member'
                ? t('organization.dialog.remove')
                : t('organization.dialog.delete')}
            </Button>
          ) : null}
          <Button disabled={submitting} onClick={onClose} variant="secondary">
            {t('common.actions.cancel')}
          </Button>
          <Button
            disabled={!isDeleteConfirmed || submitting}
            type="submit"
            variant={dialog === 'delete' ? 'destructive' : 'primary'}
          >
            {submitting
              ? dialog === 'add-member'
                ? t('organization.dialog.sending')
                : t('organization.dialog.saving')
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
            label={t('organization.dialog.deleteOrganization.confirmLabel')}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={organizationName}
            required
            value={confirmation}
          />
        ) : (
          <Alert tone="danger">
            {t('organization.dialog.removeMember.warning')}
          </Alert>
        )
      ) : dialog === 'add-member' ? (
        <>
          <TextField
            label={t('organization.dialog.email')}
            name="email"
            placeholder={t('organization.dialog.emailPlaceholder')}
            required
            type="email"
          />
          <SelectField label={t('organization.dialog.role')} name="role">
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {t(`organization.role.${role}`)}
              </option>
            ))}
          </SelectField>
          <Alert>{t('organization.dialog.addMember.note')}</Alert>
        </>
      ) : dialog === 'settings' ? (
        <>
          <TextField
            defaultValue={organizationName}
            label={t('organization.dialog.organizationName')}
            name="organization-name"
            required
          />
          <TextField
            defaultValue={organizationDescription}
            label={t('organization.dialog.description')}
            name="description"
          />
        </>
      ) : dialog === 'edit-member' ? (
        <>
          <TextField
            disabled
            label={t('organization.dialog.member')}
            value={selectedName}
          />
          <SelectField
            defaultValue={selectedMember?.role}
            disabled={editingSelf}
            label={t('organization.dialog.role')}
            name="role"
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {t(`organization.role.${role}`)}
              </option>
            ))}
          </SelectField>
          {editingSelf ? (
            <Alert title={t('organization.dialog.ownAccess.title')}>
              {t('organization.dialog.ownAccess.text')}
            </Alert>
          ) : null}
        </>
      ) : (
        <>
          <TextField
            defaultValue={selectedCategory?.name ?? ''}
            label={t('organization.dialog.categoryName')}
            name="category-name"
            required
          />
          <TextField
            defaultValue={selectedCategory?.description ?? ''}
            label={t('organization.dialog.description')}
            name="description"
            required
          />
        </>
      )}
    </Dialog>
  );
}
