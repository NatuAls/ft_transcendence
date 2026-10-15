import { Pagination, StatusBadge } from 'ui';
import type { TicketData } from '../../api/tickets';
import { getInitials } from '../../app/text';
import { useTranslation } from '../../core/i18n';
import { formatRelativeTime } from './ticketTime';

function Priority({ priority }: { priority: TicketData['priority'] }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-[7px] text-[0.8125rem] text-ink">
      <span
        aria-hidden="true"
        className={`size-[7px] rounded-full ${
          priority === 'HIGH'
            ? 'bg-danger'
            : priority === 'MEDIUM'
              ? 'bg-warning'
              : 'bg-success'
        }`}
      />
      {t(`tickets.priority.${priority}`)}
    </span>
  );
}

function getStatusTone(status: string) {
  switch (status) {
    case 'OPEN':
      return 'open';
    case 'IN_PROGRESS':
      return 'progress';
    case 'RESOLVED':
      return 'resolved';
    case 'CLOSED':
      return 'closed';
    default:
      return 'open';
  }
}

function TicketCard({
  onOpen,
  showCreatedBy,
  ticket,
}: {
  onOpen: () => void;
  showCreatedBy: boolean;
  ticket: TicketData;
}) {
  const { i18n, t } = useTranslation();
  const assigneeName =
    ticket.assigneeDisplayName || t('tickets.list.unassigned');
  return (
    <button
      className="hidden w-full gap-2.5 rounded-md border border-border bg-surface p-4 text-left text-ink max-md:grid"
      onClick={onOpen}
      type="button"
    >
      <span className="flex items-center justify-between text-xs text-muted">
        <span>#{ticket.id.split('-')[0]}</span>
        <span>
          {formatRelativeTime(
            ticket.updatedAt ?? ticket.createdAt,
            i18n.language,
          )}
        </span>
      </span>
      <strong className="text-[0.9375rem] font-medium">{ticket.title}</strong>
      <span className="flex items-center gap-3.5">
        <StatusBadge tone={getStatusTone(ticket.status)}>
          {t(`tickets.status.${ticket.status}`)}
        </StatusBadge>
        <Priority priority={ticket.priority} />
      </span>
      <span className="flex items-center justify-start border-t border-border pt-3 text-xs text-muted">
        <span className="mr-2 grid size-[26px] place-items-center rounded-full bg-[#d8e5df] text-3xs text-primary">
          {getInitials(showCreatedBy ? ticket.authorDisplayName : assigneeName)}
        </span>
        <span>
          {showCreatedBy
            ? t('tickets.list.createdBy', { name: ticket.authorDisplayName })
            : assigneeName}
          {showCreatedBy ? (
            <span className="block text-2xs">
              {t('tickets.list.assignedTo', { name: assigneeName })}
            </span>
          ) : null}
        </span>
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
  showCreatedBy,
  showAllMobile,
}: {
  activePage: number;
  filteredTickets: TicketData[];
  onOpenTicket: (ticketId: string) => void;
  onPageChange: (page: number) => void;
  onShowAllMobile: () => void;
  pageCount: number;
  pageSize: number;
  showCreatedBy: boolean;
  showAllMobile: boolean;
}) {
  const { i18n, t } = useTranslation();

  return (
    <>
      <div className="overflow-x-auto max-md:hidden">
        <table className="w-full min-w-[820px] border-collapse text-left [&_th]:h-11 [&_th]:bg-surface-secondary [&_th]:px-5 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted [&_td]:h-[76px] [&_td]:border-t [&_td]:border-border [&_td]:px-5 [&_td]:py-3 [&_td]:text-[0.8125rem] [&_td]:text-muted [&_tbody_tr:hover]:bg-surface-secondary">
          <thead>
            <tr>
              <th>{t('tickets.table.ticket')}</th>
              <th>{t('tickets.table.status')}</th>
              <th>{t('tickets.table.priority')}</th>
              {showCreatedBy ? <th>{t('tickets.table.createdBy')}</th> : null}
              <th>{t('tickets.table.assignee')}</th>
              <th>{t('tickets.table.updated')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.map((ticket) => (
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
                    #{ticket.id.split('-')[0]} ·{' '}
                    {ticket.categoryName || t('tickets.list.noCategory')}
                  </span>
                </td>
                <td>
                  <StatusBadge tone={getStatusTone(ticket.status)}>
                    {t(`tickets.status.${ticket.status}`)}
                  </StatusBadge>
                </td>
                <td>
                  <Priority priority={ticket.priority} />
                </td>
                {showCreatedBy ? <td>{ticket.authorDisplayName}</td> : null}
                <td>
                  {ticket.assigneeDisplayName || t('tickets.list.unassigned')}
                </td>
                <td>
                  {formatRelativeTime(
                    ticket.updatedAt ?? ticket.createdAt,
                    i18n.language,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="hidden gap-2.5 max-md:grid">
        {(showAllMobile ? filteredTickets : filteredTickets.slice(0, 3)).map(
          (ticket) => (
            <TicketCard
              key={ticket.id}
              onOpen={() => onOpenTicket(ticket.id)}
              showCreatedBy={showCreatedBy}
              ticket={ticket}
            />
          ),
        )}
        {filteredTickets.length > 3 && !showAllMobile ? (
          <button
            className="p-3 text-[0.8125rem] font-medium text-primary"
            onClick={onShowAllMobile}
            type="button"
          >
            {t('tickets.list.viewAll', { count: filteredTickets.length })}{' '}
            <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </div>

      <footer className="flex min-h-[70px] items-center justify-between border-t border-border px-6 py-3 text-[0.8125rem] text-muted max-md:hidden">
        <span>
          {t('tickets.list.showing', {
            from: filteredTickets.length ? (activePage - 1) * pageSize + 1 : 0,
            to: Math.min(activePage * pageSize, filteredTickets.length),
            count: filteredTickets.length,
          })}
        </span>
        <Pagination
          currentPage={activePage}
          label={t('tickets.list.pages')}
          onPageChange={onPageChange}
          totalPages={pageCount}
        />
      </footer>
    </>
  );
}
