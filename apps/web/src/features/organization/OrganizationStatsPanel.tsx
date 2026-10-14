import { Button } from 'ui';
import { useId } from 'react';
import { ticketPrioritySchema, ticketStatusSchema } from 'contracts';
import type { OrganizationStats } from '../../api/organizations';
import { formatDuration } from '../../core/i18n/duration';
import { useTranslation } from '../../core/i18n';

/**
 * The organization's tickets in numbers (PR 2.3), for whoever has
 * `stats:read`. Status and priority use the words of the ticket list, so the
 * same thing is called the same everywhere: «Open» here is the OPEN status,
 * exactly as in the list and in the card above.
 *
 * The page reads the numbers and refreshes them (every minute while the tab is
 * visible, and on demand); this only draws them.
 */
export function OrganizationStatsPanel({
  at,
  loading,
  onRefresh,
  stats,
}: {
  /** When these numbers were read. */
  at: number;
  loading: boolean;
  onRefresh: () => void;
  stats: OrganizationStats;
}) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const time = new Intl.DateTimeFormat(i18n.language, {
    timeStyle: 'short',
  }).format(at);

  return (
    <section
      aria-labelledby={titleId}
      className="mb-5 rounded-md border border-border bg-surface p-5 max-md:p-4"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium" id={titleId}>
            {t('organization.stats.title')}
          </h2>
          <p aria-live="polite" className="mt-1.5 text-xs2 text-muted">
            {loading
              ? t('common.state.refreshing')
              : t('common.state.updatedAt', { time })}
          </p>
        </div>
        <Button
          disabled={loading}
          onClick={onRefresh}
          size="compact"
          variant="secondary"
        >
          {t('common.actions.refresh')}
        </Button>
      </header>
      <dl className="mt-4 grid grid-cols-3 gap-3 max-md:grid-cols-1">
        <Figure label={t('organization.stats.total')} value={stats.total} />
        <Figure
          label={t('organization.stats.unassigned')}
          value={stats.unassigned}
        />
        <Figure
          label={t('organization.stats.firstResponse')}
          value={
            stats.avgFirstResponseSeconds > 0
              ? formatDuration(stats.avgFirstResponseSeconds, i18n.language)
              : t('organization.stats.noFirstResponse')
          }
        />
      </dl>
      <div className="mt-5 grid grid-cols-2 gap-6 max-md:grid-cols-1">
        <Bars
          label={t('organization.stats.byStatus')}
          rows={ticketStatusSchema.options.map((status) => ({
            key: status,
            label: t(`tickets.status.${status}`),
            value: stats.byStatus[status] ?? 0,
          }))}
          total={stats.total}
        />
        <Bars
          label={t('organization.stats.byPriority')}
          rows={ticketPrioritySchema.options.map((priority) => ({
            key: priority,
            label: t(`tickets.priority.${priority}`),
            value: stats.byPriority[priority] ?? 0,
          }))}
          total={stats.total}
        />
      </div>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="grid content-start gap-1 rounded-md bg-surface-secondary p-4">
      <dt className="text-xs2 text-muted">{label}</dt>
      <dd className="text-lg font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** One row per value, with its share of the total as a bar. */
function Bars({
  label,
  rows,
  total,
}: {
  label: string;
  rows: Array<{ key: string; label: string; value: number }>;
  total: number;
}) {
  return (
    <div className="min-w-0">
      <h3 className="text-xs font-medium">{label}</h3>
      <ul className="mt-2.5 grid gap-2.5">
        {rows.map((row) => {
          const share = total ? Math.round((row.value / total) * 100) : 0;
          return (
            <li
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1"
              key={row.key}
            >
              <span className="truncate text-xs2">{row.label}</span>
              <span className="text-xs2 font-medium tabular-nums">
                {row.value}
              </span>
              <span
                aria-hidden="true"
                className="col-span-2 h-2 rounded-full bg-surface-secondary"
              >
                {/* La única excepción al «nada de style» de la guía: el
                    ancho de una barra es un dato, no un estilo. */}
                <span
                  className="block h-2 rounded-full bg-primary"
                  style={{ width: `${share}%` }}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
