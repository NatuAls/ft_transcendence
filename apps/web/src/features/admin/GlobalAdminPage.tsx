import { Alert, Button, Icon, SelectField } from 'ui';
import { useId, useMemo, useRef, useState } from 'react';
import { orgRoleSchema } from 'contracts';
import * as adminApi from '../../api/admin';
import * as rolesApi from '../../api/roles';
import { previewMode } from '../../app/session';
import { getInitials } from '../../app/text';
import type { OrganizationSummary } from '../organizations/organizationsData';
import { AdminDialog } from './AdminDialog';
import { initialUsers } from './adminData';
import type {
  AccountState,
  AdminDialogKind,
  AdminUser,
  PlatformAccess,
} from './adminData';
import { errorKey } from '../../core/api/errors';
import { AsyncState } from '../../core/async/AsyncState';
import { useAsync } from '../../core/async/useAsync';
import { useVisibleInterval } from '../../core/async/useVisibleInterval';
import { useTranslation } from '../../core/i18n';

/** An account of the API as the row the table already knows how to draw. */
function rowFrom(user: adminApi.PlatformUser): AdminUser {
  const name = user.profile?.displayName || user.username;
  return {
    email: user.email,
    initials: getInitials(name),
    name,
    organizations: user._count.memberships || null,
    role: user.globalRole === 'GLOBAL_ADMIN' ? 'GLOBAL_ADMIN' : 'USER',
    state: user.isActive ? 'ACTIVE' : 'SUSPENDED',
  };
}

/**
 * Platform users: list, edit, suspend, change the platform role and delete -
 * the CRUD of the advanced permissions module. Sample rows in the preview,
 * `GET /users` and friends in the application. "Invite user" goes through the
 * role assignment by e-mail: the person creates their own account.
 */
