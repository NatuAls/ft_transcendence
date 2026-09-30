import { Button, Icon, SelectField, StatusBadge } from 'ui';
import { useMemo, useState } from 'react';
import { initialTickets } from './ticketData';

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
    <div className="mx-auto max-w-[1160px] p-10 max-[900px]:px-4 max-[900px]:py-6">
      <button className="p-0 text-primary" onClick={onBack} type="button">
        ← {personName}
      </button>
      <header className="mt-[22px] flex items-end justify-between max-[900px]:items-start">
        <div>
          <span className="text-[10px] tracking-[.08em] text-muted">
            TICKETS
          </span>
          <h1 className="my-2 text-[30px] font-medium max-[900px]:text-[22px]">
            Tickets with {personName}
          </h1>
          <p className="text-[13px] text-muted max-[900px]:hidden">
            Tickets where {personName} is the requester or assigned support
            agent.
          </p>
        </div>
        <Button
          className="max-[900px]:!min-h-9 max-[900px]:!px-2.5"
          onClick={onNewTicket}
        >
          ＋ New ticket
        </Button>
      </header>
      <section
        aria-label="Related ticket summary"
        className="my-[26px] grid grid-cols-4 gap-3 max-[900px]:grid-cols-2"
      >
        {[
          ['all', '2', 'All tickets'],
          ['Open', '1', 'Open'],
          ['In progress', '1', 'In progress'],
          ['High', '1', 'High priority'],
        ].map(([value, count, label]) => (
          <button
            className="grid gap-1.5 rounded-md border border-border bg-surface p-[17px] text-left hover:border-focus"
            key={label}
            onClick={() => {
              setPriority(label === 'High priority' ? 'High' : 'all');
              setStatus(label === 'High priority' ? 'all' : value);
            }}
            type="button"
          >
            <strong className="text-[22px]">{count}</strong>
            <span className="text-[11px]">{label}</span>
            <small className="text-[9px] text-primary">View queue →</small>
          </button>
        ))}
      </section>
      <section className="overflow-hidden rounded-md border border-border bg-surface">
        <header className="flex items-center justify-between p-[18px] max-[900px]:block">
          <div>
            <h2 className="mr-2 inline text-base font-medium">
              Related tickets
            </h2>
            <span className="text-[10px] text-muted">
              {visibleTickets.length} results
            </span>
          </div>
          <label className="rounded-sm border border-border px-3 py-[9px] focus-within:border-focus focus-within:outline-3 focus-within:outline-focus max-[900px]:mt-[14px] max-[900px]:flex">
            <Icon className="mr-1" name="search" size={14} />{' '}
            <span className="sr-only">Search these tickets</span>
            <input
              className="border-0 bg-transparent outline-0 focus-visible:!outline-none max-[900px]:flex-1"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search these tickets"
              type="search"
              value={query}
            />
          </label>
        </header>
        <div className="flex gap-2 overflow-auto border-t border-border px-[18px] py-2.5">
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
        <div className="grid w-full grid-cols-[90px_2fr_1fr_1fr_1fr_70px] items-center gap-2.5 border-t border-border bg-surface-secondary px-[18px] py-[14px] text-left text-[9px] text-muted max-[900px]:hidden">
          <span>ID</span>
          <span>TICKET</span>
          <span>REQUESTER</span>
          <span>STATUS</span>
          <span>PRIORITY</span>
          <span>UPDATED</span>
        </div>
        {visibleTickets.map((ticket) => (
          <button
            className="grid w-full grid-cols-[90px_2fr_1fr_1fr_1fr_70px] items-center gap-2.5 border-t border-border px-[18px] py-[14px] text-left text-[10px] max-[900px]:grid-cols-[1fr_auto] max-[900px]:[&>*:not(:nth-child(2)):not(:nth-child(4))]:hidden"
            key={ticket.id}
            onClick={() => onOpenTicket(ticket.id)}
            type="button"
          >
            <span>#{ticket.id}</span>
            <span>
              <strong className="block">{ticket.title}</strong>
              <small className="mt-1 block text-muted">{ticket.category}</small>
            </span>
            <span>{personName}</span>
            <StatusBadge tone={ticket.statusTone}>{ticket.status}</StatusBadge>
            <span>● {ticket.priority}</span>
            <span>{ticket.time}</span>
          </button>
        ))}
        {!visibleTickets.length ? (
          <p className="border-t border-border p-[30px] text-center text-muted">
            No related tickets match.
          </p>
        ) : null}
        <footer className="p-[15px] text-[10px] text-muted">
          Showing 1–{visibleTickets.length} of {visibleTickets.length}
        </footer>
      </section>
    </div>
  );
}
