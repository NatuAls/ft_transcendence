import { Alert, Button, Dialog, EmptyState, Icon, TextField } from 'ui';
import { useMemo, useState } from 'react';
import { getInitials } from '../../app/text';
import {
  initialOrganizations,
  normalizeWorkspaceSlug,
} from './organizationsData';

export function OrganizationsPage({
  onOpen,
}: {
  onOpen: (organizationName: string) => void;
}) {
  const [create, setCreate] = useState(false);
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [createError, setCreateError] = useState('');
  const [feedback, setFeedback] = useState('');
  const visibleOrganizations = useMemo(
    () =>
      organizations.filter((organization) =>
        organization[1].toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [organizations, query],
  );

  function closeCreate() {
    setCreate(false);
    setName('');
    setSlug('');
    setCreateError('');
  }

  function createOrganization() {
    const trimmedName = name.trim();
    if (!trimmedName || !slug.trim()) return;
    if (
      organizations.some(
        (organization) =>
          organization[1].toLowerCase() === trimmedName.toLowerCase(),
      )
    ) {
      setCreateError('An organization with this name already exists.');
      return;
    }
    const initials = getInitials(trimmedName);
    setOrganizations((current) => [
      ...current,
      [
        initials,
        trimmedName,
        'Organization admin',
        '1 member · 0 open tickets',
        'Just now',
      ],
    ]);
    setFeedback(`${trimmedName} was created in this frontend preview.`);
    closeCreate();
  }

  return (
    <div className="mx-auto max-w-[1000px] p-10 max-md:px-4 max-md:py-6">
      <header className="flex items-end justify-between max-md:items-start">
        <div>
          <span className="text-[10px] tracking-[.08em] text-muted">
            ORGANIZATIONS
          </span>
          <h1 className="my-2 text-[30px] font-medium max-md:text-[22px]">
            Organizations
          </h1>
          <p className="text-[13px] text-muted max-md:hidden">
            Create workspaces and manage the organizations you belong to.
          </p>
        </div>
        <Button
          className="max-md:!min-h-9 max-md:!px-2.5"
          onClick={() => setCreate(true)}
        >
          New organization
        </Button>
      </header>
      <div className="my-4 mt-7 flex items-center gap-5">
        <label className="flex h-[42px] flex-1 items-center rounded-sm border border-border bg-surface px-[13px] py-2.5 focus-within:border-focus focus-within:outline-3 focus-within:outline-focus/20">
          <Icon className="mr-1" name="search" size={15} />{' '}
          <span className="sr-only">Search organizations</span>
          <input
            className="w-[90%] border-0 bg-transparent outline-0"
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
            key={organization[1]}
          >
            <span className="grid size-12 place-items-center rounded-md bg-[#d8e5df] text-primary">
              {organization[0]}
            </span>
            <div>
              <h2 className="mb-[5px] text-base font-medium">
                {organization[1]}
              </h2>
              <strong className="text-[10px] text-primary">
                {organization[2]}
              </strong>
              <p className="my-[5px] text-[10px] text-muted">
                {organization[3]}
              </p>
            </div>
            <div className="text-right max-md:col-span-full max-md:flex max-md:items-center max-md:justify-end max-md:gap-2.5 max-md:[&>small]:hidden max-md:[&>p]:hidden">
              <small className="text-[9px] text-muted">Last activity</small>
              <p className="text-[10px] text-muted">{organization[4]}</p>
              <Button
                onClick={() => onOpen(organization[1])}
                variant="secondary"
              >
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
          description="New organizations start with you as their administrator."
          eyebrow="ORGANIZATIONS"
          footer={
            <>
              <Button onClick={closeCreate} variant="secondary">
                Cancel
              </Button>
              <Button disabled={!name.trim() || !slug.trim()} type="submit">
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
              const nextName = event.target.value;
              setName(nextName);
              setCreateError('');
              setSlug(normalizeWorkspaceSlug(nextName));
            }}
            placeholder="Example: Acme Support"
            required
            value={name}
          />
          <TextField
            label="Workspace URL"
            onChange={(event) =>
              setSlug(normalizeWorkspaceSlug(event.target.value))
            }
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            placeholder="acme-support"
            required
            value={slug}
          />
          <small className="-mt-2 text-[11px] text-muted">
            helpdesk.local/{slug || 'workspace-name'}
          </small>
          <p className="text-xs leading-[1.5] text-muted">
            This unique slug identifies the workspace address. Lowercase
            letters, numbers and single hyphens are allowed.
          </p>
          {createError ? <Alert tone="danger">{createError}</Alert> : null}
        </Dialog>
      ) : null}
    </div>
  );
}
