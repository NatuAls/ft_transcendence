import { Alert, Button, Dialog, EmptyState, Icon, TextField } from 'ui';
import { useMemo, useState } from 'react';
import { emailSchema } from 'contracts';
import * as organizationsApi from '../../api/organizations';
import { assignOrganizationRole } from '../../api/roles';
import { previewMode, type ViewerSession } from '../../app/session';
import { errorKey } from '../../core/api/errors';
import { useTranslation } from '../../core/i18n';
import { organizationRoleLabel } from '../roles/rolesGateway';
import {
  getOrganizationInitials,
  normalizeOrganizationSlug,
  organizationsForViewer,
  type OrganizationSummary,
} from './organizationsData';

export function OrganizationsPage({
  isPlatformAdmin = false,
  onOpen,
  onOrganizationsChanged,
  organizations: liveOrganizations,
  viewer,
}: {
  /**
   * The platform view: every organization, and creating new ones. Decided by
   * `can()` in the shell, not here by comparing the text of a role.
   */
  isPlatformAdmin?: boolean;
  onOpen: (organization: OrganizationSummary) => void;
  /** An organization was created: read the list again and switch to it. */
  onOrganizationsChanged: (preferredId?: string) => void;
  /** The organizations the session knows about (from the API). */
  organizations: OrganizationSummary[];
  viewer: ViewerSession;
}) {
  const { t } = useTranslation();
  const platformView = isPlatformAdmin;
  const [create, setCreate] = useState(false);
  // The preview keeps its own sample list; the application uses the one the
  // session loaded from the API. The sample list is only built in the preview:
  // outside it the catalogue is keyed by sample identifiers, so asking it about
  // a real organization drops it.
  const [previewOrganizations, setPreviewOrganizations] = useState(() =>
    previewMode ? organizationsForViewer(viewer) : [],
  );
  const organizations = previewMode ? previewOrganizations : liveOrganizations;
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [administratorEmail, setAdministratorEmail] = useState('');
  const [createError, setCreateError] = useState('');
  const [feedback, setFeedback] = useState('');
  const slug = normalizeOrganizationSlug(name);
  const visibleOrganizations = useMemo(
    () =>
      organizations.filter((organization) =>
        `${organization.name} ${organization.description}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [organizations, query],
  );

  function closeCreate() {
    setCreate(false);
    setName('');
    setDescription('');
    setAdministratorEmail('');
    setCreateError('');
  }

  async function createOrganization() {
    const trimmedName = name.trim();
    const trimmedAdministratorEmail = administratorEmail.trim();
    if (!trimmedName || !slug || !trimmedAdministratorEmail) return;
    const parsedEmail = emailSchema.safeParse(trimmedAdministratorEmail);
    if (!parsedEmail.success) {
      setCreateError(t('organization.create.invalidEmail'));
      return;
    }
    if (
      organizations.some(
        (organization) =>
          organization.name.toLowerCase() === trimmedName.toLowerCase() ||
          organization.slug === slug,
      )
    ) {
      setCreateError(t('organization.create.duplicate'));
      return;
    }
    if (previewMode) {
      const createdOrganization: OrganizationSummary = {
        counts: null,
        description: description.trim(),
        id: `preview-${slug}`,
        initials: getOrganizationInitials(trimmedName),
        name: trimmedName,
        pendingAdministrator: trimmedAdministratorEmail,
        role: null,
        slug,
      };
      setPreviewOrganizations((current) => [...current, createdOrganization]);
      setFeedback(
        t('organization.create.createdPreview', { name: trimmedName }),
      );
      closeCreate();
      return;
    }

    setSubmitting(true);
    setCreateError('');
    let created: organizationsApi.OrganizationRecord;
    try {
      created = await organizationsApi.createOrganization({
        description: description.trim() || undefined,
        name: trimmedName,
      });
    } catch (error) {
      setCreateError(t(errorKey(error)));
      setSubmitting(false);
      return;
    }
    // The first administrator enters through the role assignment by e-mail:
    // at once if the address has a confirmed account, otherwise when its
    // owner creates the account with it and confirms it.
    try {
      const assignment = await assignOrganizationRole(created.id, {
        email: parsedEmail.data,
        role: 'ORG_ADMIN',
      });
      setFeedback(
        assignment.outcome === 'RESERVED'
          ? t('organization.create.createdReserved', {
              email: parsedEmail.data,
              name: created.name,
            })
          : t('organization.create.createdApplied', {
              administrator: assignment.user?.displayName ?? parsedEmail.data,
              name: created.name,
            }),
      );
    } catch (error) {
      setFeedback(
        t('organization.create.createdWithoutAdministrator', {
          name: created.name,
          reason: t(errorKey(error)),
        }),
      );
    }
    setSubmitting(false);
    closeCreate();
    onOrganizationsChanged(created.id);
  }

  return (
    <div className="mx-auto max-w-[1000px] p-10 max-md:px-4 max-md:py-6">
      <header className="flex items-end justify-between max-md:items-start">
        <div>
          <span className="text-2xs tracking-[.08em] text-muted">
            {platformView
              ? t('organization.list.eyebrowPlatform')
              : t('organization.list.eyebrow')}
          </span>
          <h1 className="my-2 text-[1.875rem] font-medium max-md:text-[1.375rem]">
            {platformView
              ? t('organization.list.titlePlatform')
              : t('organization.list.title')}
          </h1>
          <p className="text-[0.8125rem] text-muted max-md:hidden">
            {platformView
              ? t('organization.list.descriptionPlatform')
              : t('organization.list.description')}
          </p>
        </div>
        {platformView ? (
          <Button
            className="max-md:!min-h-9 max-md:!px-2.5"
            onClick={() => setCreate(true)}
          >
            {t('organization.list.new')}
          </Button>
        ) : null}
      </header>
      <div className="my-4 mt-7 flex items-center gap-5">
        <label className="flex h-[42px] flex-1 items-center rounded-sm border border-border bg-surface px-[13px] py-2.5 focus-within:border-focus focus-within:outline-3 focus-within:outline-focus">
          <Icon className="mr-1" name="search" size={15} />{' '}
          <span className="sr-only">{t('organization.list.search')}</span>
          <input
            className="w-[90%] border-0 bg-transparent outline-0 focus-visible:!outline-none"
            name="organizationSearch"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('organization.list.search')}
            type="search"
            value={query}
          />
        </label>
        <span className="text-xs2 text-muted">
          {t('organization.list.count', {
            count: visibleOrganizations.length,
          })}
        </span>
      </div>
      {feedback ? (
        <Alert
          aria-live="polite"
          className="-mt-1 mb-4"
          role="status"
          tone="success"
        >
          {feedback}
        </Alert>
      ) : null}
      <section className="grid gap-3">
        {visibleOrganizations.map((organization) => (
          <article
            className="grid grid-cols-[56px_1fr_auto] items-center gap-4 rounded-md border border-border bg-surface p-5 max-md:grid-cols-[48px_1fr]"
            key={organization.id}
          >
            <span className="grid size-12 place-items-center rounded-md bg-surface-secondary text-primary">
              {organization.initials}
            </span>
            <div>
              <h2 className="mb-[5px] text-base font-medium">
                {organization.name}
              </h2>
              <strong className="text-2xs text-primary">
                {organization.role
                  ? organizationRoleLabel(organization.role)
                  : t('organization.list.platformAccess')}
              </strong>
              <p className="my-[5px] text-2xs text-muted">
                {organization.description ||
                  t('organization.defaultDescription')}
              </p>
              <p className="text-2xs text-muted">
                {organization.pendingAdministrator
                  ? t('organization.list.pendingAdministrator', {
                      email: organization.pendingAdministrator,
                    })
                  : organization.counts
                    ? `${t('organization.members', {
                        count: organization.counts.members,
                      })} · ${t('organization.tickets', {
                        count: organization.counts.tickets,
                      })}`
                    : t('organization.list.yours')}
              </p>
            </div>
            <div className="text-right max-md:col-span-full max-md:flex max-md:items-center max-md:justify-end max-md:gap-2.5">
              <Button onClick={() => onOpen(organization)} variant="secondary">
                {t('organization.list.open')}
              </Button>
            </div>
          </article>
        ))}
        {!visibleOrganizations.length ? (
          organizations.length ? (
            <EmptyState
              description={t('organization.list.noResults.description')}
              title={t('organization.list.noResults.title')}
            />
          ) : (
            <EmptyState
              description={
                platformView
                  ? t('organization.list.none.descriptionPlatform')
                  : t('organization.list.none.description')
              }
              title={t('organization.list.none.title')}
            />
          )
        ) : null}
      </section>
      {create ? (
        <Dialog
          description={t('organization.create.description')}
          eyebrow={t('organization.list.eyebrow')}
          footer={
            <>
              <Button onClick={closeCreate} variant="secondary">
                {t('common.actions.cancel')}
              </Button>
              <Button
                disabled={
                  submitting ||
                  !name.trim() ||
                  !slug ||
                  !administratorEmail.trim()
                }
                type="submit"
              >
                {submitting
                  ? t('organization.create.submitting')
                  : t('organization.create.submit')}
              </Button>
            </>
          }
          onClose={closeCreate}
          onSubmit={(event) => {
            event.preventDefault();
            void createOrganization();
          }}
          title={t('organization.create.title')}
        >
          <TextField
            label={t('organization.create.name')}
            onChange={(event) => {
              setName(event.target.value);
              setCreateError('');
            }}
            placeholder={t('organization.create.namePlaceholder')}
            required
            value={name}
          />
          <TextField
            label={t('organization.create.descriptionLabel')}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('organization.create.descriptionPlaceholder')}
            value={description}
          />
          <TextField
            label={t('organization.create.administrator')}
            onChange={(event) => setAdministratorEmail(event.target.value)}
            placeholder={t('organization.create.administratorPlaceholder')}
            required
            type="email"
            value={administratorEmail}
          />
          <div className="grid gap-1.5 rounded-sm border border-border bg-surface-secondary px-3.5 py-3">
            <span className="text-xs font-medium">
              {t('organization.create.url')}
            </span>
            <code className="overflow-hidden text-xs text-ellipsis text-muted">
              helpdesk.local/{slug || t('organization.create.urlPlaceholder')}
            </code>
            <small className="text-2xs text-muted">
              {t('organization.create.urlHelp')}
            </small>
          </div>
          {createError ? <Alert tone="danger">{createError}</Alert> : null}
        </Dialog>
      ) : null}
    </div>
  );
}
