import { Button, Icon, SelectField } from 'ui';
import { TicketListResults } from './TicketListResults';
import { useState, useEffect } from 'react';
import { searchTickets } from '../../api/tickets';
import { useAsync } from '../../core/async/useAsync';
import { AsyncState } from '../../core/async/AsyncState';
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
  const [page, setPage] = useState(1);
  const [showAllMobile, setShowAllMobile] = useState(false);
  const pageSize = 30;

  const ticketsQuery = useAsync(
    async (signal) => {
      const apiStatus = status === 'all' ? undefined : status.toUpperCase().replace(' ', '_');
      const apiPriority = priority === 'all' ? undefined : priority.toUpperCase();

      return searchTickets(
        organizationId,
        {
          createdById: personId,
          q: query.trim() || undefined,
          status: apiStatus,
          priority: apiPriority,
          page,
          take: pageSize,
        },
        signal,
      );
    },
    [organizationId, personId, query, status, priority, page],
  );

  const apiResponse = ticketsQuery.data;
  const currentTickets = apiResponse?.data ?? [];
  const totalTickets = apiResponse?.meta.total ?? 0;
  const pageCount = apiResponse?.meta.pages ?? 1;

  useEffect(() => {
    setPage(1);
  }, [query, status, priority]);

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
              {t('tickets.related.results', { count: totalTickets })}
            </span>
          </div>
          <label className="rounded-sm border border-border px-3 py-[9px] max-[900px]:mt-[14px] max-[900px]:flex focus-within:border-focus focus-within:outline-3 focus-within:outline-focus">
            <Icon className="mr-1 text-muted" name="search" size={14} />
            <span className="sr-only">{t('tickets.related.searchLabel')}</span>
            <input
              className="border-0 bg-transparent outline-0 focus:ring-0 max-[900px]:flex-1"
              name="ticketSearch"
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

        <AsyncState
          emptyDescription={
            query || status !== 'all' || priority !== 'all'
              ? t('tickets.list.empty.filteredDescription')
              : undefined
          }
          emptyTitle={
            query || status !== 'all' || priority !== 'all'
              ? t('tickets.empty')
              : t('tickets.related.empty', 'No related tickets match.')
          }
          error={ticketsQuery.error}
          errorTitle={t('tickets.list.errorTitle')}
          isEmpty={currentTickets.length === 0}
          onRetry={ticketsQuery.reload}
          status={ticketsQuery.status}
        >
          <TicketListResults
            activePage={page}
            filteredTickets={currentTickets}
            onOpenTicket={onOpenTicket}
            onPageChange={setPage}
            onShowAllMobile={() => setShowAllMobile(true)}
            pageCount={pageCount}
            pageSize={pageSize}
            showCreatedBy={false} 
            showAllMobile={showAllMobile}
          />
        </AsyncState>
      </section>
    </div>
  );
}