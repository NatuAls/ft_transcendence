import { Button } from 'ui';
import { useState } from 'react';
import { getInitials } from '../../app/text';
import { OrganizationDialog } from './OrganizationDialog';
import {
  initialCategories,
  initialMembers,
  initialRoles,
  labelFromEmail,
} from './organizationData';
import type {
  DeleteContext,
  OrganizationDialogKind,
  OrganizationRow,
  OrgTab,
} from './organizationData';
import './organization.css';

export function OrganizationPage({
  onOpenCategory,
  onOrganizationNameChange,
  onOrganizationDeleted,
  organizationName,
}: {
  onOpenCategory: (category: string) => void;
  onOrganizationNameChange: (name: string) => void;
  onOrganizationDeleted: () => void;
  organizationName: string;
}) {
  const [tab, setTab] = useState<OrgTab>('members');
  const [dialog, setDialog] = useState<OrganizationDialogKind>(null);
  const [deleteContext, setDeleteContext] = useState<DeleteContext>(null);
  const [selectedName, setSelectedName] = useState('Maya Singh');
  const [memberRows, setMemberRows] = useState(initialMembers);
  const [roleRows, setRoleRows] = useState(initialRoles);
  const [categoryRows, setCategoryRows] = useState(initialCategories);
  const [feedback, setFeedback] = useState('');
  const rows =
    tab === 'members' ? memberRows : tab === 'roles' ? roleRows : categoryRows;
  const selectedRow = rows.find((row) => row[1] === selectedName);
  const title =
    tab === 'members'
      ? 'Members and access'
      : tab === 'roles'
        ? 'Access roles and permissions'
        : 'Ticket categories';
  const description =
    tab === 'members'
      ? `Changes apply only inside ${organizationName}.`
      : tab === 'roles'
        ? `Configure what members can do inside ${organizationName}.`
        : 'Create categories used to classify and route support requests.';

  function openCreateDialog() {
    setSelectedName('');
    setDeleteContext(null);
    setDialog(
      tab === 'members' ? 'add-member' : tab === 'roles' ? 'role' : 'category',
    );
  }

  function saveDialog(
    kind: Exclude<OrganizationDialogKind, null>,
    data: FormData,
  ) {
    const value = (name: string) => String(data.get(name) ?? '').trim();
    if (kind === 'add-member') {
      const email = value('email');
      const name = labelFromEmail(email);
      setMemberRows((current) => [
        ...current,
        [getInitials(name), name, email, value('role'), 'Invited'],
      ]);
      setFeedback(`Invitation prepared for ${email}.`);
    } else if (kind === 'edit-member') {
      setMemberRows((current) =>
        current.map((row) =>
          row[1] === selectedName
            ? [row[0], row[1], row[2], value('role'), value('state')]
            : row,
        ),
      );
      setFeedback(`${selectedName}'s organization access was updated.`);
    } else if (kind === 'settings') {
      onOrganizationNameChange(value('organization-name'));
      setFeedback(
        'Organization details were updated in this frontend preview.',
      );
    } else if (kind === 'role') {
      const name = value('role-name');
      const permissionCount = data.getAll('permissions').length;
      const nextRow: OrganizationRow = [
        getInitials(name),
        name,
        value('description'),
        selectedRow?.[3] ?? '0 members',
        `${permissionCount} permission${permissionCount === 1 ? '' : 's'}`,
      ];
      setRoleRows((current) =>
        selectedName
          ? current.map((row) => (row[1] === selectedName ? nextRow : row))
          : [...current, nextRow],
      );
      setFeedback(`Role “${name}” was saved.`);
    } else if (kind === 'category') {
      const name = value('category-name');
      const nextRow: OrganizationRow = [
        getInitials(name),
        name,
        value('description'),
        selectedRow?.[3] ?? '0 tickets',
        value('state'),
      ];
      setCategoryRows((current) =>
        selectedName
          ? current.map((row) => (row[1] === selectedName ? nextRow : row))
          : [...current, nextRow],
      );
      setFeedback(`Category “${name}” was saved.`);
    } else if (deleteContext === 'edit-member') {
      setMemberRows((current) =>
        current.filter((row) => row[1] !== selectedName),
      );
      setFeedback(`${selectedName} was removed from the organization.`);
    } else if (deleteContext === 'role') {
      setRoleRows((current) =>
        current.filter((row) => row[1] !== selectedName),
      );
      setFeedback(`Role “${selectedName}” was deleted.`);
    } else if (deleteContext === 'category') {
      setCategoryRows((current) =>
        current.map((row) =>
          row[1] === selectedName
            ? [row[0], row[1], row[2], row[3], 'Archived']
            : row,
        ),
      );
      setFeedback(`Category “${selectedName}” was archived.`);
    } else if (deleteContext === 'settings') {
      onOrganizationDeleted();
    }
    setDialog(null);
    setDeleteContext(null);
  }

  return (
    <div className="organization-page">
      <header className="organization-heading">
        <div>
          <span>ORGANIZATION</span>
          <h1>{organizationName}</h1>
          <p>Manage members, roles, categories and organization settings.</p>
        </div>
        <div>
          <span>Organization admin</span>
          <Button
            onClick={() => {
              setSelectedName(organizationName);
              setDeleteContext(null);
              setDialog('settings');
            }}
            variant="secondary"
          >
            Edit organization
          </Button>
        </div>
      </header>
      <section className="organization-stats">
        {[
          [String(memberRows.length), 'Members'],
          [
            String(memberRows.filter((row) => row[3] === 'Agent').length),
            'Support agents',
          ],
          ['24', 'Open tickets'],
          [String(categoryRows.length), 'Categories'],
        ].map(([value, label]) => (
          <article key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </article>
        ))}
      </section>
      {feedback ? (
        <p aria-live="polite" className="organization-feedback" role="status">
          {feedback}
        </p>
      ) : null}
      <section className="organization-panel">
        <header>
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <Button onClick={openCreateDialog}>
            {tab === 'members'
              ? 'Add member'
              : tab === 'roles'
                ? 'Create role'
                : 'Create category'}
          </Button>
        </header>
        <nav aria-label="Organization settings">
          {(['members', 'roles', 'categories'] as const).map((value) => (
            <button
              aria-current={tab === value ? 'page' : undefined}
              key={value}
              onClick={() => setTab(value)}
              type="button"
            >
              {value === 'roles'
                ? 'Access roles'
                : value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </nav>
        <div className="organization-table" role="table">
          <div className="organization-table__head" role="row">
            <span>
              {tab === 'members'
                ? 'MEMBER'
                : tab === 'roles'
                  ? 'ROLE'
                  : 'CATEGORY'}
            </span>
            <span>
              {tab === 'members'
                ? 'ROLE'
                : tab === 'roles'
                  ? 'MEMBERS'
                  : 'OPEN TICKETS'}
            </span>
            <span>{tab === 'roles' ? 'ACCESS' : 'STATUS'}</span>
          </div>
          {rows.map((row) => {
            const editor =
              tab === 'members'
                ? 'edit-member'
                : tab === 'roles'
                  ? 'role'
                  : 'category';
            return (
              <div className="organization-table__row" key={row[1]} role="row">
                <button
                  aria-label={
                    tab === 'categories'
                      ? `View tickets in ${row[1]}`
                      : `Open ${row[1]}`
                  }
                  className="organization-table__primary"
                  onClick={() => {
                    setSelectedName(row[1]);
                    if (tab === 'categories') onOpenCategory(row[1]);
                    else setDialog(editor);
                  }}
                  type="button"
                >
                  <span className="organization-identity">
                    <b>{row[0]}</b>
                    <span>
                      <strong>{row[1]}</strong>
                      <small>{row[2]}</small>
                    </span>
                  </span>
                  <span>{row[3]}</span>
                  <span className="organization-state">
                    <i />
                    {row[4]}
                  </span>
                </button>
                <button
                  aria-label={`Edit ${row[1]}`}
                  className="organization-table__actions"
                  onClick={() => {
                    setSelectedName(row[1]);
                    setDeleteContext(null);
                    setDialog(editor);
                  }}
                  type="button"
                >
                  ⋯
                </button>
              </div>
            );
          })}
        </div>
      </section>
      <aside className="organization-overview">
        <h2>
          {tab === 'roles'
            ? 'Permission summary'
            : tab === 'categories'
              ? 'Routing overview'
              : 'Ticket categories'}
        </h2>
        <p>
          {tab === 'roles'
            ? 'How access is distributed by role.'
            : tab === 'categories'
              ? 'Open workload by category.'
              : 'Used to route new requests.'}
        </p>
        {(tab === 'roles'
          ? [
              ['Manage members', '2 access roles'],
              ['Manage tickets', '3 access roles'],
              ['Manage categories', '2 access roles'],
              ['View conversations', '3 access roles'],
            ]
          : categoryRows.slice(0, 4).map((row) => [row[1], row[3]])
        ).map(([label, value]) => (
          <div key={label}>
            <span>●</span>
            <strong>{label}</strong>
            <small>{value}</small>
          </div>
        ))}
      </aside>
      {dialog ? (
        <OrganizationDialog
          deleteContext={deleteContext}
          dialog={dialog}
          key={`${dialog}-${deleteContext ?? 'none'}`}
          onClose={() => {
            setDialog(null);
            setDeleteContext(null);
          }}
          onDelete={(context) => {
            setDeleteContext(context);
            setDialog('delete');
          }}
          onSave={(data) => saveDialog(dialog, data)}
          organizationName={organizationName}
          selectedName={selectedName}
          selectedRow={selectedRow}
        />
      ) : null}
    </div>
  );
}
