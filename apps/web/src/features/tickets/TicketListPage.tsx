import { Button, Icon, SelectField } from 'ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TicketFilterSheet } from './TicketFilterSheet';
import { TicketListResults } from './TicketListResults';
import { initialTickets, type Ticket } from './ticketData';

interface TicketListPageProps {
  currentUserName: string;
  initialCategory?: string;
  initialPage?: number;
  initialPriority?: string;
  initialQuery?: string;
  initialSort?: string;
  initialStatus?: string;
  onBackToCategories: () => void;
  onCreateTicket: () => void;
  onFiltersChange: (params: Record<string, string | undefined>) => void;
  onOpenTicket: (ticketId: string) => void;
  organizationWide: boolean;
  tickets?: Ticket[];
}

const statToneClasses = {
  open: 'bg-info-surface text-info',
  progress: 'bg-warning-surface text-warning',
  resolved: 'bg-success-surface text-success',
  urgent: 'bg-danger-surface text-danger',
};

export function TicketListPage({
  currentUserName,
  initialCategory = '',
  initialPage = 1,
  initialPriority = 'all',
  initialQuery = '',
  initialSort = 'newest',
  initialStatus = 'all',
  onBackToCategories,
  onCreateTicket,
  onFiltersChange,
  onOpenTicket,
  organizationWide,
  tickets = initialTickets,
}: TicketListPageProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [showAllMobile, setShowAllMobile] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory || 'all');
  const [status, setStatus] = useState(initialStatus);
  const [priority, setPriority] = useState(initialPriority);
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(
    Number.isFinite(initialPage) && initialPage > 0 ? initialPage : 1,
  );
  const closeFilters = useCallback(() => setShowFilters(false), []);
  const pageSize = 3;
  const stats = [
    {
      label: 'Open',
      tone: 'open',
      value: tickets.filter((ticket) => ticket.status === 'Open').length,
    },
    {
      label: 'In progress',
      tone: 'progress',
      value: tickets.filter((ticket) => ticket.status === 'In progress').length,
    },
    {
      label: 'Resolved',
      tone: 'resolved',
      value: tickets.filter((ticket) => ticket.status === 'Resolved').length,
    },
    {
      label: 'High priority',
      tone: 'urgent',
      value: tickets.filter((ticket) => ticket.priority === 'High').length,
    },
  ] as const;

  const filteredTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = tickets.filter((ticket) => {
      const matchesQuery = `${ticket.id} ${ticket.title} ${ticket.category}`
        .toLowerCase()
        .includes(normalizedQuery);
      const matchesCategory =
        category === 'all' || ticket.category === category;
      const matchesStatus = status === 'all' || ticket.status === status;
      const matchesPriority =
        priority === 'all' || ticket.priority === priority;
      return (
        matchesQuery && matchesCategory && matchesStatus && matchesPriority
      );
    });
    return sort === 'oldest' ? [...matches].reverse() : matches;
  }, [category, priority, query, sort, status, tickets]);
  const pageCount = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const activePage = Math.min(page, pageCount);
  const visibleTickets = filteredTickets.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize,
  );

  useEffect(() => {
    onFiltersChange({
      category: category === 'all' ? undefined : category,
      page: page > 1 ? String(page) : undefined,
      priority: priority === 'all' ? undefined : priority,
      q: query.trim() || undefined,
      sort: sort === 'newest' ? undefined : sort,
      status: status === 'all' ? undefined : status,
    });
  }, [category, onFiltersChange, page, priority, query, sort, status]);

  return (
    <div className="mx-auto max-w-[1440px] p-10 max-md:px-[18px] max-md:pt-0 max-md:pb-6">
      <section className="hidden py-[22px] max-md:block">
        <p className="mb-1 text-[13px] text-muted">
          Good morning, {currentUserName.split(' ')[0]}
        </p>
        <div className="flex items-center justify-between gap-3">
          <strong className="min-w-0 text-xl font-medium max-[360px]:text-[17px]">
            {stats[0].value + stats[1].value} tickets need attention
          </strong>
          <Button
            className="shrink-0 !min-w-0 !px-3 text-sm whitespace-nowrap max-[360px]:!px-2 max-[360px]:text-xs"
            onClick={onCreateTicket}
          >
            +&nbsp;&nbsp;New ticket
          </Button>
        </div>
      </section>

      <header className="flex items-start justify-between gap-6 max-md:hidden">
        <div>
          <h1 className="mb-2 text-[32px] leading-[1.2] font-medium tracking-[-.02em]">
            Tickets
          </h1>
          <p className="text-sm text-muted">
            {organizationWide
              ? 'Track requests across your organization and move work forward.'
              : 'Track the requests you created and follow their progress.'}
          </p>
        </div>
        <Button onClick={onCreateTicket}>+&nbsp;&nbsp;New ticket</Button>
      </header>

      <section
        aria-label="Ticket summary"
        className="my-8 mb-6 grid grid-cols-4 gap-4 max-md:mt-0 max-md:mb-[22px] max-md:grid-cols-3 max-md:gap-2"
      >
        {stats.map((stat) => (
          <article
            className="flex min-h-[108px] items-center gap-4 rounded-md border border-border bg-surface p-5 max-md:min-h-[78px] max-md:justify-center max-md:gap-[9px] max-md:border-0 max-md:bg-surface-secondary max-md:px-2 max-md:py-3 max-md:last:hidden"
            key={stat.label}
          >
            <span
              className={`grid size-[42px] shrink-0 place-items-center rounded-md text-lg font-medium max-md:size-7 max-md:rounded-sm max-md:text-[13px] ${statToneClasses[stat.tone]}`}
            >
              {stat.tone === 'resolved'
                ? '✓'
                : stat.tone === 'urgent'
                  ? '!'
                  : '○'}
            </span>
            <div className="grid gap-[3px]">
              <strong className="text-2xl leading-none font-medium max-md:text-lg">
                {stat.value}
              </strong>
              <span className="text-[13px] text-muted max-md:text-[10px]">
                {stat.label}
              </span>
            </div>
          </article>
        ))}
      </section>

      {initialCategory && category !== 'all' ? (
        <section
          className="mb-4 flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3 max-md:flex-wrap"
          role="status"
        >
          <div className="mr-auto grid gap-0.5 max-md:w-full">
            <span className="text-[11px] tracking-[.08em] text-muted uppercase">
              Category filter
            </span>
            <strong>{category}</strong>
          </div>
          <button
            className="min-h-10 rounded-sm px-2.5 text-[13px] text-primary"
            onClick={onBackToCategories}
            type="button"
          >
            Back to categories
          </button>
          <button
            className="min-h-10 rounded-sm px-2.5 text-[13px] text-primary"
            onClick={() => {
              setCategory('all');
              setPage(1);
            }}
            type="button"
          >
            Clear filter
          </button>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-md border border-border bg-surface max-md:overflow-visible max-md:border-0">
        <header className="flex min-h-[82px] items-center justify-between gap-6 border-b border-border px-6 py-[18px] max-md:block max-md:min-h-0 max-md:border-0 max-md:p-0">
          <div className="flex items-baseline gap-2.5 max-md:hidden">
            <h2 className="text-lg font-medium">
              {organizationWide ? 'All tickets' : 'Your tickets'}
            </h2>
            <span className="text-[13px] text-muted">
              {filteredTickets.length} sample results
            </span>
          </div>
          <label className="flex h-10 w-[min(300px,35vw)] items-center gap-2 rounded-sm border border-border px-3 focus-within:border-focus focus-within:outline-3 focus-within:outline-focus max-md:h-11 max-md:w-full">
            <Icon name="search" size={15} />
            <span className="sr-only">Search tickets</span>
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-ink outline-0 focus-visible:!outline-none"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search title or ticket ID"
              type="search"
              value={query}
            />
          </label>
        </header>

        <div className="flex gap-2.5 border-b border-border px-6 py-3 max-md:gap-2 max-md:overflow-x-auto max-md:border-0 max-md:px-0 max-md:pt-3 max-md:pb-4 max-md:[contain:paint] max-md:[scrollbar-width:none] max-md:[&_.ui-select-field]:shrink-0 max-md:[&_.ui-select-field__control]:min-h-9 max-md:[&_.ui-select-field__control]:rounded-full max-md:[&_.ui-select-field__control]:py-1.5 max-md:[&_.ui-select-field__control]:text-xs">
          <SelectField
            className="max-md:!rounded-full"
            hideLabel
            label="Status"
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            value={status}
          >
            <option value="all">All statuses</option>
            <option value="Open">Open</option>
            <option value="In progress">In progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </SelectField>
          <SelectField
            className="max-md:!rounded-full"
            hideLabel
            label="Priority"
            onChange={(event) => {
              setPriority(event.target.value);
              setPage(1);
            }}
            value={priority}
          >
            <option value="all">All priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </SelectField>
          <SelectField
            className="max-md:!rounded-full"
            hideLabel
            label="Category"
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
            }}
            value={category}
          >
            <option value="all">All categories</option>
            {[...new Set(tickets.map((ticket) => ticket.category))].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </SelectField>
          <SelectField
            className="max-md:!rounded-full"
            hideLabel
            label="Sort order"
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
            value={sort}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </SelectField>
          <button
            aria-label="More filters"
            className="hidden size-9 min-w-9 rounded-full border border-border bg-surface text-ink max-md:block"
            onClick={() => setShowFilters(true)}
            type="button"
          >
            ≡
          </button>
        </div>

        <TicketListResults
          activePage={activePage}
          filteredTickets={filteredTickets}
          onOpenTicket={onOpenTicket}
          onPageChange={setPage}
          onShowAllMobile={() => setShowAllMobile(true)}
          pageCount={pageCount}
          pageSize={pageSize}
          showAllMobile={showAllMobile}
          visibleTickets={visibleTickets}
        />
      </section>
      {showFilters ? (
        <TicketFilterSheet
          category={category}
          onCategoryChange={(value) => {
            setCategory(value);
            setPage(1);
          }}
          onClose={closeFilters}
          onPriorityChange={(value) => {
            setPriority(value);
            setPage(1);
          }}
          onSortChange={(value) => {
            setSort(value);
            setPage(1);
          }}
          onStatusChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          priority={priority}
          sort={sort}
          status={status}
          tickets={tickets}
        />
      ) : null}
    </div>
  );
}
