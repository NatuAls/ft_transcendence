import { BrandMark, Button, SelectField } from 'ui';
import { useMemo, useRef, useState } from 'react';
import { getInitials } from '../../app/text';
import { AdminDialog } from './AdminDialog';
import { initialUsers } from './adminData';
import type { AdminDialogKind, AdminUser } from './adminData';
import './admin.css';

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
    <div className="admin-shell">
      <aside>
        <div>
          <BrandMark />
          <strong>HelpDesk Lite</strong>
        </div>
        <nav>
          <span aria-current="page" className="active">
            ▣ Users
          </span>
          <button onClick={onOrganizations} type="button">
            ◫ Organizations
          </button>
        </nav>
        <button onClick={onExit} type="button">
          <span>AR</span>Ana Ruiz
        </button>
      </aside>
      <main>
        <header>
          <strong>Platform administration</strong>
          <button
            className="admin-topbar-search"
            onClick={() => searchRef.current?.focus()}
            type="button"
          >
            ⌕ Search users
          </button>
          <button
            aria-label="Return to workspace"
            className="admin-topbar-avatar"
            onClick={onExit}
            type="button"
          >
            AR
          </button>
        </header>
        <div className="admin-page">
          <section className="admin-heading">
            <div>
              <span>PLATFORM ADMINISTRATION</span>
              <h1>Users</h1>
              <p>
                Manage platform accounts, organization access and account state.
              </p>
            </div>
            <Button onClick={() => setDialog('create')}>Create user</Button>
          </section>
          <section className="admin-stats">
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
              <article key={l}>
                <strong>{v}</strong>
                <span>{l}</span>
              </article>
            ))}
          </section>
          <section className="admin-table">
            {feedback ? (
              <p aria-live="polite" className="admin-feedback" role="status">
                {feedback}
              </p>
            ) : null}
            <header>
              <h2>Platform users</h2>
              <label>
                <span aria-hidden="true">⌕</span>{' '}
                <span className="sr-only">Search platform users</span>
                <input
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
            <div className="admin-row admin-row--head">
              <span>USER</span>
              <span>ORGANIZATION</span>
              <span>GLOBAL ROLE</span>
              <span>STATE</span>
              <span />
            </div>
            {filteredUsers.map((user) => (
              <button
                className="admin-row"
                key={user[1]}
                onClick={() => {
                  setSelectedUser(user);
                  setDialog('edit');
                }}
                type="button"
              >
                <span className="admin-user">
                  <b>{user[0]}</b>
                  <span>
                    <strong>{user[1]}</strong>
                    <small>{user[2]}</small>
                  </span>
                </span>
                <span>{user[3]}</span>
                <span>{user[4]}</span>
                <span className={user[5] === 'Suspended' ? 'suspended' : ''}>
                  ● {user[5]}
                </span>
                <span>⋯</span>
              </button>
            ))}
            {!filteredUsers.length ? (
              <p className="admin-empty">No users match these filters.</p>
            ) : null}
            <footer>
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
