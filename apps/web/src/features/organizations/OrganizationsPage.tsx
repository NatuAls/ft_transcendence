import { Button, Dialog, TextField } from 'ui';
import { useMemo, useState } from 'react';
import { getInitials } from '../../app/text';
import {
  initialOrganizations,
  normalizeWorkspaceSlug,
} from './organizationsData';
import './organizations.css';

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
    <div className="organizations-page">
      <header>
        <div>
          <span>ORGANIZATIONS</span>
          <h1>Organizations</h1>
          <p>Create workspaces and manage the organizations you belong to.</p>
        </div>
        <Button onClick={() => setCreate(true)}>New organization</Button>
      </header>
      <div className="organizations-toolbar">
        <label>
          <span aria-hidden="true">⌕</span>{' '}
          <span className="sr-only">Search organizations</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search organizations"
            type="search"
            value={query}
          />
        </label>
        <span>{visibleOrganizations.length} organizations</span>
      </div>
      {feedback ? (
        <p aria-live="polite" className="organizations-feedback" role="status">
          {feedback}
        </p>
      ) : null}
      <section>
        {visibleOrganizations.map((organization) => (
          <article key={organization[1]}>
            <span>{organization[0]}</span>
            <div>
              <h2>{organization[1]}</h2>
              <strong>{organization[2]}</strong>
              <p>{organization[3]}</p>
            </div>
            <div>
              <small>Last activity</small>
              <p>{organization[4]}</p>
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
          <p className="organizations-empty">No organizations found.</p>
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
          <small className="organizations-url-preview">
            helpdesk.local/{slug || 'workspace-name'}
          </small>
          <p className="organizations-url-help">
            This unique slug identifies the workspace address. Lowercase
            letters, numbers and single hyphens are allowed.
          </p>
          {createError ? (
            <p className="organizations-create-error" role="alert">
              {createError}
            </p>
          ) : null}
        </Dialog>
      ) : null}
    </div>
  );
}
