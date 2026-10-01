import { Alert, Button, IconButton, Tabs } from 'ui';
import { useState } from 'react';
import { getInitials } from '../../app/text';
import { OrganizationDialog } from './OrganizationDialog';
import {
  labelFromEmail,
  organizationFixture,
  roleRowsForMembers,
} from './organizationData';
import type {
  DeleteContext,
  OrganizationDialogKind,
  OrganizationRow,
  OrgTab,
} from './organizationData';

export function OrganizationPage({
  canManageCategories,
  canManageMembers,
  canManageOrganization,
  canReadMembers,
  canReadStats,
  onOpenCategory,
  onOrganizationDescriptionChange,
  onOrganizationNameChange,
  onOrganizationDeleted,
  organizationDescription,
  organizationId,
  organizationName,
  organizationRole,
}: {
  canManageCategories: boolean;
  canManageMembers: boolean;
  canManageOrganization: boolean;
  canReadMembers: boolean;
  canReadStats: boolean;
  onOpenCategory: (category: string) => void;
  onOrganizationDescriptionChange: (description: string) => void;
  onOrganizationNameChange: (name: string) => void;
  onOrganizationDeleted: () => void;
  organizationDescription: string;
  organizationId: string;
  organizationName: string;
  organizationRole: 'AGENT' | 'GLOBAL_ADMIN' | 'MEMBER' | 'ORG_ADMIN';
}) {
  const fixture = organizationFixture(organizationId, organizationDescription);
  const [tab, setTab] = useState<OrgTab>(
    canReadMembers ? 'members' : 'categories',
  );
  const [dialog, setDialog] = useState<OrganizationDialogKind>(null);
  const [deleteContext, setDeleteContext] = useState<DeleteContext>(null);
  const [selectedName, setSelectedName] = useState('Maya Singh');
  const [memberRows, setMemberRows] = useState(fixture.members);
  const roleRows = roleRowsForMembers(memberRows);
  const [categoryRows, setCategoryRows] = useState(fixture.categories);
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
        ? `Review the fixed access levels used inside ${organizationName}.`
        : 'Create categories used to classify and route support requests.';
  const tableGridClass =
    tab === 'members'
      ? 'grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_44px]'
      : tab === 'categories'
        ? canReadStats
          ? 'grid-cols-[minmax(0,2fr)_minmax(0,1fr)_44px]'
          : 'grid-cols-[minmax(0,1fr)_44px]'
        : 'grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]';
  const rowContentClass =
    tab === 'members'
      ? 'col-span-3 grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] max-md:[&>span:nth-child(2)]:hidden'
      : tab === 'categories'
        ? canReadStats
          ? 'col-span-2 grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'
          : 'col-span-1 grid-cols-1'
        : 'col-span-3 grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] max-md:col-span-1 max-md:[&>span:nth-child(2)]:hidden';
  const rowMobileGridClass =
    tab === 'roles'
      ? 'max-md:grid-cols-1'
      : 'max-md:grid-cols-[minmax(0,1fr)_40px]';

  function openCreateDialog() {
    if (tab === 'roles') return;
    setSelectedName('');
    setDeleteContext(null);
    setDialog(tab === 'members' ? 'add-member' : 'category');
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
            ? [row[0], row[1], row[2], value('role'), row[4]]
            : row,
        ),
      );
      setFeedback(`${selectedName}'s organization access was updated.`);
    } else if (kind === 'settings') {
      onOrganizationNameChange(value('organization-name'));
      onOrganizationDescriptionChange(value('description'));
      setFeedback(
        'Organization details were updated in this frontend preview.',
      );
    } else if (kind === 'category') {
      const name = value('category-name');
      const nextRow: OrganizationRow = [
        getInitials(name),
        name,
        value('description'),
        selectedRow?.[3] ?? '0 tickets',
        '',
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
            {canManageOrganization ? 'ORGANIZATION SETTINGS' : 'ORGANIZATION'}
          </span>
          <h1 className="my-2 text-[30px] font-medium max-md:text-[22px]">
            {organizationName}
          </h1>
          <p className="text-sm text-muted max-md:hidden">
            {canManageOrganization
              ? organizationDescription
              : organizationRole === 'AGENT'
                ? 'Review ticket workload and the categories used by this organization.'
                : 'View your access and the categories available when creating tickets.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canManageOrganization ? (
            <>
              <span className="text-[11px] text-success max-md:hidden">
                Organization admin tools
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
            </>
          ) : null}
        </div>
      </header>
      {canReadStats ? (
        <section className="my-5 mt-7 grid grid-cols-4 gap-3 max-md:my-[18px] max-md:grid-cols-2">
          {[
            [
              String(memberRows.filter((row) => row[4] === 'Active').length),
              'Members',
            ],
            [
              String(
                memberRows.filter(
                  (row) => row[3] === 'Agent' && row[4] === 'Active',
                ).length,
              ),
              'Support agents',
            ],
            [String(fixture.openTickets), 'Open tickets'],
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
      ) : (
        <section className="my-5 mt-7 grid grid-cols-2 gap-3 max-md:my-[18px] max-md:grid-cols-1">
          <article className="grid gap-1 rounded-md border border-border bg-surface p-[18px]">
            <span className="text-[11px] text-muted">Your access</span>
            <strong className="text-base font-medium">Member</strong>
          </article>
          <article className="grid gap-1 rounded-md border border-border bg-surface p-[18px]">
            <span className="text-[11px] text-muted">Ticket visibility</span>
            <strong className="text-base font-medium">Your tickets only</strong>
          </article>
        </section>
      )}
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
      <div
        className={`grid min-w-0 items-start gap-5 max-[900px]:block ${canReadStats ? 'grid-cols-[minmax(0,1fr)_250px]' : 'grid-cols-1'}`}
      >
        <section className="min-w-0 w-full overflow-hidden rounded-md border border-border bg-surface">
          <header className="flex items-center justify-between p-5 max-md:p-4">
            <div>
              <h2 className="text-base font-medium">{title}</h2>
              <p className="mt-1.5 text-[11px] text-muted max-md:hidden">
                {description}
              </p>
            </div>
            {(tab === 'members' && canManageMembers) ||
            (tab === 'categories' && canManageCategories) ? (
              <Button
                className="max-md:!min-h-9 max-md:!px-2.5"
                onClick={openCreateDialog}
              >
                {tab === 'members' ? 'Add member' : 'Create category'}
              </Button>
            ) : null}
          </header>
          {canReadMembers ? (
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
          ) : null}
          <div className="organization-table" role="table">
            <div
              className={`grid items-center gap-3 bg-surface-secondary px-[18px] py-[11px] text-[9px] text-muted max-md:hidden ${tableGridClass}`}
              role="row"
            >
              <span>
                {tab === 'members'
                  ? 'MEMBER'
                  : tab === 'roles'
                    ? 'ROLE'
                    : 'CATEGORY'}
              </span>
              {tab !== 'categories' || canReadStats ? (
                <span>
                  {tab === 'members'
                    ? 'ROLE'
                    : tab === 'roles'
                      ? 'MEMBERS'
                      : 'OPEN TICKETS'}
                </span>
              ) : null}
              {tab !== 'categories' ? (
                <span>{tab === 'roles' ? 'ACCESS' : 'STATUS'}</span>
              ) : null}
              {tab !== 'roles' ? <span aria-hidden="true" /> : null}
            </div>
            {rows.map((row) => {
              const editor = tab === 'members' ? 'edit-member' : 'category';
              const canEdit =
                tab === 'members'
                  ? canManageMembers && row[4] === 'Active'
                  : tab === 'categories'
                    ? canManageCategories
                    : false;
              const canOpen = tab === 'categories' || canEdit;
              return (
                <div
                  className={`grid border-t border-border ${tableGridClass} ${rowMobileGridClass}`}
                  key={row[1]}
                  role="row"
                >
                  <button
                    aria-label={
                      tab === 'categories'
                        ? `View tickets in ${row[1]}`
                        : `Open ${row[1]}`
                    }
                    className={`grid min-h-[68px] w-full items-center gap-3 px-[18px] py-[11px] text-left enabled:hover:bg-surface-secondary disabled:cursor-default max-md:col-span-1 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:p-3 ${rowContentClass}`}
                    disabled={!canOpen}
                    onClick={() => {
                      setSelectedName(row[1]);
                      if (tab === 'categories') onOpenCategory(row[1]);
                      else if (canEdit) setDialog(editor);
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
                    {tab !== 'categories' || canReadStats ? (
                      <span className="text-[10px] text-muted">{row[3]}</span>
                    ) : null}
                    {tab !== 'categories' ? (
                      <span className="flex items-center gap-1.5 text-[10px] text-muted">
                        {tab === 'members' ? (
                          <i
                            className={`size-1.5 rounded-full ${row[4] === 'Invited' ? 'bg-warning' : 'bg-success'}`}
                          />
                        ) : null}
                        {row[4] === 'Invited' ? (
                          <>
                            Invited
                            <span className="max-md:hidden">
                              {' '}
                              · frontend mock
                            </span>
                          </>
                        ) : (
                          row[4]
                        )}
                      </span>
                    ) : null}
                  </button>
                  {canEdit ? (
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
                  ) : tab !== 'roles' ? (
                    <span aria-hidden="true" />
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
        {canReadStats ? (
          <aside className="min-w-0 w-full rounded-md border border-border bg-surface p-5 max-[900px]:mt-4 max-md:hidden">
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
                  ['Create tickets', '3 access roles'],
                  ['Handle tickets', '2 access roles'],
                  ['Manage members', '1 access role'],
                  ['Manage categories', '1 access role'],
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
        ) : null}
      </div>
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
          organizationDescription={organizationDescription}
          selectedName={selectedName}
          selectedRow={selectedRow}
        />
      ) : null}
    </div>
  );
}
