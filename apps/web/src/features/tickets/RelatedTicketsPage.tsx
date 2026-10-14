import { Button, Icon, LoadingState, SelectField, StatusBadge } from 'ui';
import { useMemo, useState } from 'react';
import { searchTickets, type TicketData } from '../../api/tickets';
import { useAsync } from '../../core/async/useAsync';
import { useTranslation } from '../../core/i18n';

export function RelatedTicketsPage({
  onBack,
  onNewTicket,
  onOpenTicket,
  personId,
  personName,
  organizationId,
}: {
  onBack: () => void;
  onNewTicket: () => void;
  onOpenTicket: (ticketId: string) => void;
  personId: string;
  personName: string;
  organizationId: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const response = useAsync(
    (signal) =>
      searchTickets(
        organizationId,
        { createdById: personId, q: query || undefined, take: 100 },
        signal,
      ),
    [organizationId, personId, query],
  );
  const visibleTickets = useMemo(
    () =>
      (response.data?.data ?? []).filter(
        (ticket) =>
          (status === 'all' || ticket.status === status) &&
          (priority === 'all' || ticket.priority === priority),
      ),
    [priority, response.data?.data, status],
  );

  return (
    <div className="mx-auto max-w-[1160px] p-10 max-[900px]:px-4 max-[900px]:py-6">
      <button className="p-0 text-primary" onClick={onBack} type="button">
        ← {personName || t('tickets.related.backToMessages')}
      </button>
      <header className="mt-[22px] flex items-end justify-between max-[900px]:items-start">
        <div>
          <span className="text-2xs tracking-[.08em] text-muted">
            {t('tickets.title')}
          </span>
          <h1 className="my-2 text-[1.875rem] font-medium max-[900px]:text-[1.375rem]">
            {personName
              ? t('tickets.related.titleWithPerson', { name: personName })
              : t('tickets.related.title')}
          </h1>
        </div>
        <Button onClick={onNewTicket}>＋ {t('tickets.new')}</Button>
      </header>
      <section className="my-[26px] overflow-hidden rounded-md border border-border bg-surface">
        <header className="flex items-center justify-between p-[18px] max-[900px]:block">
          <div>
            <h2 className="mr-2 inline text-base font-medium">
              {t('tickets.related.heading')}
            </h2>
            <span className="text-2xs text-muted">
              {t('tickets.related.results', { count: visibleTickets.length })}
            </span>
          </div>
          <label className="rounded-sm border border-border px-3 py-[9px] max-[900px]:mt-[14px] max-[900px]:flex">
            <Icon className="mr-1" name="search" size={14} />
            <span className="sr-only">{t('tickets.related.searchLabel')}</span>
            <input
              className="border-0 bg-transparent outline-0 max-[900px]:flex-1"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('tickets.related.searchPlaceholder')}
              type="search"
              value={query}
            />
          </label>
        </header>
        <div className="flex gap-2 border-t border-border px-[18px] py-2.5">
          <SelectField
            hideLabel
            label={t('tickets.related.statuses')}
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="all">{t('tickets.filters.status.all')}</option>
            <option value="OPEN">{t('tickets.status.OPEN')}</option>
            <option value="IN_PROGRESS">
              {t('tickets.status.IN_PROGRESS')}
            </option>
            <option value="RESOLVED">{t('tickets.status.RESOLVED')}</option>
            <option value="CLOSED">{t('tickets.status.CLOSED')}</option>
          </SelectField>
          <SelectField
            hideLabel
            label={t('tickets.related.priorities')}
            onChange={(event) => setPriority(event.target.value)}
            value={priority}
          >
            <option value="all">{t('tickets.filters.priority.all')}</option>
            <option value="HIGH">{t('tickets.priority.HIGH')}</option>
            <option value="MEDIUM">{t('tickets.priority.MEDIUM')}</option>
            <option value="LOW">{t('tickets.priority.LOW')}</option>
          </SelectField>
        </div>
        {response.status === 'loading' && !response.data ? (
          <LoadingState />
        ) : null}
        {visibleTickets.map((ticket: TicketData) => (
          <button
            className="grid w-full grid-cols-[90px_2fr_1fr_1fr_1fr_110px] items-center gap-2.5 border-t border-border px-[18px] py-[14px] text-left text-2xs"
            key={ticket.id}
            onClick={() => onOpenTicket(ticket.id)}
            type="button"
          >
            <span>#{ticket.id.slice(0, 8)}</span>
            <strong>{ticket.title}</strong>
            <span>{ticket.authorDisplayName}</span>
            <StatusBadge
              tone={
                ticket.status === 'OPEN'
                  ? 'open'
                  : ticket.status === 'IN_PROGRESS'
                    ? 'progress'
                    : ticket.status === 'RESOLVED'
                      ? 'resolved'
                      : 'closed'
              }
            >
              {t(`tickets.status.${ticket.status}`)}
            </StatusBadge>
            <span>{t(`tickets.priority.${ticket.priority}`)}</span>
            <span>{ticket.updatedAt ?? ticket.createdAt}</span>
          </button>
        ))}
        {response.status !== 'loading' && !visibleTickets.length ? (
          <p className="border-t border-border p-[30px] text-center text-muted">
            {t('tickets.related.empty')}
          </p>
        ) : null}
      </section>
    </div>
  );
}
