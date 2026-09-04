import { Dialog } from 'ui';
import { useMemo, useRef, useState } from 'react';
import type { AppRoute, Navigate } from '../app/routes';

const searchItems: Array<{
  description: string;
  label: string;
  params?: Record<string, string>;
  route: AppRoute;
}> = [
  {
    description: 'Main section · All organization requests',
    label: 'Tickets',
    route: 'tickets',
  },
  {
    description: 'Main section · Colleagues and connections',
    label: 'People',
    route: 'people',
  },
  {
    description: 'Main section · Conversations',
    label: 'Messages',
    route: 'messages',
  },
  {
    description: 'Ticket HD-0242 · Billing',
    label: 'Payment page unavailable',
    params: { id: 'HD-0242' },
    route: 'ticket-detail',
  },
  {
    description: 'Ticket HD-0243 · Organization',
    label: 'Update organization details',
    params: { id: 'HD-0243' },
    route: 'ticket-detail',
  },
  {
    description: 'Colleague · Support agent',
    label: 'Maya Singh',
    params: { person: 'Maya Singh' },
    route: 'people-profile',
  },
  {
    description: 'Account settings',
    label: 'Privacy & data',
    route: 'account/privacy',
  },
  {
    description: 'Workspace administration',
    label: 'Northstar Studio',
    route: 'organization',
  },
  {
    description: 'Organization switcher and creation',
    label: 'Organizations',
    route: 'organizations',
  },
];

export function GlobalSearchDialog({
  onClose,
  onNavigate,
  organizationName,
}: {
  onClose: () => void;
  onNavigate: Navigate;
  organizationName: string;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const items = searchItems.map((item) =>
      item.route === 'organization'
        ? { ...item, label: organizationName }
        : item,
    );
    if (!normalized) return items;
    return items.filter((item) =>
      `${item.label} ${item.description}`.toLowerCase().includes(normalized),
    );
  }, [organizationName, query]);

  function navigate(route: AppRoute, params?: Record<string, string>) {
    onClose();
    onNavigate(route, params);
  }

  return (
    <Dialog
      className="global-search"
      description="Search tickets, people and workspace settings."
      initialFocusRef={inputRef}
      onClose={onClose}
      title="Search HelpDesk Lite"
    >
      <div className="global-search__field">
        <label className="sr-only" htmlFor="global-search-input">
          Search
        </label>
        <span aria-hidden="true">⌕</span>
        <input
          id="global-search-input"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title, ID, person or setting"
          ref={inputRef}
          type="search"
          value={query}
        />
        {query ? (
          <button
            aria-label="Clear search"
            className="global-search__clear"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            type="button"
          >
            ×
          </button>
        ) : null}
      </div>
      <div aria-live="polite" className="global-search__results">
        {results.map((item) => (
          <button
            key={`${item.route}-${item.label}`}
            onClick={() => navigate(item.route, item.params)}
            type="button"
          >
            <strong>{item.label}</strong>
            <span>{item.description}</span>
            <i aria-hidden="true">→</i>
          </button>
        ))}
        {!results.length ? (
          <p>No results. Try a ticket ID, person or setting.</p>
        ) : null}
      </div>
    </Dialog>
  );
}
