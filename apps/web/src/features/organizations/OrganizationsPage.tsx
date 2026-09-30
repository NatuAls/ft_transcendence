import { Alert, Button, Dialog, EmptyState, Icon, TextField } from 'ui';
import { useMemo, useState } from 'react';
import type { ViewerSession } from '../../app/session';
import {
  getOrganizationInitials,
  normalizeOrganizationSlug,
  organizationsForViewer,
  type OrganizationSummary,
} from './organizationsData';

export function OrganizationsPage({
  onOpen,
  viewer,
}: {
  onOpen: (organization: OrganizationSummary) => void;
  viewer: ViewerSession;
}) {
  const platformView = viewer.globalRole === 'GLOBAL_ADMIN';
  const [create, setCreate] = useState(false);
  const [organizations, setOrganizations] = useState(() =>
    organizationsForViewer(viewer),
  );
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

  function createOrganization() {
    const trimmedName = name.trim();
    const trimmedAdministratorEmail = administratorEmail.trim();
    if (!trimmedName || !slug || !trimmedAdministratorEmail) return;
    if (
      organizations.some(
        (organization) =>
          organization.name.toLowerCase() === trimmedName.toLowerCase() ||
          organization.slug === slug,
      )
    ) {
      setCreateError('An organization with this name or URL already exists.');
      return;
    }
    const createdOrganization: OrganizationSummary = {
      description:
        description.trim() || 'Organization support and service requests.',
      id: `preview-${slug}`,
      initials: getOrganizationInitials(trimmedName),
      name: trimmedName,
      roleLabel: 'Platform access',
      slug,
      summary: `Administrator invitation pending · ${trimmedAdministratorEmail}`,
    };
    setOrganizations((current) => [...current, createdOrganization]);
    setFeedback(
      `${trimmedName} was created and its administrator invitation was prepared in this frontend preview.`,
    );
    closeCreate();
  }

  return (
    <div className="mx-auto max-w-[1000px] p-10 max-md:px-4 max-md:py-6">
      <header className="flex items-end justify-between max-md:items-start">
        <div>
          <span className="text-[10px] tracking-[.08em] text-muted">
            {platformView ? 'PLATFORM' : 'ORGANIZATIONS'}
          </span>
          <h1 className="my-2 text-[30px] font-medium max-md:text-[22px]">
            {platformView ? 'Organizations' : 'Your organizations'}
          </h1>
          <p className="text-[13px] text-muted max-md:hidden">
            {platformView
              ? 'Review organizations configured on the platform.'
              : 'Choose an organization to continue with your assigned access.'}
          </p>
        </div>
        {platformView ? (
          <Button
            className="max-md:!min-h-9 max-md:!px-2.5"
            onClick={() => setCreate(true)}
          >
            New organization
          </Button>
        ) : null}
      </header>
      <div className="my-4 mt-7 flex items-center gap-5">
        <label className="flex h-[42px] flex-1 items-center rounded-sm border border-border bg-surface px-[13px] py-2.5 focus-within:border-focus focus-within:outline-3 focus-within:outline-focus/20">
          <Icon className="mr-1" name="search" size={15} />{' '}
          <span className="sr-only">Search organizations</span>
          <input
            className="w-[90%] border-0 bg-transparent outline-0 focus-visible:!outline-none"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search organizations"
            type="search"
            value={query}
          />
        </label>
        <span className="text-[11px] text-muted">
          {visibleOrganizations.length} organizations
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
            <span className="grid size-12 place-items-center rounded-md bg-[#d8e5df] text-primary">
              {organization.initials}
            </span>
            <div>
              <h2 className="mb-[5px] text-base font-medium">
                {organization.name}
              </h2>
              <strong className="text-[10px] text-primary">
                {organization.roleLabel}
              </strong>
              <p className="my-[5px] text-[10px] text-muted">
                {organization.description}
              </p>
              <p className="text-[10px] text-muted">{organization.summary}</p>
            </div>
            <div className="text-right max-md:col-span-full max-md:flex max-md:items-center max-md:justify-end max-md:gap-2.5">
              <Button onClick={() => onOpen(organization)} variant="secondary">
                Open organization
              </Button>
            </div>
          </article>
        ))}
        {!visibleOrganizations.length ? (
          <EmptyState
            description="Try another search."
            title="No organizations found"
          />
        ) : null}
      </section>
      {create ? (
        <Dialog
          description="Create the organization and prepare an invitation for its first administrator."
          eyebrow="ORGANIZATIONS"
          footer={
            <>
              <Button onClick={closeCreate} variant="secondary">
                Cancel
              </Button>
              <Button
                disabled={!name.trim() || !slug || !administratorEmail.trim()}
                type="submit"
              >
                Create organization
              </Button>
            </>
          }
          onClose={closeCreate}
          onSubmit={(event) => {
            event.preventDefault();
            createOrganization();
          }}
          title="Create an organization"
        >
          <TextField
            label="Organization name"
            onChange={(event) => {
              setName(event.target.value);
              setCreateError('');
            }}
            placeholder="Example: Acme Support"
            required
            value={name}
          />
          <TextField
            label="Description"
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What this organization supports"
            value={description}
          />
          <TextField
            label="Initial organization administrator"
            onChange={(event) => setAdministratorEmail(event.target.value)}
            placeholder="admin@company.com"
            required
            type="email"
            value={administratorEmail}
          />
          <div className="grid gap-1.5 rounded-sm border border-border bg-surface-secondary px-3.5 py-3">
            <span className="text-xs font-medium">Organization URL</span>
            <code className="overflow-hidden text-xs text-ellipsis text-muted">
              helpdesk.local/{slug || 'organization-name'}
            </code>
            <small className="text-[10px] text-muted">
              Generated automatically. The backend remains responsible for
              uniqueness.
            </small>
          </div>
          {createError ? <Alert tone="danger">{createError}</Alert> : null}
        </Dialog>
      ) : null}
    </div>
  );
}
