import { Button, SelectField } from 'ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TicketFilterSheet } from './TicketFilterSheet';
import { TicketListResults } from './TicketListResults';
import { initialTickets, type Ticket } from './ticketData';
import './ticket-list.css';

interface TicketListPageProps {
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
  tickets?: Ticket[];
}

const stats = [
  { label: 'Open', tone: 'open', value: 24 },
  { label: 'In progress', tone: 'progress', value: 12 },
  { label: 'Resolved', tone: 'resolved', value: 38 },
  { label: 'High priority', tone: 'urgent', value: 4 },
] as const;

export function TicketListPage({
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
    <div className="ticket-list-page">
      <section className="ticket-list-page__mobile-intro">
        <p>Good morning, Ana</p>
        <div>
          <strong>4 tickets need attention</strong>
          <Button aria-label="Create ticket" onClick={onCreateTicket}>
            +
          </Button>
        </div>
      </section>

      <header className="ticket-list-page__heading">
        <div>
          <h1>Tickets</h1>
          <p>Track requests across your organization and move work forward.</p>
        </div>
        <Button onClick={onCreateTicket}>+&nbsp;&nbsp;New ticket</Button>
      </header>

      <section aria-label="Ticket summary" className="ticket-stats">
        {stats.map((stat) => (
          <article className="ticket-stat" key={stat.label}>
            <span
              className={`ticket-stat__icon ticket-stat__icon--${stat.tone}`}
            >
              {stat.tone === 'resolved'
                ? '✓'
                : stat.tone === 'urgent'
                  ? '!'
                  : '○'}
            </span>
            <div>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          </article>
        ))}
      </section>

      {initialCategory && category !== 'all' ? (
        <section className="ticket-category-context" role="status">
          <div>
            <span>Category filter</span>
            <strong>{category}</strong>
          </div>
          <button onClick={onBackToCategories} type="button">
            Back to categories
          </button>
          <button
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

      <section className="ticket-list-panel">
        <header className="ticket-list-panel__header">
          <div>
            <h2>All tickets</h2>
            <span>{filteredTickets.length} sample results</span>
          </div>
          <label className="ticket-search">
            <span aria-hidden="true">⌕</span>
            <span className="ticket-list-page__sr-only">Search tickets</span>
            <input
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

        <div className="ticket-filters">
          <SelectField
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
            className="ticket-filter-button"
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