export function GlobalAdminPage({
  currentUserId,
  organizations,
}: {
  currentUserId: string;
  organizations: OrganizationSummary[];
}) {
  const { t, i18n } = useTranslation();
  const activityId = useId();
  const [dialog, setDialog] = useState<AdminDialogKind>(null);
  // Nadie elegido hasta que se abre una fila. Antes arrancaba con la primera
  // fila de MUESTRA también en la aplicación real.
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<'all' | PlatformAccess>('all');
  const [state, setState] = useState<'all' | AccountState>('all');
  const [feedback, setFeedback] = useState('');
  const [failure, setFailure] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Rows are what the table draws; the API needs the account behind each
  // address, so both travel together through the one load.
  const directory = useAsync(async () => {
    if (previewMode) return { users: initialUsers, accounts: {} };
    const [page, reservations] = await Promise.all([
      adminApi.listUsers({}),
      rolesApi.listPlatformReservations(),
    ]);
    return {
      users: [
        ...page.data.map(rowFrom),
        ...reservations.map((reservation): AdminUser => ({
          email: reservation.email,
          initials: getInitials(reservation.email),
          name: reservation.email,
          organizations: null,
          role: 'GLOBAL_ADMIN',
          state: 'PENDING',
        })),
      ],
      accounts: Object.fromEntries(
        page.data.map((user) => [user.email, user]),
      ) as Record<string, adminApi.PlatformUser>,
    };
  }, []);
  // Memoizado: el `?? []` crearía un array nuevo en cada render y el
  // useMemo del filtrado se recalcularía siempre.
  const users = useMemo<AdminUser[]>(
    () => directory.data?.users ?? [],
    [directory.data],
  );
  const accounts: Record<string, adminApi.PlatformUser> =
    directory.data?.accounts ?? {};
  const reload = directory.reload;

  /**
   * Los contadores de toda la plataforma (PR 2.3). Aparte de la lista: ésta
   * trae como mucho cien cuentas, y contar sobre ella se quedaba corto en
   * cuanto hubiera más. Se refrescan solos cada minuto con la pestaña a la
   * vista, y con «Refresh» (R14). La vista previa no tiene API: cuenta sobre
   * sus filas de muestra, como antes.
   */
  const platform = useAsync(
    async () =>
      previewMode
        ? null
        : { at: Date.now(), stats: await adminApi.getPlatformStats() },
    [],
  );
  useVisibleInterval(platform.reload, 60_000, !previewMode);
  const platformStats = platform.data?.stats;

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const matchesQuery = `${user.name} ${user.email}`
          .toLowerCase()
          .includes(query.trim().toLowerCase());
        const matchesRole = role === 'all' || user.role === role;
        const matchesState = state === 'all' || user.state === state;
        return matchesQuery && matchesRole && matchesState;
      }),
    [query, role, state, users],
  );

  const selectedAccount = selectedUser
    ? accounts[selectedUser.email]
    : undefined;
  const selectedIsSelf = selectedAccount?.id === currentUserId;
  const selectedIsPrimary = Boolean(selectedAccount?.isPrimary);

  /** Cuántas organizaciones, o el nombre de una en la vista previa. */
  function organizationsText(value: AdminUser['organizations']) {
    return typeof value === 'number'
      ? t('admin.users.organizations', { count: value })
      : (value ?? '—');
  }

  function saveUser(kind: Exclude<AdminDialogKind, null>, data: FormData) {
    if (!previewMode) {
      setDialog(null);
      void saveToApi(kind, data);
      return;
    }
    const value = (name: string) => String(data.get(name) ?? '').trim();
    if (kind === 'create') {
      const email = value('email');
      const name =
        value('name') || email.split('@')[0] || t('admin.users.invitedUser');
      const platformAccess: PlatformAccess =
        value('role') === 'GLOBAL_ADMIN' ? 'GLOBAL_ADMIN' : 'USER';
      directory.setData((current) => ({
        accounts: current?.accounts ?? {},
        users: [
          ...(current?.users ?? []),
          {
            email,
            initials: getInitials(name),
            name,
            organizations:
              platformAccess === 'GLOBAL_ADMIN' ? null : value('organization'),
            role: platformAccess,
            state: 'PENDING',
          },
        ],
      }));
      setFeedback(t('admin.users.feedback.invitationPrepared', { email }));
    } else if (selectedUser) {
      const name = value('name');
      directory.setData((current) => ({
        accounts: current?.accounts ?? {},
        users: (current?.users ?? []).map((user) =>
          user.email === selectedUser.email
            ? {
                ...user,
                email: value('email'),
                initials: getInitials(name),
                name,
                role:
                  value('role') === 'GLOBAL_ADMIN' ? 'GLOBAL_ADMIN' : 'USER',
                state: value('state') === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
              }
            : user,
        ),
      }));
      setFeedback(t('admin.users.feedback.updated', { name }));
    }
    setDialog(null);
  }

  /**
   * One call per field that actually changed, in the order that keeps the
   * account consistent if one of them is refused: name, then role, then
   * state. Fields the dialog disabled are not in the form at all.
   */
  async function saveToApi(
    kind: Exclude<AdminDialogKind, null>,
    data: FormData,
  ) {
    const value = (name: string) => String(data.get(name) ?? '').trim();
    setFeedback('');
    setFailure('');
    try {
      if (kind === 'create') {
        const email = value('email');
        if (value('role') === 'GLOBAL_ADMIN') {
          const result = await rolesApi.assignPlatformRole({
            email,
            globalRole: 'GLOBAL_ADMIN',
          });
          setFeedback(
            result.outcome === 'RESERVED'
              ? t('admin.users.feedback.platformReserved', { email })
              : t('admin.users.feedback.platformApplied', {
                  name: result.user?.displayName ?? email,
                }),
          );
        } else {
          const organizationId = value('organization');
          if (!organizationId) {
            setFailure(t('admin.users.feedback.organizationFirst'));
            return;
          }
          const requested = orgRoleSchema.safeParse(value('organization-role'));
          const result = await rolesApi.assignOrganizationRole(organizationId, {
            email,
            role: requested.success ? requested.data : 'MEMBER',
          });
          setFeedback(
            result.outcome === 'RESERVED'
              ? t('admin.users.feedback.roleReserved', { email })
              : t('admin.users.feedback.roleApplied', {
                  name: result.user?.displayName ?? email,
                }),
          );
        }
      } else if (selectedUser && selectedAccount) {
        const name = value('name');
        if (name && name !== selectedUser.name) {
          await adminApi.updateUserName(selectedAccount.id, name);
        }
        const nextRole = value('role');
        if (nextRole && nextRole !== selectedUser.role) {
          await adminApi.setGlobalRole(
            selectedAccount.id,
            nextRole === 'GLOBAL_ADMIN' ? 'GLOBAL_ADMIN' : 'USER',
          );
        }
        const nextState = value('state');
        if (nextState && nextState !== selectedUser.state) {
          await adminApi.setUserStatus(
            selectedAccount.id,
            nextState === 'ACTIVE',
          );
        }
        setFeedback(
          t('admin.users.feedback.updated', {
            name: name || selectedUser.name,
          }),
        );
      }
    } catch (error) {
      setFailure(t(errorKey(error)));
    }
    reload();
  }

  async function deleteSelected() {
    if (!selectedUser || !selectedAccount) return;
    setDialog(null);
    setFeedback('');
    setFailure('');
    try {
      await adminApi.deleteUser(selectedAccount.id);
      setFeedback(
        t('admin.users.feedback.deleted', { name: selectedUser.name }),
      );
    } catch (error) {
      setFailure(t(errorKey(error)));
    }
    reload();
  }

  const organizationOptions = previewMode
    ? ['Northstar Studio', 'Helio Labs', 'Orbit Finance'].map((name) => ({
        label: name,
        value: name,
      }))
    : organizations.map((organization) => ({
        label: organization.name,
        value: organization.id,
      }));

  return (
    <div className="mx-auto max-w-[1200px] p-9 max-[1000px]:px-[18px] max-[1000px]:py-6">
      <section className="flex justify-between">
        <div>
          <span className="text-2xs tracking-[.08em] text-muted">
            {t('admin.eyebrow')}
          </span>
          <h1 className="my-2 text-[1.875rem] font-medium">
            {t('admin.users.title')}
          </h1>
          <p className="text-[0.8125rem] leading-[1.2] text-muted">
            {t('admin.users.description')}
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedUser(null);
            setDialog('create');
          }}
        >
          {t('admin.users.invite')}
        </Button>
      </section>
      <section className="my-[26px] grid grid-cols-4 gap-3 max-[1000px]:grid-cols-2">
        {[
          [
            String(
              platformStats?.users ??
                users.filter((user) => user.state !== 'PENDING').length,
            ),
            previewMode
              ? t('admin.users.cards.sampleUsers')
              : t('admin.users.cards.accounts'),
          ],
          [
            String(
              platformStats?.activeUsers ??
                users.filter((user) => user.state === 'ACTIVE').length,
            ),
            t('admin.users.cards.active'),
          ],
          [
            String(
              users.filter(
                (user) =>
                  user.role === 'GLOBAL_ADMIN' && user.state !== 'PENDING',
              ).length,
            ),
            t('admin.users.cards.administrators'),
          ],
          previewMode
            ? [
                String(
                  new Set(
                    users
                      .map((user) => user.organizations)
                      .filter((value) => typeof value === 'string'),
                  ).size,
                ),
                t('admin.users.cards.organizations'),
              ]
            : [
                String(platformStats?.organizations ?? organizations.length),
                t('admin.users.cards.organizations'),
              ],
        ].map(([v, l]) => (
          <article
            className="grid gap-[5px] rounded-md border border-border bg-surface p-[18px]"
            key={l}
          >
            <strong className="text-[1.375rem]">{v}</strong>
            <span className="text-2xs text-muted">{l}</span>
          </article>
        ))}
      </section>
      {platformStats ? (
        <section
          aria-labelledby={activityId}
          className="-mt-3 mb-[26px] rounded-md border border-border bg-surface p-[18px]"
        >
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-medium" id={activityId}>
                {t('admin.stats.title')}
              </h2>
              <p aria-live="polite" className="mt-1.5 text-xs2 text-muted">
                {platform.status === 'loading'
                  ? t('common.state.refreshing')
                  : t('common.state.updatedAt', {
                      time: new Intl.DateTimeFormat(i18n.language, {
                        timeStyle: 'short',
                      }).format(platform.data!.at),
                    })}
              </p>
            </div>
            <Button
              disabled={platform.status === 'loading'}
              onClick={platform.reload}
              size="compact"
              variant="secondary"
            >
              {t('common.actions.refresh')}
            </Button>
          </header>
          <dl className="mt-4 grid grid-cols-4 gap-3 max-[1000px]:grid-cols-2">
            {(
              [
                ['tickets', platformStats.tickets],
                // OPEN o IN_PROGRESS: así lo cuenta la API, y así se dice.
                // «Open» a secas sería la palabra de un solo estado.
                ['openTickets', platformStats.openTickets],
                ['messages', platformStats.messages],
                ['attachments', platformStats.attachments],
              ] as const
            ).map(([key, value]) => (
              <div
                className="grid gap-1 rounded-md bg-surface-secondary p-4"
                key={key}
              >
                <dt className="text-xs2 text-muted">
                  {t(`admin.stats.${key}`)}
                </dt>
                <dd className="text-lg font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : platform.status === 'error' ? (
        <div className="-mt-3 mb-[26px]">
          <AsyncState
            error={platform.error}
            errorTitle={t('admin.stats.errorTitle')}
            onRetry={platform.reload}
            status="error"
          >
            {null}
          </AsyncState>
        </div>
      ) : null}
      <section className="overflow-hidden rounded-md border border-border bg-surface">
        {feedback ? (
          <Alert
            aria-live="polite"
            className="!rounded-none !border-0 !border-l-[3px] !py-2.5 !text-xs2 !text-muted"
            role="status"
            tone="success"
          >
            {feedback}
          </Alert>
        ) : null}
        {failure ? (
          <Alert
            className="!rounded-none !border-0 !border-l-[3px] !py-2.5 !text-xs2"
            tone="danger"
          >
            {failure}
          </Alert>
        ) : null}
        <header className="flex items-center gap-[9px] p-4 max-[600px]:grid max-[600px]:grid-cols-2">
          <h2 className="flex-1 text-base font-medium max-[600px]:col-span-2">
            {t('admin.users.panelTitle')}
          </h2>
          <label className="flex h-10 min-w-0 items-center rounded-sm border border-border p-2.5 focus-within:border-focus focus-within:outline-3 focus-within:outline-focus max-[600px]:col-span-2">
            <Icon className="mr-1" name="search" size={14} />{' '}
            <span className="sr-only">{t('admin.users.search')}</span>
            <input
              className="min-w-0 flex-1 border-0 bg-transparent outline-0 focus-visible:!outline-none"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('admin.users.searchPlaceholder')}
              ref={searchRef}
              type="search"
              value={query}
            />
          </label>
          <SelectField
            className="max-[600px]:w-full"
            hideLabel
            label={t('admin.users.roles')}
            onChange={(event) =>
              setRole(event.target.value as 'all' | PlatformAccess)
            }
            value={role}
          >
            <option value="all">{t('admin.users.allRoles')}</option>
            <option value="USER">{t('admin.platformRole.USER')}</option>
            <option value="GLOBAL_ADMIN">
              {t('admin.platformRole.GLOBAL_ADMIN')}
            </option>
          </SelectField>
          <SelectField
            className="max-[600px]:w-full"
            hideLabel
            label={t('admin.users.states')}
            onChange={(event) =>
              setState(event.target.value as 'all' | AccountState)
            }
            value={state}
          >
            <option value="all">{t('admin.users.allStates')}</option>
            <option value="ACTIVE">{t('admin.accountState.ACTIVE')}</option>
            <option value="SUSPENDED">
              {t('admin.accountState.SUSPENDED')}
            </option>
            <option value="PENDING">{t('admin.accountState.PENDING')}</option>
          </SelectField>
        </header>
        <div className="grid w-full grid-cols-[2fr_1fr_1fr_1fr_25px] items-center gap-2.5 border-t border-border bg-surface-secondary px-[18px] py-[13px] text-left text-3xs text-muted max-[1000px]:grid-cols-[2fr_1fr_1fr_20px] max-[1000px]:[&>span:nth-child(2)]:hidden">
          <span>{t('admin.users.columns.user')}</span>
          <span>{t('admin.users.columns.organization')}</span>
          <span>{t('admin.users.columns.globalRole')}</span>
          <span>{t('admin.users.columns.state')}</span>
          <span />
        </div>
        {directory.status === 'loading' ? (
          <p
            className="border-t border-border p-5 text-xs text-muted"
            role="status"
          >
            {t('admin.users.loading')}
          </p>
        ) : null}
        {filteredUsers.map((user) => (
          <button
            aria-label={t('admin.users.edit', { name: user.name })}
            className="grid w-full grid-cols-[2fr_1fr_1fr_1fr_25px] items-center gap-2.5 border-t border-border px-[18px] py-[13px] text-left text-xs2 max-[1000px]:grid-cols-[2fr_1fr_1fr_20px] max-[1000px]:[&>span:nth-child(2)]:hidden"
            key={`${user.email}-${user.state}`}
            onClick={() => {
              if (user.state === 'PENDING') return;
              setSelectedUser(user);
              setDialog('edit');
            }}
            disabled={user.state === 'PENDING'}
            type="button"
          >
            <span className="flex items-center gap-2.5">
              <b className="grid size-8 place-items-center rounded-full bg-surface-secondary text-3xs text-primary">
                {user.initials}
              </b>
              <span className="grid">
                <strong className="text-xs2">{user.name}</strong>
                <small className="text-3xs text-muted">{user.email}</small>
              </span>
            </span>
            <span className="text-xs2">
              {organizationsText(user.organizations)}
            </span>
            <span className="text-xs2">
              {t(`admin.platformRole.${user.role}`)}
            </span>
            <span
              className={`text-xs2 ${user.state === 'SUSPENDED' ? 'text-danger' : ''}`}
            >
              ● {t(`admin.accountState.${user.state}`)}
            </span>
            <span>⋯</span>
          </button>
        ))}
        {directory.status !== 'loading' ? (
          <AsyncState
            emptyDescription={t('admin.users.emptyDescription')}
            emptyTitle={t('admin.users.emptyTitle')}
            error={directory.error}
            errorTitle={t('admin.users.errorTitle')}
            isEmpty={!filteredUsers.length}
            onRetry={reload}
            status={directory.status}
          >
            {null}
          </AsyncState>
        ) : null}
        <footer className="p-4 text-2xs text-muted">
          {t(
            previewMode ? 'admin.users.showingSample' : 'admin.users.showing',
            {
              shown: filteredUsers.length,
              total: users.length,
            },
          )}
        </footer>
      </section>
      {dialog && (
        <AdminDialog
          key={dialog}
          kind={dialog}
          locked={
            previewMode || dialog === 'create'
              ? undefined
              : {
                  email: true,
                  reason: selectedIsPrimary
                    ? t('admin.users.locked.primary')
                    : selectedIsSelf
                      ? t('admin.users.locked.self')
                      : t('admin.users.locked.email'),
                  role: selectedIsSelf || selectedIsPrimary,
                  state: selectedIsSelf || selectedIsPrimary,
                }
          }
          onClose={() => setDialog(null)}
          onDelete={
            !previewMode &&
            dialog === 'edit' &&
            selectedAccount &&
            !selectedIsSelf &&
            !selectedIsPrimary
              ? () => void deleteSelected()
              : undefined
          }
          onSave={(data) => saveUser(dialog, data)}
          organizationOptions={organizationOptions}
          user={dialog === 'edit' ? (selectedUser ?? undefined) : undefined}
        />
      )}
    </div>
  );
}
