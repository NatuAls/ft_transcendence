import { Alert, Button, EmptyState, Icon, SelectField } from 'ui';
import { useMemo, useRef, useState } from 'react';
import { getInitials } from '../../app/text';
import { AdminDialog } from './AdminDialog';
import { initialUsers } from './adminData';
import type { AdminDialogKind, AdminUser } from './adminData';

export function GlobalAdminPage() {
  const [dialog, setDialog] = useState<AdminDialogKind>(null);
  const [users, setUsers] = useState(initialUsers);
  const [selectedUser, setSelectedUser] = useState<AdminUser>(initialUsers[0]);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [state, setState] = useState('all');
  const [feedback, setFeedback] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
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

  function saveUser(kind: Exclude<AdminDialogKind, null>, data: FormData) {
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
  return (
    <div className="mx-auto max-w-[1200px] p-9 max-[1000px]:px-[18px] max-[1000px]:py-6">
      <section className="flex justify-between">
        <div>
          <span className="text-[10px] tracking-[.08em] text-muted">
            PLATFORM ADMINISTRATION
          </span>
          <h1 className="my-2 text-[30px] font-medium">Users</h1>
          <p className="text-[13px] leading-[1.2] text-muted">
            Manage platform accounts, organization access and account state.
          </p>
        </div>
        <Button onClick={() => setDialog('create')}>Invite user</Button>
      </section>
      <section className="my-[26px] grid grid-cols-4 gap-3 max-[1000px]:grid-cols-2">
        {[
          [String(users.length), 'Sample users'],
          [
            String(users.filter((user) => user[5] === 'Active').length),
            'Active',
          ],
          [
            String(users.filter((user) => user[4] === 'Global admin').length),
            'Administrators',
          ],
          [
            String(
              new Set(
                users.map((user) => user[3]).filter((value) => value !== '—'),
              ).size,
            ),
            'Organizations',
          ],
        ].map(([v, l]) => (
          <article
            className="grid gap-[5px] rounded-md border border-border bg-surface p-[18px]"
            key={l}
          >
            <strong className="text-[22px]">{v}</strong>
            <span className="text-[10px] text-muted">{l}</span>
          </article>
        ))}
      </section>
      <section className="overflow-hidden rounded-md border border-border bg-surface">
        {feedback ? (
          <Alert
            aria-live="polite"
            className="!rounded-none !border-0 !border-l-[3px] !py-2.5 !text-[11px] !text-muted"
            role="status"
            tone="success"
          >
            {feedback}
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
        <div className="grid w-full grid-cols-[2fr_1fr_1fr_1fr_25px] items-center gap-2.5 border-t border-border bg-surface-secondary px-[18px] py-[13px] text-left text-[9px] text-muted max-[1000px]:grid-cols-[2fr_1fr_1fr_20px] max-[1000px]:[&>span:nth-child(2)]:hidden">
          <span>USER</span>
          <span>ORGANIZATION</span>
          <span>GLOBAL ROLE</span>
          <span>STATE</span>
          <span />
        </div>
        {filteredUsers.map((user) => (
          <button
            aria-label={`Edit ${user[1]}`}
            className="grid w-full grid-cols-[2fr_1fr_1fr_1fr_25px] items-center gap-2.5 border-t border-border px-[18px] py-[13px] text-left text-[11px] max-[1000px]:grid-cols-[2fr_1fr_1fr_20px] max-[1000px]:[&>span:nth-child(2)]:hidden"
            key={user[1]}
            onClick={() => {
              if (user[5] === 'Invitation pending') return;
              setSelectedUser(user);
              setDialog('edit');
            }}
            disabled={user[5] === 'Invitation pending'}
            type="button"
          >
            <span className="flex items-center gap-2.5">
              <b className="grid size-8 place-items-center rounded-full bg-[#d8e5df] text-[9px] text-primary">
                {user[0]}
              </b>
              <span className="grid">
                <strong className="text-[11px]">{user[1]}</strong>
                <small className="text-[9px] text-muted">{user[2]}</small>
              </span>
            </span>
            <span className="text-[11px]">{user[3]}</span>
            <span className="text-[11px]">{user[4]}</span>
            <span
              className={`text-[11px] ${user[5] === 'Suspended' ? 'text-danger' : ''}`}
            >
              ● {user[5]}
            </span>
            <span>⋯</span>
          </button>
        ))}
        {!filteredUsers.length ? (
          <EmptyState
            description="Adjust the search, role or state filters."
            title="No users match these filters"
          />
        ) : null}
        <footer className="p-4 text-[10px] text-muted">
          Showing {filteredUsers.length} of {users.length} sample users
        </footer>
      </section>
      {dialog && (
        <AdminDialog
          key={dialog}
          kind={dialog}
          onClose={() => setDialog(null)}
          onSave={(data) => saveUser(dialog, data)}
          user={selectedUser}
        />
      )}
    </div>
  );
}
