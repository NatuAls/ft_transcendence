import { StatusBadge } from 'ui';
import type { Ticket } from './ticketData';

function Priority({ priority }: { priority: Ticket['priority'] }) {
  return (
    <span
      className={`ticket-priority ticket-priority--${priority.toLowerCase()}`}
    >
      <span aria-hidden="true" />
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
    <button className="ticket-card" onClick={onOpen} type="button">
      <span className="ticket-card__topline">
        <span>#{ticket.id}</span>
        <span>{ticket.time}</span>
      </span>
      <strong>{ticket.title}</strong>
      <span className="ticket-card__meta">
        <StatusBadge tone={ticket.statusTone}>{ticket.status}</StatusBadge>
        <Priority priority={ticket.priority} />
      </span>
      <span className="ticket-card__footer">
        <span className="ticket-card__avatar">
          {ticket.assignee
            .split(' ')
            .map((name) => name[0])
            .join('')}
        </span>
        <span>{ticket.assignee}</span>
        <span aria-hidden="true">›</span>
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
      <div className="ticket-table-wrap">
        <table className="ticket-table">
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
                    className="ticket-table__link"
                    onClick={() => onOpenTicket(ticket.id)}
                    type="button"
                  >
                    <strong>{ticket.title}</strong>
                  </button>
                  <span>
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
          <p className="ticket-list-empty">No tickets match these filters.</p>
        ) : null}
      </div>

      <div className="ticket-cards">
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
            className="ticket-cards__view-all"
            onClick={onShowAllMobile}
            type="button"
          >
            View all {filteredTickets.length} sample tickets{' '}
            <span aria-hidden="true">→</span>
          </button>
        ) : null}
        {!filteredTickets.length ? (
          <p className="ticket-list-empty">No tickets match these filters.</p>
        ) : null}
      </div>

      <footer className="ticket-pagination">
        <span>
          Showing {filteredTickets.length ? (activePage - 1) * pageSize + 1 : 0}
          –{Math.min(activePage * pageSize, filteredTickets.length)} of{' '}
          {filteredTickets.length}
        </span>
        <div>
          <button
            aria-label="Previous page"
            disabled={activePage === 1}
            onClick={() => onPageChange(Math.max(1, activePage - 1))}
            type="button"
          >
            ‹
          </button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map(
            (pageNumber) => (
              <button
                aria-current={pageNumber === activePage ? 'page' : undefined}
                key={pageNumber}
                onClick={() => onPageChange(pageNumber)}
                type="button"
              >
                {pageNumber}
              </button>
            ),
          )}
          <button
            aria-label="Next page"
            disabled={activePage === pageCount}
            onClick={() => onPageChange(Math.min(pageCount, activePage + 1))}
            type="button"
          >
            ›
          </button>
        </div>
      </footer>
    </>
  );
}
