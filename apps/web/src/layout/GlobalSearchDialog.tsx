import { Dialog, EmptyState, Icon, IconButton } from 'ui';
import { useEffect, useRef, useState } from 'react';
import type { AppRoute, Navigate } from '../app/routes';
import { searchPeople, type PublicPerson } from '../api/social';
import { searchTickets, type TicketData } from '../api/tickets';
import { useTranslation } from '../core/i18n';

type Result = {
  description: string;
  label: string;
  params: Record<string, string>;
  route: AppRoute;
};

export function GlobalSearchDialog({
  onClose,
  onNavigate,
  organizationId,
}: {
  onClose: () => void;
  onNavigate: Navigate;
  organizationId: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [people, setPeople] = useState<PublicPerson[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void Promise.all([
        searchTickets(organizationId, { q: term, take: 5 }, controller.signal),
        searchPeople(term),
      ])
        .then(([ticketResponse, personResponse]) => {
          setTickets(ticketResponse.data.slice(0, 5));
          setPeople(personResponse);
          setActiveIndex(0);
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted)
            console.error('Global search failed', error);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [organizationId, query]);

  const fixed: Result[] = [
    {
      label: t('nav.tickets'),
      description: t('search.organizationRequests'),
      params: {},
      route: 'tickets',
    },
    {
      label: t('nav.people'),
      description: t('search.colleagues'),
      params: {},
      route: 'people',
    },
    {
      label: t('nav.messages'),
      description: t('search.conversations'),
      params: {},
      route: 'messages',
    },
  ];
  const dynamic: Result[] = [
    ...tickets.map((ticket) => ({
      label: ticket.title,
      description: t('search.ticketDescription', {
        status: t(`tickets.status.${ticket.status}`),
      }),
      params: { id: ticket.id },
      route: 'ticket-detail' as const,
    })),
    ...people.map((person) => ({
      label: person.profile?.displayName ?? person.username,
      description: t('search.personDescription', { username: person.username }),
      params: { person: person.username },
      route: 'people-profile' as const,
    })),
  ];
  const results = query.trim() ? dynamic : fixed;

  function navigate(result: Result) {
    onClose();
    onNavigate(result.route, result.params);
  }

  return (
    <Dialog
      className="max-w-[640px]"
      description={t('search.description')}
      initialFocusRef={inputRef}
      onClose={onClose}
      title={t('search.title')}
    >
      <div className="flex h-[50px] items-center gap-3 rounded-sm border border-border bg-surface px-[14px] focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
        <label className="sr-only" htmlFor="global-search-input">
          {t('common.actions.search')}
        </label>
        <Icon className="shrink-0 text-muted" name="search" size={18} />
        <input
          className="min-w-0 flex-1 bg-transparent p-0 text-sm !border-none !shadow-none !outline-none focus:!border-none focus:!ring-0"
          id="global-search-input"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (!results.length) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((index) => (index + 1) % results.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex(
                (index) => (index - 1 + results.length) % results.length,
              );
            } else if (event.key === 'Enter') {
              event.preventDefault();
              navigate(results[activeIndex]);
            }
          }}
          placeholder={t('search.placeholder')}
          ref={inputRef}
          role="searchbox"
          type="text"
          value={query}
        />
        {query ? (
          <div className="shrink-0">
            <IconButton
              icon="close"
              label={t('search.clear')}
              onClick={() => setQuery('')}
              size="sm"
            />
          </div>
        ) : null}
      </div>
      <div aria-live="polite" className="grid gap-4">
        {!query.trim() ? (
          <div className="grid gap-1">
            <h3 className="px-3 text-xs font-medium text-muted">
              {t('search.sections')}
            </h3>
            {fixed.map((result, index) => (
              <SearchResult
                active={index === activeIndex}
                key={result.label}
                onClick={() => navigate(result)}
                result={result}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-1">
            {dynamic.map((result, index) => (
              <SearchResult
                active={index === activeIndex}
                key={`${result.route}-${result.label}`}
                onClick={() => navigate(result)}
                result={result}
              />
            ))}
            {!dynamic.length ? (
              <EmptyState
                description={t('search.tryAnother')}
                title={t('search.noResults')}
              />
            ) : null}
          </div>
        )}
      </div>
    </Dialog>
  );
}

function SearchResult({
  active,
  onClick,
  result,
}: {
  active: boolean;
  onClick: () => void;
  result: Result;
}) {
  return (
    <button
      className={`grid min-h-[60px] grid-cols-[1fr_28px] items-center gap-x-3 gap-y-1 rounded-sm px-3 py-2.5 text-left ${active ? 'bg-surface-secondary' : ''}`}
      onClick={onClick}
      type="button"
    >
      <strong className="col-start-1 text-[0.8125rem]">{result.label}</strong>
      <span className="col-start-1 text-xs2 text-muted">
        {result.description}
      </span>
      <Icon className="col-start-2 row-span-2" name="chevron-right" size={18} />
    </button>
  );
}
