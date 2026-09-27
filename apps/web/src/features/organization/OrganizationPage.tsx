import { Alert, Button, IconButton, Tabs } from 'ui';
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
    <div className="relative mx-auto max-w-[1160px] p-10 max-md:px-4 max-md:py-6">
      <header className="flex items-end justify-between max-md:items-start">
        <div>
          <span className="text-[11px] tracking-[.08em] text-muted max-md:hidden">
            ORGANIZATION
          </span>
          <h1 className="my-2 text-[30px] font-medium max-md:text-[22px]">
            {organizationName}
          </h1>
          <p className="text-sm text-muted max-md:hidden">
            Manage members, roles, categories and organization settings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-success max-md:hidden">
            Organization admin
          </span>
          <Button
            className="max-md:!min-h-9 max-md:!px-2.5"
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
      <section className="my-5 mt-7 grid grid-cols-4 gap-3 max-md:my-[18px] max-md:grid-cols-2">
        {[
          [String(memberRows.length), 'Members'],
          [
            String(memberRows.filter((row) => row[3] === 'Agent').length),
            'Support agents',
          ],
          ['24', 'Open tickets'],
          [String(categoryRows.length), 'Categories'],
        ].map(([value, label]) => (
          <article
            className="grid gap-[5px] rounded-md border border-border bg-surface p-[18px]"
            key={label}
          >
            <strong className="text-[22px] font-medium">{value}</strong>
            <span className="text-[11px] text-muted">{label}</span>
          </article>
        ))}
      </section>
      {feedback ? (
        <Alert
          aria-live="polite"
          className="-mt-1.5 mb-[18px] !py-2.5 !text-[11px] !text-muted"
          role="status"
          tone="success"
        >
          {feedback}
        </Alert>
      ) : null}
      <section className="w-[calc(100%_-_270px)] overflow-hidden rounded-md border border-border bg-surface max-[900px]:w-full">
        <header className="flex items-center justify-between p-5 max-md:p-4">
          <div>
            <h2 className="text-base font-medium">{title}</h2>
            <p className="mt-1.5 text-[11px] text-muted max-md:hidden">
              {description}
            </p>
          </div>
          <Button
            className="max-md:!min-h-9 max-md:!px-2.5"
            onClick={openCreateDialog}
          >
            {tab === 'members'
              ? 'Add member'
              : tab === 'roles'
                ? 'Create role'
                : 'Create category'}
          </Button>
        </header>
        <div className="overflow-auto border-y border-border px-[15px] max-md:px-[5px]">
          <Tabs
            activeTab={tab}
            items={[
              { id: 'members', label: 'Members' },
              { id: 'roles', label: 'Access roles' },
              { id: 'categories', label: 'Categories' },
            ]}
            label="Organization settings"
            onChange={setTab}
          />
        </div>
        <div className="organization-table" role="table">
          <div
            className="grid grid-cols-[2fr_1fr_1fr] items-center gap-3 bg-surface-secondary px-[18px] py-[11px] text-[9px] text-muted max-md:hidden"
            role="row"
          >
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
              <div
                className="grid grid-cols-[1fr_44px] border-t border-border"
                key={row[1]}
                role="row"
              >
                <button
                  aria-label={
                    tab === 'categories'
                      ? `View tickets in ${row[1]}`
                      : `Open ${row[1]}`
                  }
                  className="grid min-h-[68px] w-full grid-cols-[2fr_1fr_1fr] items-center gap-3 px-[18px] py-[11px] text-left hover:bg-surface-secondary max-md:grid-cols-[1fr_auto] max-md:p-3 max-md:[&>span:nth-child(2)]:hidden"
                  onClick={() => {
                    setSelectedName(row[1]);
                    if (tab === 'categories') onOpenCategory(row[1]);
                    else setDialog(editor);
                  }}
                  type="button"
                >
                  <span className="flex items-center gap-2.5">
                    <b className="grid size-8 place-items-center rounded-full bg-[#d8e5df] text-[9px] text-primary">
                      {row[0]}
                    </b>
                    <span className="grid gap-1">
                      <strong className="text-xs">{row[1]}</strong>
                      <small className="text-[10px] text-muted max-md:max-w-[180px] max-md:overflow-hidden max-md:text-ellipsis max-md:whitespace-nowrap">
                        {row[2]}
                      </small>
                    </span>
                  </span>
                  <span className="text-[10px] text-muted">{row[3]}</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-muted">
                    <i className="size-1.5 rounded-full bg-success" />
                    {row[4]}
                  </span>
                </button>
                <IconButton
                  label={`Edit ${row[1]}`}
                  icon="more"
                  onClick={() => {
                    setSelectedName(row[1]);
                    setDeleteContext(null);
                    setDialog(editor);
                  }}
                  size="sm"
                />
              </div>
            );
          })}
        </div>
      </section>
      <aside className="absolute top-[258px] right-10 w-[250px] rounded-md border border-border bg-surface p-5 max-[900px]:static max-[900px]:mt-4 max-[900px]:w-full max-md:hidden">
        <h2 className="text-base font-medium">
          {tab === 'roles'
            ? 'Permission summary'
            : tab === 'categories'
              ? 'Routing overview'
              : 'Ticket categories'}
        </h2>
        <p className="mt-1.5 text-[11px] text-muted">
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
          <div
            className="mt-[18px] grid grid-cols-[12px_1fr_auto] gap-[7px]"
            key={label}
          >
            <span className="text-[9px] text-brand-mint">●</span>
            <strong className="text-[10px]">{label}</strong>
            <small className="text-[10px] text-muted">{value}</small>
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
