import { Dialog, EmptyState, Icon, IconButton } from 'ui';
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
      className="max-w-[640px]"
      description="Search tickets, people and workspace settings."
      initialFocusRef={inputRef}
      onClose={onClose}
      title="Search HelpDesk Lite"
    >
      <div className="grid h-[50px] grid-cols-[24px_1fr_auto] items-center gap-2 rounded-sm border border-border bg-[#f7faf8] px-[14px] focus-within:border-focus focus-within:outline-3 focus-within:outline-focus/20">
        <label className="sr-only" htmlFor="global-search-input">
          Search
        </label>
        <Icon name="search" size={18} />
        <input
          className="h-full min-w-0 border-0 bg-transparent outline-0 focus-visible:!outline-none"
          id="global-search-input"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title, ID, person or setting"
          ref={inputRef}
          inputMode="search"
          role="searchbox"
          type="text"
          value={query}
        />
        {query ? (
          <IconButton
            icon="close"
            label="Clear search"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            size="sm"
          />
        ) : null}
      </div>
      <div aria-live="polite" className="grid gap-1">
        {results.map((item) => (
          <button
            className="grid min-h-[60px] grid-cols-[1fr_28px] items-center gap-x-3 gap-y-1 rounded-sm px-3 py-2.5 text-left hover:bg-surface-secondary"
            key={`${item.route}-${item.label}`}
            onClick={() => navigate(item.route, item.params)}
            type="button"
          >
            <strong className="col-start-1 text-[13px]">{item.label}</strong>
            <span className="col-start-1 text-[11px] text-muted">
              {item.description}
            </span>
            <Icon
              className="col-start-2 row-span-2"
              name="chevron-right"
              size={18}
            />
          </button>
        ))}
        {!results.length ? (
          <EmptyState
            description="Try a ticket ID, person or setting."
            title="No results"
          />
        ) : null}
      </div>
    </Dialog>
  );
}
