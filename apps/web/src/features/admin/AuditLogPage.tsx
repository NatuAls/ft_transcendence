import { Button, Pagination, SelectField, TextField } from 'ui';
import { useMemo, useState } from 'react';
import * as adminApi from '../../api/admin';
import type { AuditEntry, AuditFilters } from '../../api/admin';
import { AsyncState } from '../../core/async/AsyncState';
import { useAsync } from '../../core/async/useAsync';
import { useVisibleInterval } from '../../core/async/useVisibleInterval';
import { useTranslation } from '../../core/i18n';
import {
  AUDIT_ACTION_GROUPS,
  AUDIT_ENTITIES,
  auditActionKey,
} from './auditCatalog';

/**
 * The audit trail of the platform (PR 2.4), with `audit:read`: who did what,
 * when and from where.
 *
 * The filters live in the address (R2), so a filtered view survives a reload
 * and can be sent to somebody; the page is the API's (R3). An entry opens to
 * show what the list leaves out — the state before and after, read from
 * `GET /admin/audit-logs/:id` only when somebody opens it — as JSON text,
 * never as markup. The first page refreshes every minute while visible
 * (R14): new entries arrive there, and moving the ground under somebody
 * reading page three would be worse than not refreshing it.
 */
export function AuditLogPage({
  initialFilters,
  onFiltersChange,
}: {
  initialFilters: AuditFilters;
  onFiltersChange: (params: Record<string, string | undefined>) => void;
}) {
  const { t, i18n } = useTranslation();
  const [filters, setFilters] = useState<AuditFilters>(initialFilters);
  const page = filters.page ?? 1;
  const entries = useAsync(
    () => adminApi.listAuditLogs(filters),
    [
      filters.action,
      filters.actorId,
      filters.entity,
      filters.from,
      filters.to,
      page,
    ],
  );
  useVisibleInterval(entries.reload, 60_000, page === 1);
  // Para el filtro y para poner nombre a quien aparece en el registro.
  const people = useAsync(() => adminApi.listUsers({}), []);
  const names = useMemo(
    () =>
      new Map(
        (people.data?.data ?? []).map((user) => [
          user.id,
          user.profile?.displayName || user.username,
        ]),
      ),
    [people.data],
  );
  const personOptions = useMemo(
    () =>
      (people.data?.data ?? [])
        .map((user) => ({
          label: `${user.profile?.displayName || user.username} (@${user.username})`,
          value: user.id,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, i18n.language)),
    [i18n.language, people.data],
  );

  const when = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const filtered = Boolean(
    filters.action ||
    filters.actorId ||
    filters.entity ||
    filters.from ||
    filters.to,
  );
  const meta = entries.data?.meta;

  function apply(next: AuditFilters) {
    const clean: AuditFilters = {
      ...next,
      page: next.page && next.page > 1 ? next.page : undefined,
    };
    setFilters(clean);
    onFiltersChange({
      action: clean.action,
      actor: clean.actorId,
      entity: clean.entity,
      from: clean.from,
      page: clean.page ? String(clean.page) : undefined,
      to: clean.to,
    });
  }

  /** Changing a filter goes back to the first page. */
  const filter =
    (key: Exclude<keyof AuditFilters, 'page'>) => (value: string) =>
      apply({ ...filters, [key]: value || undefined, page: undefined });

  return (
    <div className="mx-auto max-w-[1200px] p-9 max-[1000px]:px-[18px] max-[1000px]:py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-2xs tracking-[.08em] text-muted">
            {t('admin.eyebrow')}
          </span>
          <h1 className="my-2 text-[1.875rem] font-medium">
            {t('admin.audit.title')}
          </h1>
          <p className="max-w-[720px] text-[0.8125rem] leading-[1.4] text-muted">
            {t('admin.audit.description')}
          </p>
        </div>
        <Button
          disabled={entries.status === 'loading'}
          onClick={entries.reload}
          variant="secondary"
        >
          {entries.status === 'loading'
            ? t('common.state.refreshing')
            : t('common.actions.refresh')}
        </Button>
      </header>

      <section className="mt-6 overflow-hidden rounded-md border border-border bg-surface">
        <div className="grid grid-cols-[repeat(5,minmax(0,1fr))] items-end gap-3 p-4 max-[1000px]:grid-cols-2 max-md:grid-cols-1">
          <SelectField
            label={t('admin.audit.entity')}
            onChange={(event) => filter('entity')(event.target.value)}
            value={filters.entity ?? ''}
          >
            <option value="">{t('admin.audit.allEntities')}</option>
            {AUDIT_ENTITIES.map((entity) => (
              <option key={entity} value={entity}>
                {t(`admin.audit.entities.${entity}`)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t('admin.audit.action')}
            onChange={(event) => filter('action')(event.target.value)}
            value={filters.action ?? ''}
          >
            <option value="">{t('admin.audit.allActions')}</option>
            {Object.entries(AUDIT_ACTION_GROUPS).map(([group, actions]) => (
              <optgroup key={group} label={t(`admin.audit.groups.${group}`)}>
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {t(`admin.audit.actions.${auditActionKey(action)}`)}
                  </option>
                ))}
              </optgroup>
            ))}
          </SelectField>
          <SelectField
            label={t('admin.audit.person')}
            onChange={(event) => filter('actorId')(event.target.value)}
            value={filters.actorId ?? ''}
          >
            <option value="">{t('admin.audit.allPeople')}</option>
            {filters.actorId &&
            !personOptions.some(
              (option) => option.value === filters.actorId,
            ) ? (
              <option value={filters.actorId}>
                {t('admin.audit.selectedPerson')}
              </option>
            ) : null}
            {personOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <TextField
            label={t('admin.audit.from')}
            max={filters.to}
            onChange={(event) => filter('from')(event.target.value)}
            type="date"
            value={filters.from ?? ''}
          />
          <TextField
            label={t('admin.audit.to')}
            min={filters.from}
            onChange={(event) => filter('to')(event.target.value)}
            type="date"
            value={filters.to ?? ''}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs2 text-muted">
          <span aria-live="polite">
            {meta ? t('admin.audit.total', { count: meta.total }) : null}
            {page === 1 ? ` · ${t('admin.audit.autoRefresh')}` : null}
          </span>
          {filtered ? (
            <Button
              onClick={() => apply({ page: undefined })}
              size="compact"
              variant="secondary"
            >
              {t('admin.audit.clear')}
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,0.8fr)] gap-3 border-t border-border bg-surface-secondary px-[18px] py-[11px] text-3xs text-muted max-md:hidden">
          <span>{t('admin.audit.columns.when')}</span>
          <span>{t('admin.audit.columns.who')}</span>
          <span>{t('admin.audit.columns.what')}</span>
          <span>{t('admin.audit.columns.on')}</span>
          <span>{t('admin.audit.columns.ip')}</span>
        </div>
        <AsyncState
          emptyDescription={t('admin.audit.emptyDescription')}
          emptyTitle={t('admin.audit.emptyTitle')}
          error={entries.error}
          errorTitle={t('admin.audit.errorTitle')}
          isEmpty={!entries.data?.data.length}
          onRetry={entries.reload}
          status={
            // Una recarga con datos ya en pantalla no los tapa con el
            // esqueleto: se siguen leyendo mientras llegan los nuevos.
            entries.status === 'loading' && entries.data
              ? 'success'
              : entries.status
          }
        >
          <ul>
            {(entries.data?.data ?? []).map((entry) => (
              <EntryRow
                entry={entry}
                key={entry.id}
                name={
                  entry.actor
                    ? (names.get(entry.actor.id) ?? `@${entry.actor.username}`)
                    : t('admin.audit.noActor')
                }
                when={when.format(new Date(entry.createdAt))}
              />
            ))}
          </ul>
        </AsyncState>
        {meta && meta.pages > 1 ? (
          // Un botón por página: con muchas, que se desplace la fila y no
          // la pantalla entera.
          <div className="max-w-full overflow-x-auto border-t border-border px-4 py-3">
            <Pagination
              currentPage={page}
              label={t('admin.audit.pagination')}
              onPageChange={(next) => apply({ ...filters, page: next })}
              totalPages={meta.pages}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function EntryRow({
  entry,
  name,
  when,
}: {
  entry: AuditEntry;
  name: string;
  when: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <li className="border-t border-border first:border-t-0">
      <details onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,0.8fr)] items-center gap-3 px-[18px] py-3 text-xs2 hover:bg-surface-secondary focus-visible:outline-3 focus-visible:outline-focus max-md:grid-cols-1 max-md:gap-1 max-md:px-4 [&::-webkit-details-marker]:hidden">
          <time
            className="text-muted max-md:order-3"
            dateTime={entry.createdAt}
          >
            {when}
          </time>
          <span className="truncate max-md:order-2">{name}</span>
          <strong className="font-medium max-md:order-1">
            {t(`admin.audit.actions.${auditActionKey(entry.action)}`, {
              defaultValue: entry.action,
            })}
          </strong>
          <span className="truncate text-muted max-md:order-4">
            {t(`admin.audit.entities.${entry.entity}`, {
              defaultValue: entry.entity,
            })}
          </span>
          <span className="truncate text-muted max-md:order-5">
            {entry.ip ?? '—'}
          </span>
        </summary>
        {open ? <EntryDetail id={entry.id} /> : null}
      </details>
    </li>
  );
}

function EntryDetail({ id }: { id: string }) {
  const { t } = useTranslation();
  const detail = useAsync(() => adminApi.getAuditLog(id), [id]);
  const data = detail.data;
  return (
    <div className="grid gap-4 border-t border-border bg-surface-secondary px-[18px] py-4 max-md:px-4">
      <AsyncState
        error={detail.error}
        errorTitle={t('admin.audit.detailError')}
        loading={
          <p className="text-xs text-muted" role="status">
            {t('admin.audit.detailLoading')}
          </p>
        }
        onRetry={detail.reload}
        status={detail.status}
      >
        {data ? (
          <>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs2">
              {data.entityId ? (
                <>
                  <dt className="text-muted">{t('admin.audit.entityId')}</dt>
                  <dd className="break-all font-mono">{data.entityId}</dd>
                </>
              ) : null}
              {data.userAgent ? (
                <>
                  <dt className="text-muted">{t('admin.audit.userAgent')}</dt>
                  <dd className="break-words">{data.userAgent}</dd>
                </>
              ) : null}
              {data.apiKeyId ? (
                <>
                  <dt className="text-muted">{t('admin.audit.apiKey')}</dt>
                  <dd className="break-all font-mono">{data.apiKeyId}</dd>
                </>
              ) : null}
            </dl>
            <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
              <Snapshot label={t('admin.audit.before')} value={data.before} />
              <Snapshot label={t('admin.audit.after')} value={data.after} />
            </div>
          </>
        ) : null}
      </AsyncState>
    </div>
  );
}

/** A recorded state, as JSON text: React writes it as text, never as HTML. */
function Snapshot({
  label,
  value,
}: {
  label: string;
  value: Record<string, unknown> | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0">
      <h3 className="text-xs font-medium">{label}</h3>
      {value ? (
        <pre className="mt-1.5 rounded-sm border border-border bg-surface p-3 text-xs break-words whitespace-pre-wrap">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : (
        <p className="mt-1.5 text-xs text-muted">{t('admin.audit.nothing')}</p>
      )}
    </div>
  );
}
