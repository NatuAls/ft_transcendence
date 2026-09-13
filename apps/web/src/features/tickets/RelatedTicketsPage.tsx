import { Button, SelectField, StatusBadge } from 'ui';
import { useMemo, useState } from 'react';
import { initialTickets } from './ticketData';
import './related-tickets.css';

const relatedTickets = initialTickets.slice(0, 2);

export function RelatedTicketsPage({
  onBack,
  onNewTicket,
  onOpenTicket,
  personName,
}: {
  onBack: () => void;
  onNewTicket: () => void;
  onOpenTicket: (ticketId: string) => void;
  personName: string;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const visibleTickets = useMemo(
    () =>
      relatedTickets.filter((ticket) => {
        const matchesQuery = `${ticket.id} ${ticket.title} ${ticket.category}`
          .toLowerCase()
          .includes(query.trim().toLowerCase());
        const matchesStatus = status === 'all' || ticket.status === status;
        const matchesPriority =
          priority === 'all' || ticket.priority === priority;
        return matchesQuery && matchesStatus && matchesPriority;
      }),
    [priority, query, status],
  );

  return (
    <div className="related-tickets-page">
      <button className="related-tickets-back" onClick={onBack} type="button">
        ← {personName}
      </button>
      <header>
        <div>
          <span>TICKETS</span>
          <h1>Tickets with {personName}</h1>
          <p>
            Tickets where {personName} is the requester or assigned support
            agent.
          </p>
        </div>
        <Button onClick={onNewTicket}>＋ New ticket</Button>
      </header>
      <section
        aria-label="Related ticket summary"
        className="related-ticket-stats"
      >
        {[
          ['all', '2', 'All tickets'],
          ['Open', '1', 'Open'],
          ['In progress', '1', 'In progress'],
          ['High', '1', 'High priority'],
        ].map(([value, count, label]) => (
          <button
            key={label}
            onClick={() => {
              setPriority(label === 'High priority' ? 'High' : 'all');
              setStatus(label === 'High priority' ? 'all' : value);
            }}
            type="button"
          >
            <strong>{count}</strong>
            <span>{label}</span>
            <small>View queue →</small>
          </button>
        ))}
      </section>
      <section className="related-ticket-panel">
        <header>
          <div>
            <h2>Related tickets</h2>
            <span>{visibleTickets.length} results</span>
          </div>
          <label>
            <span aria-hidden="true">⌕</span>{' '}
            <span className="sr-only">Search these tickets</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search these tickets"
              type="search"
              value={query}
            />
          </label>
        </header>
        <div className="related-ticket-filters">
          <SelectField
            hideLabel
            label="Statuses"
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="all">All statuses</option>
            <option>Open</option>
            <option>In progress</option>
          </SelectField>
          <SelectField
            hideLabel
            label="Priorities"
            onChange={(event) => setPriority(event.target.value)}
            value={priority}
          >
            <option value="all">All priorities</option>
            <option>High</option>
            <option>Medium</option>
          </SelectField>
        </div>
        <div className="related-ticket-row related-ticket-row--head">
          <span>ID</span>
          <span>TICKET</span>
          <span>REQUESTER</span>
          <span>STATUS</span>
          <span>PRIORITY</span>
          <span>UPDATED</span>
        </div>
        {visibleTickets.map((ticket) => (
          <button
            className="related-ticket-row"
            key={ticket.id}
            onClick={() => onOpenTicket(ticket.id)}
            type="button"
          >
            <span>#{ticket.id}</span>
            <span>
              <strong>{ticket.title}</strong>
              <small>{ticket.category}</small>
            </span>
            <span>{personName}</span>
            <StatusBadge tone={ticket.statusTone}>{ticket.status}</StatusBadge>
            <span>● {ticket.priority}</span>
            <span>{ticket.time}</span>
          </button>
        ))}
        {!visibleTickets.length ? (
          <p className="related-ticket-empty">No related tickets match.</p>
        ) : null}
        <footer>
          Showing 1–{visibleTickets.length} of {visibleTickets.length}
        </footer>
      </section>
    </div>
  );
}
