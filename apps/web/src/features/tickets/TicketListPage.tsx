import { Button, Icon, SelectField } from 'ui';
import { useAsync } from '../../core/async/useAsync';
import { AsyncState } from '../../core/async/AsyncState';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../core/i18n';
import { useRealtimeEvent } from '../../core/realtime/useRealtime';
import { RealtimeEvents } from '../../core/realtime/socket';
import { useRef } from 'react';
import { searchTickets } from '../../api/tickets';
import { TicketFilterSheet } from './TicketFilterSheet';
import { TicketListResults } from './TicketListResults';
import { listCategories, type CategoryRecord } from '../../api/organizations';

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
  organizationId: string;
}

const statToneClasses = {
  open: 'bg-info-surface text-info',
  progress: 'bg-warning-surface text-warning',
  resolved: 'bg-success-surface text-success',
  urgent: 'bg-danger-surface text-danger',
};

export function TicketListPage({
  currentUserName,
  initialCategory = 'all',
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
  organizationId,
}: TicketListPageProps) {
  const { t } = useTranslation();
  const [showFilters, setShowFilters] = useState(false);
  const [showAllMobile, setShowAllMobile] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [categoryId, setCategoryId] = useState(
    initialCategory && initialCategory !== 'all' ? initialCategory : 'all',
  );
  const [status, setStatus] = useState(initialStatus);
  const [priority, setPriority] = useState(initialPriority);
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(
    Number.isFinite(initialPage) && initialPage > 0 ? initialPage : 1,
  );

  const categoriesQuery = useAsync(async () => {
    if (!organizationId) return [];
    return listCategories(organizationId);
  }, [organizationId]);

  const categories = categoriesQuery.data ?? [];
  const activeCategories = categories.filter((c: CategoryRecord) => c.isActive);
  const selectedCategory = categories.find(
    (c: CategoryRecord) => c.id === categoryId,
  );

  const closeFilters = useCallback(() => setShowFilters(false), []);

  const tickets = useAsync(async () => {
    // Convertimos los valores del Select (ej. "In progress") al formato de la API ("IN_PROGRESS")
    const apiStatus =
      status === 'all' ? undefined : status.toUpperCase().replace(' ', '_');
    const apiPriority = priority === 'all' ? undefined : priority.toUpperCase();

    return searchTickets(
      organizationId,
      {
        page,
        take: 30, // El pageSize que definimos
        q: query.trim() || undefined,
        status: apiStatus,
        priority: apiPriority,
        categoryId: categoryId && categoryId !== 'all' ? categoryId : undefined,
        sort: 'createdAt',
        order: sort === 'newest' ? 'desc' : 'asc',
      },
      // Pasa el signal aquí si tu custom hook de useAsync expone un AbortSignal
    );
  }, [organizationId, page, query, status, priority, categoryId, sort]);

  const apiResponse = tickets.data;

  const currentTickets = apiResponse?.data ?? [];
  const totalTickets = apiResponse?.meta.total ?? 0;
  const pageCount = apiResponse?.meta.pages ?? 1;

  // 1. Temporizador para agrupar recargas si llegan ráfagas de eventos
  const debounceTimer = useRef<number | undefined>(undefined);

  const reloadTicketsDebounced = useCallback(() => {
    window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      tickets.reload();
    }, 250);
  }, [tickets]);

  useRealtimeEvent(RealtimeEvents.ticketCreated, (raw) => {
    const payload = raw as { ticket?: { organizationId: string } } | undefined;
    if (payload?.ticket?.organizationId === organizationId) {
      reloadTicketsDebounced();
    }
  });

  useRealtimeEvent(RealtimeEvents.ticketUpdated, (raw) => {
    const payload = raw as { ticket?: { organizationId: string } } | undefined;
    if (payload?.ticket?.organizationId === organizationId) {
      reloadTicketsDebounced();
    }
  });

  useRealtimeEvent(RealtimeEvents.ticketDeleted, (raw) => {
    const payload = raw as
      { organizationId?: string; ticketId?: string } | undefined;
    if (payload?.organizationId === organizationId) {
      reloadTicketsDebounced();
    }
  });

  useRealtimeEvent(RealtimeEvents.categoryCreated, () => {
    categoriesQuery.reload();
  });
  useRealtimeEvent(RealtimeEvents.categoryUpdated, () => {
    categoriesQuery.reload();
  });

  useRealtimeEvent(RealtimeEvents.connected, () => {
    tickets.reload();
    categoriesQuery.reload();
  });

  const stats = [
    {
      label: 'Open',
      tone: 'open',
      value: apiResponse?.meta.facets?.status?.OPEN ?? 0,
    },
    {
      label: 'In progress',
      tone: 'progress',
      value: apiResponse?.meta.facets?.status?.IN_PROGRESS ?? 0,
    },
    {
      label: 'Resolved',
      tone: 'resolved',
      value: apiResponse?.meta.facets?.status?.RESOLVED ?? 0,
    },
    {
      label: 'High priority',
      tone: 'urgent',
      value: apiResponse?.meta.facets?.priority?.HIGH ?? 0,
    },
  ] as const;

  useEffect(() => {
    return () => {
      window.clearTimeout(debounceTimer.current);
    };
  }, []);

  useEffect(() => {
    onFiltersChange({
      category: categoryId === 'all' ? undefined : categoryId,
      page: page > 1 ? String(page) : undefined,
      priority: priority === 'all' ? undefined : priority,
      q: query.trim() || undefined,
      sort: sort === 'newest' ? undefined : sort,
      status: status === 'all' ? undefined : status,
    });
  }, [categoryId, onFiltersChange, page, priority, query, sort, status]);

  return (
    <div className="mx-auto max-w-[1440px] p-10 max-md:px-[18px] max-md:pt-0 max-md:pb-6">
      <section className="hidden py-[22px] max-md:block">
        <p className="mb-1 text-[0.8125rem] text-muted">
          {t('tickets.list.greeting', { name: currentUserName.split(' ')[0] })}
        </p>
        <div className="flex items-center justify-between gap-3">
          <strong className="min-w-0 text-xl font-medium max-[360px]:text-[1.0625rem]">
            {t('tickets.list.attention', {
              count: stats[0].value + stats[1].value,
            })}
          </strong>
          <Button
            className="shrink-0 !min-w-0 !px-3 text-sm whitespace-nowrap max-[360px]:!px-2 max-[360px]:text-xs"
            onClick={onCreateTicket}
          >
            +&nbsp;&nbsp;{t('tickets.new')}
          </Button>
        </div>
      </section>

      <header className="flex items-start justify-between gap-6 max-md:hidden">
        <div>
          <h1 className="mb-2 text-[2rem] leading-[1.2] font-medium tracking-[-.02em]">
            {t('tickets.title')}
          </h1>
          <p className="text-sm text-muted">
            {organizationWide
              ? t('tickets.list.description.organization')
              : t('tickets.list.description.personal')}
          </p>
        </div>
        <Button onClick={onCreateTicket}>
          +&nbsp;&nbsp;{t('tickets.new')}
        </Button>
      </header>

      <section
        aria-label={t('tickets.list.summary')}
        className="my-8 mb-6 grid grid-cols-4 gap-4 max-md:mt-0 max-md:mb-[22px] max-md:grid-cols-3 max-md:gap-2"
      >
        {stats.map((stat) => (
          <article
            className="flex min-h-[108px] items-center gap-4 rounded-md border border-border bg-surface p-5 max-md:min-h-[78px] max-md:justify-center max-md:gap-[9px] max-md:border-0 max-md:bg-surface-secondary max-md:px-2 max-md:py-3 max-md:last:hidden"
            key={stat.label}
          >
            <span
              className={`grid size-[42px] shrink-0 place-items-center rounded-md text-lg font-medium max-md:size-7 max-md:rounded-sm max-md:text-[0.8125rem] ${statToneClasses[stat.tone]}`}
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
              <span className="text-[0.8125rem] text-muted max-md:text-2xs">
                {stat.label}
              </span>
            </div>
          </article>
        ))}
      </section>

      {initialCategory &&
      initialCategory !== 'all' &&
      categoryId !== 'all' &&
      selectedCategory ? (
        <section
          className="mb-4 flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3 max-md:flex-wrap"
          role="status"
        >
          <div className="mr-auto grid gap-0.5 max-md:w-full">
            <span className="text-xs2 tracking-[.08em] text-muted uppercase">
              {t('tickets.list.categoryFilter')}
            </span>
            <strong>{selectedCategory.name}</strong>
          </div>
          <button
            className="min-h-10 rounded-sm px-2.5 text-[0.8125rem] text-primary"
            onClick={onBackToCategories}
            type="button"
          >
            {t('tickets.list.backToCategories')}
          </button>
          <button
            className="min-h-10 rounded-sm px-2.5 text-[0.8125rem] text-primary"
            onClick={() => {
              setCategoryId('all');
              setPage(1);
            }}
            type="button"
          >
            {t('tickets.list.clearFilter')}
          </button>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-md border border-border bg-surface max-md:overflow-visible max-md:border-0">
        <header className="flex min-h-[82px] items-center justify-between gap-6 border-b border-border px-6 py-[18px] max-md:block max-md:min-h-0 max-md:border-0 max-md:p-0">
          <div className="flex items-baseline gap-2.5 max-md:hidden">
            <h2 className="text-lg font-medium">
              {organizationWide
                ? t('tickets.list.allTickets')
                : t('tickets.list.yourTickets')}
            </h2>
            <span className="text-[0.8125rem] text-muted">
              {t('tickets.list.results', { count: totalTickets })}
            </span>
          </div>
          <label className="flex h-10 w-[min(300px,35vw)] items-center gap-2 rounded-sm border border-border px-3 focus-within:border-focus focus-within:outline-3 focus-within:outline-focus max-md:h-11 max-md:w-full">
            <Icon name="search" size={15} />
            <span className="sr-only">{t('tickets.list.searchLabel')}</span>
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-ink outline-0 focus-visible:!outline-none"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={t('tickets.list.searchPlaceholder')}
              type="search"
              value={query}
            />
          </label>
        </header>

        <div className="flex gap-2.5 border-b border-border px-6 py-3 max-md:gap-2 max-md:overflow-x-auto max-md:border-0 max-md:px-0 max-md:pt-3 max-md:pb-4 max-md:[contain:paint] max-md:[scrollbar-width:none] max-md:[&_.ui-select-field]:shrink-0 max-md:[&_.ui-select-field__control]:min-h-9 max-md:[&_.ui-select-field__control]:rounded-full max-md:[&_.ui-select-field__control]:py-1.5 max-md:[&_.ui-select-field__control]:text-xs">
          <SelectField
            className="max-md:!rounded-full"
            hideLabel
            label={t('tickets.filters.status.label')}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            value={status}
          >
            <option value="all">{t('tickets.filters.status.all')}</option>
            <option value="Open">{t('tickets.status.OPEN')}</option>
            <option value="In progress">
              {t('tickets.status.IN_PROGRESS')}
            </option>
            <option value="Resolved">{t('tickets.status.RESOLVED')}</option>
            <option value="Closed">{t('tickets.status.CLOSED')}</option>
          </SelectField>
          <SelectField
            className="max-md:!rounded-full"
            hideLabel
            label={t('tickets.filters.priority.label')}
            onChange={(event) => {
              setPriority(event.target.value);
              setPage(1);
            }}
            value={priority}
          >
            <option value="all">{t('tickets.filters.priority.all')}</option>
            <option value="High">{t('tickets.priority.HIGH')}</option>
            <option value="Medium">{t('tickets.priority.MEDIUM')}</option>
            <option value="Low">{t('tickets.priority.LOW')}</option>
          </SelectField>
          <SelectField
            className="max-md:!rounded-full"
            hideLabel
            label={t('tickets.filters.category.label')}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setPage(1);
            }}
            value={categoryId}
          >
            <option value="all">{t('tickets.filters.category.all')}</option>
            {activeCategories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            className="max-md:!rounded-full"
            hideLabel
            label={t('tickets.filters.sort.label')}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
            value={sort}
          >
            <option value="newest">{t('tickets.filters.sort.newest')}</option>
            <option value="oldest">{t('tickets.filters.sort.oldest')}</option>
          </SelectField>
          <button
            aria-label={t('tickets.filters.more')}
            className="hidden size-9 min-w-9 rounded-full border border-border bg-surface text-ink max-md:block"
            onClick={() => setShowFilters(true)}
            type="button"
          >
            ≡
          </button>
        </div>

        <AsyncState
          emptyDescription={
            query ||
            status !== 'all' ||
            priority !== 'all' ||
            categoryId !== 'all'
              ? t('tickets.list.empty.filteredDescription')
              : t('tickets.list.empty.description')
          }
          emptyTitle={
            query ||
            status !== 'all' ||
            priority !== 'all' ||
            categoryId !== 'all'
              ? t('tickets.empty')
              : t('tickets.list.empty.title')
          }
          error={tickets.error}
          errorTitle={t('tickets.list.errorTitle')}
          isEmpty={currentTickets.length === 0}
          onRetry={tickets.reload}
          status={tickets.status}
        >
          <TicketListResults
            activePage={page}
            filteredTickets={currentTickets}
            onOpenTicket={onOpenTicket}
            onPageChange={setPage}
            onShowAllMobile={() => setShowAllMobile(true)}
            pageCount={pageCount}
            pageSize={30}
            showAllMobile={showAllMobile}
          />
        </AsyncState>
      </section>

      {showFilters ? (
        <TicketFilterSheet
          activeCategories={activeCategories}
          categoryId={categoryId}
          onCategoryChange={(value) => {
            setCategoryId(value);
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
        />
      ) : null}
    </div>
  );
}
