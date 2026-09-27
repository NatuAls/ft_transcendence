import { Alert, BrandMark, Button, EmptyState, Icon, SelectField } from 'ui';
import { useMemo, useRef, useState } from 'react';
import { getInitials } from '../../app/text';
import { AdminDialog } from './AdminDialog';
import { initialUsers } from './adminData';
import type { AdminDialogKind, AdminUser } from './adminData';

export function GlobalAdminPage({
  onOrganizations,
  onExit,
}: {
  onOrganizations: () => void;
  onExit: () => void;
}) {
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
      const name = value('name');
      setUsers((current) => [
        ...current,
        [
          getInitials(name),
          name,
          value('email'),
          'No organization',
          value('role'),
          value('state'),
        ],
      ]);
      setFeedback(`${name} was created in this frontend preview.`);
    } else if (kind === 'edit') {
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
    } else {
      setUsers((current) =>
        current.filter((user) => user[2] !== selectedUser[2]),
      );
      setFeedback(`${selectedUser[1]} was deleted from the frontend preview.`);
    }
    setDialog(null);
  }
  return (
    <div className="min-h-dvh bg-canvas">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col bg-[#183039] px-[18px] py-[26px] text-white max-[1000px]:hidden">
        <div className="flex items-center gap-2.5">
          <BrandMark className="!size-9" />
          <strong>HelpDesk Lite</strong>
        </div>
        <nav className="mt-[50px] grid gap-1.5 [&>*]:flex [&>*]:gap-3 [&>*]:rounded-[9px] [&>*]:p-[13px] [&>*]:text-left">
          <span aria-current="page" className="bg-white/12">
            <Icon name="users" size={18} /> Users
          </span>
          <button onClick={onOrganizations} type="button">
            <Icon name="building" size={18} /> Organizations
          </button>
        </nav>
        <button
          className="mt-auto flex items-center gap-3 rounded-[9px] p-[13px] text-left"
          onClick={onExit}
          type="button"
        >
          <span className="grid size-[34px] place-items-center rounded-full bg-[#d8e5df] text-primary">
            AR
          </span>
          Ana Ruiz
        </button>
      </aside>
      <main className="pl-60 max-[1000px]:pl-0">
        <header className="flex h-[72px] items-center gap-[30px] border-b border-border bg-surface px-9">
          <strong className="flex-1">Platform administration</strong>
          <button
            className="text-xs text-muted"
            onClick={() => searchRef.current?.focus()}
            type="button"
          >
            <Icon className="mr-1" name="search" size={15} /> Search users
          </button>
          <button
            aria-label="Return to workspace"
            className="grid size-[34px] place-items-center rounded-full bg-[#d8e5df] text-[10px]"
            onClick={onExit}
            type="button"
          >
            AR
          </button>
        </header>
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
            <Button onClick={() => setDialog('create')}>Create user</Button>
          </section>
          <section className="my-[26px] grid grid-cols-4 gap-3 max-[1000px]:grid-cols-2">
            {[
              [String(users.length), 'Sample users'],
              [
                String(users.filter((user) => user[5] === 'Active').length),
                'Active',
              ],
              [
                String(
                  users.filter((user) => user[4] === 'Global admin').length,
                ),
                'Administrators',
              ],
              [
                String(
                  new Set(
                    users
                      .map((user) => user[3])
                      .filter((value) => value !== 'No organization'),
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
            <header className="flex items-center gap-[9px] p-4">
              <h2 className="flex-1 text-base font-medium">Platform users</h2>
              <label className="flex h-10 items-center rounded-sm border border-border p-2.5 focus-within:border-focus focus-within:outline-3 focus-within:outline-focus/20">
                <Icon className="mr-1" name="search" size={14} />{' '}
                <span className="sr-only">Search platform users</span>
                <input
                  className="border-0 bg-transparent outline-0"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name or email"
                  ref={searchRef}
                  type="search"
                  value={query}
                />
              </label>
              <SelectField
                hideLabel
                label="Roles"
                onChange={(event) => setRole(event.target.value)}
                value={role}
              >
                <option value="all">All roles</option>
                <option value="User">User</option>
                <option value="Global admin">Global admin</option>
              </SelectField>
              <SelectField
                hideLabel
                label="States"
                onChange={(event) => setState(event.target.value)}
                value={state}
              >
                <option value="all">All states</option>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
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
                className="grid w-full grid-cols-[2fr_1fr_1fr_1fr_25px] items-center gap-2.5 border-t border-border px-[18px] py-[13px] text-left text-[11px] max-[1000px]:grid-cols-[2fr_1fr_1fr_20px] max-[1000px]:[&>span:nth-child(2)]:hidden"
                key={user[1]}
                onClick={() => {
                  setSelectedUser(user);
                  setDialog('edit');
                }}
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
        </div>
      </main>
      {dialog && (
        <AdminDialog
          key={dialog}
          kind={dialog}
          onClose={() => setDialog(null)}
          onDelete={() => setDialog('delete')}
          onSave={(data) => saveUser(dialog, data)}
          user={selectedUser}
        />
      )}
    </div>
  );
}
