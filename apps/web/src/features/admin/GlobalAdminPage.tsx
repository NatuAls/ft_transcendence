import { Alert, Button, EmptyState, Icon, SelectField } from 'ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { OrgRole } from 'contracts';
import * as adminApi from '../../api/admin';
import * as rolesApi from '../../api/roles';
import { previewMode } from '../../app/session';
import { getInitials } from '../../app/text';
import type { OrganizationSummary } from '../organizations/organizationsData';
import { AdminDialog } from './AdminDialog';
import { initialUsers } from './adminData';
import type { AdminDialogKind, AdminUser } from './adminData';

const ORGANIZATION_ROLES: Record<string, OrgRole> = {
  Agent: 'AGENT',
  Member: 'MEMBER',
  'Organization admin': 'ORG_ADMIN',
};

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/** An account of the API as the row the table already knows how to draw. */
function rowFrom(user: adminApi.PlatformUser): AdminUser {
  const name = user.profile?.displayName || user.username;
  const organizations = user._count.memberships;
  return [
    getInitials(name),
    name,
    user.email,
    organizations
      ? `${organizations} ${organizations === 1 ? 'organization' : 'organizations'}`
      : '—',
    user.globalRole === 'GLOBAL_ADMIN' ? 'Global admin' : 'Standard user',
    user.isActive ? 'Active' : 'Suspended',
  ];
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
  const [dialog, setDialog] = useState<AdminDialogKind>(null);
  const [users, setUsers] = useState<AdminUser[]>(
    previewMode ? initialUsers : [],
  );
  const [selectedUser, setSelectedUser] = useState<AdminUser>(initialUsers[0]);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [state, setState] = useState('all');
  const [feedback, setFeedback] = useState('');
  const [failure, setFailure] = useState('');
  const [loading, setLoading] = useState(!previewMode);
  // Rows are display tuples; the API needs the account behind each address.
  const [accounts, setAccounts] = useState<
    Record<string, adminApi.PlatformUser>
  >({});
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((current) => current + 1);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (previewMode) return;
    let active = true;
    Promise.all([adminApi.listUsers({}), rolesApi.listPlatformReservations()])
      .then(([page, reservations]) => {
        if (!active) return;
        setUsers([
          ...page.data.map(rowFrom),
          ...reservations.map((reservation): AdminUser => [
            getInitials(reservation.email),
            reservation.email,
            reservation.email,
            '—',
            'Global admin',
            'Invitation pending',
          ]),
        ]);
        setAccounts(
          Object.fromEntries(page.data.map((user) => [user.email, user])),
        );
        setFailure('');
      })
      .catch((error: unknown) => {
        if (active) setFailure(messageOf(error, 'Users could not be read.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [version]);

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const matchesQuery = `${user[1]} ${user[2]}`
          .toLowerCase()
          .includes(query.trim().toLowerCase());
        const matchesRole = role === 'all' || user[4] === role;
        const matchesState = state === 'all' || user[5] === state;
        return matchesQuery && matchesRole && matchesState;
      }),
    [query, role, state, users],
  );

  const selectedAccount = accounts[selectedUser[2]];
  const selectedIsSelf = selectedAccount?.id === currentUserId;
  const selectedIsPrimary = Boolean(selectedAccount?.isPrimary);

  function saveUser(kind: Exclude<AdminDialogKind, null>, data: FormData) {
    if (!previewMode) {
      setDialog(null);
      void saveToApi(kind, data);
      return;
    }
    const value = (name: string) => String(data.get(name) ?? '').trim();
    if (kind === 'create') {
      const email = value('email');
      const name = value('name') || email.split('@')[0] || 'Invited user';
      const platformAccess = value('role');
      setUsers((current) => [
        ...current,
        [
          getInitials(name),
          name,
          email,
          platformAccess === 'Global admin' ? '—' : value('organization'),
          platformAccess,
          'Invitation pending',
        ],
      ]);
      setFeedback(`Invitation prepared for ${email}.`);
    } else {
      const name = value('name');
      setUsers((current) =>
        current.map((user) =>
          user[2] === selectedUser[2]
            ? [
                getInitials(name),
                name,
                value('email'),
                user[3],
                value('role'),
                value('state'),
              ]
            : user,
        ),
      );
      setFeedback(`${name} was updated.`);
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
        if (value('role') === 'Global admin') {
          const result = await rolesApi.assignPlatformRole({
            email,
            globalRole: 'GLOBAL_ADMIN',
          });
          setFeedback(
            result.outcome === 'RESERVED'
              ? `Invitation sent to ${email}: platform administration is reserved until they create the account and confirm the address.`
              : `${result.user?.displayName ?? email} already has an account and is now a platform administrator.`,
          );
        } else {
          const organizationId = value('organization');
          if (!organizationId) {
            setFailure(
              'Create an organization first: a standard user is invited into one.',
            );
            return;
          }
          const result = await rolesApi.assignOrganizationRole(organizationId, {
            email,
            role: ORGANIZATION_ROLES[value('organization-role')] ?? 'MEMBER',
          });
          setFeedback(
            result.outcome === 'RESERVED'
              ? `Invitation sent to ${email}: the role is reserved until they create the account and confirm the address.`
              : `${result.user?.displayName ?? email} already has an account and now has the role.`,
          );
        }
      } else if (selectedAccount) {
        const name = value('name');
        if (name && name !== selectedUser[1]) {
          await adminApi.updateUserName(selectedAccount.id, name);
        }
        const nextRole = value('role');
        if (nextRole && nextRole !== selectedUser[4]) {
          await adminApi.setGlobalRole(
            selectedAccount.id,
            nextRole === 'Global admin' ? 'GLOBAL_ADMIN' : 'USER',
          );
        }
        const nextState = value('state');
        if (nextState && nextState !== selectedUser[5]) {
          await adminApi.setUserStatus(
            selectedAccount.id,
            nextState === 'Active',
          );
        }
        setFeedback(`${name || selectedUser[1]} was updated.`);
      }
    } catch (error) {
      setFailure(messageOf(error, 'The change could not be saved.'));
    }
    reload();
  }

  async function deleteSelected() {
    if (!selectedAccount) return;
    setDialog(null);
    setFeedback('');
    setFailure('');
    try {
      await adminApi.deleteUser(selectedAccount.id);
      setFeedback(`${selectedUser[1]}'s account was deleted.`);
    } catch (error) {
      setFailure(messageOf(error, 'The account could not be deleted.'));
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
            PLATFORM ADMINISTRATION
          </span>
          <h1 className="my-2 text-[1.875rem] font-medium">Users</h1>
          <p className="text-[0.8125rem] leading-[1.2] text-muted">
            Manage platform accounts, organization access and account state.
          </p>
        </div>
        <Button onClick={() => setDialog('create')}>Invite user</Button>
      </section>
      <section className="my-[26px] grid grid-cols-4 gap-3 max-[1000px]:grid-cols-2">
        {[
          [
            String(
              users.filter((user) => user[5] !== 'Invitation pending').length,
            ),
            previewMode ? 'Sample users' : 'Accounts',
          ],
          [
            String(users.filter((user) => user[5] === 'Active').length),
            'Active',
          ],
          [
            String(
              users.filter(
                (user) =>
                  user[4] === 'Global admin' &&
                  user[5] !== 'Invitation pending',
              ).length,
            ),
            'Administrators',
          ],
          previewMode
            ? [
                String(
                  new Set(
                    users
                      .map((user) => user[3])
                      .filter((value) => value !== '—'),
                  ).size,
                ),
                'Organizations',
              ]
            : [String(organizations.length), 'Organizations'],
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
            Platform users
          </h2>
          <label className="flex h-10 min-w-0 items-center rounded-sm border border-border p-2.5 focus-within:border-focus focus-within:outline-3 focus-within:outline-focus max-[600px]:col-span-2">
            <Icon className="mr-1" name="search" size={14} />{' '}
            <span className="sr-only">Search platform users</span>
            <input
              className="min-w-0 flex-1 border-0 bg-transparent outline-0 focus-visible:!outline-none"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or email"
              ref={searchRef}
              type="search"
              value={query}
            />
          </label>
          <SelectField
            className="max-[600px]:w-full"
            hideLabel
            label="Roles"
            onChange={(event) => setRole(event.target.value)}
            value={role}
          >
            <option value="all">All roles</option>
            <option value="Standard user">Standard user</option>
            <option value="Global admin">Global admin</option>
          </SelectField>
          <SelectField
            className="max-[600px]:w-full"
            hideLabel
            label="States"
            onChange={(event) => setState(event.target.value)}
            value={state}
          >
            <option value="all">All states</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
            <option value="Invitation pending">Invitation pending</option>
          </SelectField>
        </header>
        <div className="grid w-full grid-cols-[2fr_1fr_1fr_1fr_25px] items-center gap-2.5 border-t border-border bg-surface-secondary px-[18px] py-[13px] text-left text-3xs text-muted max-[1000px]:grid-cols-[2fr_1fr_1fr_20px] max-[1000px]:[&>span:nth-child(2)]:hidden">
          <span>USER</span>
          <span>ORGANIZATION</span>
          <span>GLOBAL ROLE</span>
          <span>STATE</span>
          <span />
        </div>
        {loading ? (
          <p
            className="border-t border-border p-5 text-xs text-muted"
            role="status"
          >
            Loading users…
          </p>
        ) : null}
        {filteredUsers.map((user) => (
          <button
            aria-label={`Edit ${user[1]}`}
            className="grid w-full grid-cols-[2fr_1fr_1fr_1fr_25px] items-center gap-2.5 border-t border-border px-[18px] py-[13px] text-left text-xs2 max-[1000px]:grid-cols-[2fr_1fr_1fr_20px] max-[1000px]:[&>span:nth-child(2)]:hidden"
            key={`${user[2]}-${user[5]}`}
            onClick={() => {
              if (user[5] === 'Invitation pending') return;
              setSelectedUser(user);
              setDialog('edit');
            }}
            disabled={user[5] === 'Invitation pending'}
            type="button"
          >
            <span className="flex items-center gap-2.5">
              <b className="grid size-8 place-items-center rounded-full bg-[#d8e5df] text-3xs text-primary">
                {user[0]}
              </b>
              <span className="grid">
                <strong className="text-xs2">{user[1]}</strong>
                <small className="text-3xs text-muted">{user[2]}</small>
              </span>
            </span>
            <span className="text-xs2">{user[3]}</span>
            <span className="text-xs2">{user[4]}</span>
            <span
              className={`text-xs2 ${user[5] === 'Suspended' ? 'text-danger' : ''}`}
            >
              ● {user[5]}
            </span>
            <span>⋯</span>
          </button>
        ))}
        {!loading && !filteredUsers.length ? (
          <EmptyState
            description="Adjust the search, role or state filters."
            title="No users match these filters"
          />
        ) : null}
        <footer className="p-4 text-2xs text-muted">
          Showing {filteredUsers.length} of {users.length}
          {previewMode ? ' sample users' : ' accounts and invitations'}
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
                    ? 'This is the primary administrator, created at deployment: its role and state cannot be changed from here.'
                    : selectedIsSelf
                      ? 'This is your own account: another administrator has to change your role or state.'
                      : 'The e-mail address is the sign-in identity and is not edited from here. Suspending blocks access; deleting closes the account.',
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
          user={selectedUser}
        />
      )}
    </div>
  );
}
