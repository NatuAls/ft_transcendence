import { Pagination, StatusBadge } from 'ui';
import type { Ticket } from './ticketData';

function Priority({ priority }: { priority: Ticket['priority'] }) {
  return (
    <span className="inline-flex items-center gap-[7px] text-[13px] text-ink">
      <span
        aria-hidden="true"
        className={`size-[7px] rounded-full ${priority === 'High' ? 'bg-danger' : priority === 'Medium' ? 'bg-warning' : 'bg-success'}`}
      />
      {priority}
    </span>
  );
}

function TicketCard({
  onOpen,
  ticket,
}: {
  onOpen: () => void;
  ticket: Ticket;
}) {
  return (
    <button
      className="hidden w-full gap-2.5 rounded-md border border-border bg-surface p-4 text-left text-ink max-md:grid"
      onClick={onOpen}
      type="button"
    >
      <span className="flex items-center justify-between text-xs text-muted">
        <span>#{ticket.id}</span>
        <span>{ticket.time}</span>
      </span>
      <strong className="text-[15px] font-medium">{ticket.title}</strong>
      <span className="flex items-center gap-3.5">
        <StatusBadge tone={ticket.statusTone}>{ticket.status}</StatusBadge>
        <Priority priority={ticket.priority} />
      </span>
      <span className="flex items-center justify-start border-t border-border pt-3 text-xs text-muted">
        <span className="mr-2 grid size-[26px] place-items-center rounded-full bg-[#d8e5df] text-[9px] text-primary">
          {ticket.assignee
            .split(' ')
            .map((name) => name[0])
            .join('')}
        </span>
        <span>{ticket.assignee}</span>
        <span className="ml-auto text-xl text-ink" aria-hidden="true">
          ›
        </span>
      </span>
    </button>
  );
}

export function TicketListResults({
  activePage,
  filteredTickets,
  onOpenTicket,
  onPageChange,
  onShowAllMobile,
  pageCount,
  pageSize,
  showAllMobile,
  visibleTickets,
}: {
  activePage: number;
  filteredTickets: Ticket[];
  onOpenTicket: (ticketId: string) => void;
  onPageChange: (page: number) => void;
  onShowAllMobile: () => void;
  pageCount: number;
  pageSize: number;
  showAllMobile: boolean;
  visibleTickets: Ticket[];
}) {
  return (
    <>
      <div className="overflow-x-auto max-md:hidden">
        <table className="w-full min-w-[820px] border-collapse text-left [&_th]:h-11 [&_th]:bg-surface-secondary [&_th]:px-5 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted [&_td]:h-[76px] [&_td]:border-t [&_td]:border-border [&_td]:px-5 [&_td]:py-3 [&_td]:text-[13px] [&_td]:text-muted [&_tbody_tr:hover]:bg-surface-secondary">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Assignee</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {visibleTickets.map((ticket) => (
              <tr key={ticket.id}>
                <td>
                  <button
                    className="text-left hover:[&_strong]:underline hover:[&_strong]:underline-offset-3 focus-visible:rounded-[3px]"
                    onClick={() => onOpenTicket(ticket.id)}
                    type="button"
                  >
                    <strong className="mb-[5px] block text-sm font-medium text-ink">
                      {ticket.title}
                    </strong>
                  </button>
                  <span className="block">
                    #{ticket.id} · {ticket.category}
                  </span>
                </td>
                <td>
                  <StatusBadge tone={ticket.statusTone}>
                    {ticket.status}
                  </StatusBadge>
                </td>
                <td>
                  <Priority priority={ticket.priority} />
                </td>
                <td>{ticket.assignee}</td>
                <td>{ticket.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visibleTickets.length ? (
          <p className="px-5 py-8 text-center text-muted">
            No tickets match these filters.
          </p>
        ) : null}
      </div>

      <div className="hidden gap-2.5 max-md:grid">
        {(showAllMobile ? filteredTickets : filteredTickets.slice(0, 3)).map(
          (ticket) => (
            <TicketCard
              key={ticket.id}
              onOpen={() => onOpenTicket(ticket.id)}
              ticket={ticket}
            />
          ),
        )}
        {filteredTickets.length > 3 && !showAllMobile ? (
          <button
            className="p-3 text-[13px] font-medium text-primary"
            onClick={onShowAllMobile}
            type="button"
          >
            View all {filteredTickets.length} sample tickets{' '}
            <span aria-hidden="true">→</span>
          </button>
        ) : null}
        {!filteredTickets.length ? (
          <p className="px-5 py-8 text-center text-muted">
            No tickets match these filters.
          </p>
        ) : null}
      </div>

      <footer className="flex min-h-[70px] items-center justify-between border-t border-border px-6 py-3 text-[13px] text-muted max-md:hidden">
        <span>
          Showing {filteredTickets.length ? (activePage - 1) * pageSize + 1 : 0}
          –{Math.min(activePage * pageSize, filteredTickets.length)} of{' '}
          {filteredTickets.length}
        </span>
        <Pagination
          currentPage={activePage}
          label="Ticket pages"
          onPageChange={onPageChange}
          totalPages={pageCount}
        />
      </footer>
    </>
  );
}
