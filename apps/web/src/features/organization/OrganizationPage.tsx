import { Alert, Button, IconButton, Tabs } from 'ui';
import { useState } from 'react';
import type { OrgRole } from 'contracts';
import * as organizationsApi from '../../api/organizations';
import * as rolesApi from '../../api/roles';
import { previewMode } from '../../app/session';
import { getInitials } from '../../app/text';
import { OrganizationDialog } from './OrganizationDialog';
import { errorMessage } from '../../core/api/errors';
import { AsyncState } from '../../core/async/AsyncState';
import { useAsync } from '../../core/async/useAsync';
import { RealtimeEvents } from '../../core/realtime/socket';
import {
  useOrganizationRoom,
  useRealtimeEvent,
} from '../../core/realtime/useRealtime';
import {
  labelFromEmail,
  organizationFixture,
  roleRowsForMembers,
  rowKey,
} from './organizationData';
import type {
  DeleteContext,
  OrganizationDialogKind,
  OrganizationFixture,
  OrganizationRow,
  OrgTab,
} from './organizationData';

const ROLE_BY_LABEL: Record<string, OrgRole> = {
  Agent: 'AGENT',
  Member: 'MEMBER',
  'Organization admin': 'ORG_ADMIN',
};
const LABEL_BY_ROLE: Record<OrgRole, string> = {
  AGENT: 'Agent',
  MEMBER: 'Member',
  ORG_ADMIN: 'Organization admin',
};

export function OrganizationPage({
  canManageCategories,
  canManageMembers,
  canManageOrganization,
  canReadMembers,
  canReadStats,
  currentUserId,
  onAccessChanged,
  onOpenCategory,
  onOrganizationDescriptionChange,
  onOrganizationNameChange,
  onOrganizationDeleted,
  onOrganizationsChanged,
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
  currentUserId: string;
  onAccessChanged: () => void;
  onOpenCategory: (category: string) => void;
  onOrganizationDescriptionChange: (description: string) => void;
  onOrganizationNameChange: (name: string) => void;
  onOrganizationDeleted: () => void;
  onOrganizationsChanged: (preferredId?: string) => void;
  organizationDescription: string;
  organizationId: string;
  organizationName: string;
  organizationRole: 'AGENT' | 'GLOBAL_ADMIN' | 'MEMBER' | 'ORG_ADMIN';
}) {
  // Sample rows in the preview; the application starts empty and reads the
  // organization from the API below.
  const fixture: OrganizationFixture = previewMode
    ? organizationFixture(organizationId, organizationDescription)
    : {
        categories: [],
        description: organizationDescription,
        members: [],
        openTickets: 0,
      };
  const [tab, setTab] = useState<OrgTab>(
    canReadMembers ? 'members' : 'categories',
  );
  const [dialog, setDialog] = useState<OrganizationDialogKind>(null);
  // Who created the organization: the API lets only them (or a platform
  // administrator) delete it.
  const [deleteContext, setDeleteContext] = useState<DeleteContext>(null);
  const [selectedName, setSelectedName] = useState('Maya Singh');
  const [feedback, setFeedback] = useState('');
  const [failure, setFailure] = useState('');

  /**
   * Todo lo que esta pantalla lee de la API, en una sola carga: las filas que
   * se pintan y los identificadores que necesitan las acciones. Antes salía
   * de siete estados distintos sembrados con los datos de ejemplo, así que la
   * aplicación real enseñaba la organización de muestra hasta que llegaba la
   * respuesta. Ahora hay estado de carga, y los datos de ejemplo se quedan
   * donde deben: en el modo de vista previa.
   */
  const view = useAsync(async () => {
    if (previewMode || !organizationId) {
      return {
        categoryRows: fixture.categories,
        createdById: null as string | null,
        memberRows: fixture.members,
        openTickets: fixture.openTickets,
      };
    }
    const [members, reservations, categories, stats, detail] =
      await Promise.all([
        canReadMembers ? rolesApi.listMembers(organizationId) : null,
        canManageMembers
          ? rolesApi.listOrganizationReservations(organizationId)
          : null,
        organizationsApi.listCategories(organizationId),
        canReadStats
          ? organizationsApi.getOrganizationStats(organizationId)
          : null,
        canManageOrganization
          ? organizationsApi.getOrganization(organizationId)
          : null,
      ]);
    return {
      categoryRows: categories.map((category): OrganizationRow => {
        const count = category._count?.tickets ?? 0;
        return [
          getInitials(category.name),
          category.name,
          category.description ?? '',
          `${count} ${count === 1 ? 'ticket' : 'tickets'}`,
          '',
          category.id,
        ];
      }),
      createdById: detail?.createdById ?? null,
      // Cada fila con su identificador. Antes se guardaban tres diccionarios
      // (miembros, reservas y categorías) con el TEXTO de la fila como clave,
      // y con tres cuentas llamadas igual sólo sobrevivía la última: la
      // pantalla acababa cambiando el rol de otra persona.
      memberRows: [
        ...(members ?? []).map((member): OrganizationRow => [
          getInitials(member.displayName),
          member.displayName,
          member.email,
          LABEL_BY_ROLE[member.role],
          'Active',
          member.userId,
        ]),
        ...(reservations ?? []).map((reservation): OrganizationRow => [
          getInitials(labelFromEmail(reservation.email)),
          reservation.email,
          reservation.waitingFor === 'ACCOUNT'
            ? 'Waiting for the account'
            : 'Waiting for e-mail confirmation',
          LABEL_BY_ROLE[reservation.role],
          'Invited',
          reservation.id,
        ]),
      ],
      openTickets: stats
        ? (stats.byStatus.OPEN ?? 0) + (stats.byStatus.IN_PROGRESS ?? 0)
        : fixture.openTickets,
    };
  }, [
    canManageMembers,
    canManageOrganization,
    canReadMembers,
    canReadStats,
    organizationId,
  ]);

  const memberRows = view.data?.memberRows ?? [];
  const categoryRows = view.data?.categoryRows ?? [];
  // La fila seleccionada, por su identificador y no por su texto: tres
  // cuentas pueden llamarse igual.
  const [selectedKey, setSelectedKey] = useState('');
  const createdById = view.data?.createdById ?? null;
  const openTickets = view.data?.openTickets ?? fixture.openTickets;
  const roleRows = roleRowsForMembers(memberRows);
  const reload = view.reload;

  /**
   * La pantalla se mantiene al día sola (R9).
   *
   * Sin esto, quien tenía abierta la pestaña de miembros no veía llegar a
   * nadie hasta recargar a mano, y era fácil pensar que la persona que
   * acababas de añadir se había perdido. Los eventos de miembros y categorías
   * llegan a la sala `org:<id>`, así que puede llegar uno de OTRA organización
   * a la que también perteneces: se comprueba el identificador antes de
   * recargar. Tras una reconexión se recarga sin más, porque mientras el
   * socket estuvo caído pudo cambiar cualquier cosa.
   */
  const esDeEstaOrganizacion = (payload: unknown): boolean => {
    const cuerpo = payload as
      | { member?: { organizationId?: string }; organizationId?: string }
      | undefined;
    const id = cuerpo?.member?.organizationId ?? cuerpo?.organizationId;
    // Sin identificador no se puede descartar: más vale recargar de más.
    return !id || id === organizationId;
  };
  const recargarSiEsDeAqui = (payload: unknown) => {
    if (esDeEstaOrganizacion(payload)) reload();
  };

  // Sin esto, un administrador de plataforma no recibía NADA de la
  // organización que estaba gestionando: las salas se reparten por
  // pertenencia y él no pertenece a ninguna.
  useOrganizationRoom(previewMode ? undefined : organizationId);

  useRealtimeEvent(RealtimeEvents.memberAdded, recargarSiEsDeAqui);
  useRealtimeEvent(RealtimeEvents.memberUpdated, recargarSiEsDeAqui);
  useRealtimeEvent(RealtimeEvents.memberRemoved, (payload) => {
    if (!esDeEstaOrganizacion(payload)) return;
    const quitado = (payload as { userId?: string } | undefined)?.userId;
    // Si el que sale eres tú, lo que cambia son tus permisos, no una lista
    // (R17): que el armazón relea la sesión y decida qué puedes ver.
    if (quitado && quitado === currentUserId) {
      onAccessChanged();
      return;
    }
    reload();
  });
  // Añadir a alguien por correo crea una RESERVA, no una pertenencia, así que
  // no hay `member.added` que escuchar — y esta pantalla pinta las reservas
  // como filas. Sin estos dos, añadías a alguien y en la otra sesión no
  // aparecía hasta recargar a mano.
  useRealtimeEvent(RealtimeEvents.roleReserved, recargarSiEsDeAqui);
  useRealtimeEvent(RealtimeEvents.roleReservationCancelled, recargarSiEsDeAqui);
  useRealtimeEvent(RealtimeEvents.categoryCreated, recargarSiEsDeAqui);
  useRealtimeEvent(RealtimeEvents.categoryUpdated, recargarSiEsDeAqui);
  useRealtimeEvent(RealtimeEvents.categoryDeleted, recargarSiEsDeAqui);
  useRealtimeEvent(RealtimeEvents.connected, () => reload());

  /** Cambia las filas en local tras una acción, sin esperar a la recarga. */
  function patchRows(
    patch: (
      previous: NonNullable<typeof view.data>,
    ) => Partial<NonNullable<typeof view.data>>,
  ) {
    view.setData((current) =>
      current ? { ...current, ...patch(current) } : current,
    );
  }

  const rows =
    tab === 'members' ? memberRows : tab === 'roles' ? roleRows : categoryRows;
  const selectedRow = rows.find((row) => rowKey(row) === selectedKey);
  // Quién es la fila elegida, sacado de ELLA y no de un diccionario por texto.
  const selectedMemberId =
    selectedRow?.[4] === 'Active' ? selectedRow[5] : undefined;
  const selectedReservationId =
    selectedRow?.[4] === 'Invited' ? selectedRow[5] : undefined;
  const selectedCategoryId =
    tab === 'categories' ? selectedRow?.[5] : undefined;
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
    setSelectedKey('');
    setDeleteContext(null);
    setDialog(tab === 'members' ? 'add-member' : 'category');
  }

  function saveDialog(
    kind: Exclude<OrganizationDialogKind, null>,
    data: FormData,
  ) {
    if (previewMode) {
      savePreview(kind, data);
      return;
    }
    const context = deleteContext;
    setDialog(null);
    setDeleteContext(null);
    setFeedback('');
    setFailure('');
    void saveToApi(kind, context, data);
  }

  /**
   * The same dialogs against the API. Each branch is one call; the lists are
   * read again afterwards, so the screen shows what the server kept and not
   * what the browser assumed.
   */
  async function saveToApi(
    kind: Exclude<OrganizationDialogKind, null>,
    context: DeleteContext,
    data: FormData,
  ) {
    const value = (name: string) => String(data.get(name) ?? '').trim();
    const memberId = selectedMemberId;
    const categoryId = selectedCategoryId;
    try {
      if (kind === 'add-member') {
        const result = await rolesApi.assignOrganizationRole(organizationId, {
          email: value('email'),
          role: ROLE_BY_LABEL[value('role')] ?? 'MEMBER',
        });
        setFeedback(
          result.outcome === 'RESERVED'
            ? `Role reserved for ${result.email}: they join when they create their account with that address and confirm it.`
            : result.outcome === 'UNCHANGED'
              ? `${result.user?.displayName ?? result.email} already had that role.`
              : `${result.user?.displayName ?? result.email} now has access to ${organizationName}.`,
        );
      } else if (kind === 'edit-member') {
        const role = ROLE_BY_LABEL[value('role')] ?? 'MEMBER';
        if (memberId) {
          await rolesApi.changeMemberRole(organizationId, memberId, role);
          if (memberId === currentUserId) onAccessChanged();
        } else {
          // A reservation: assigning again to the same address replaces the
          // role it is waiting with.
          await rolesApi.assignOrganizationRole(organizationId, {
            email: selectedName,
            role,
          });
        }
        setFeedback(`${selectedName}'s organization access was updated.`);
      } else if (kind === 'settings') {
        const updated = await organizationsApi.updateOrganization(
          organizationId,
          {
            description: value('description'),
            name: value('organization-name'),
          },
        );
        onOrganizationNameChange(updated.name);
        onOrganizationDescriptionChange(updated.description ?? '');
        onOrganizationsChanged(organizationId);
        setFeedback('Organization details were updated.');
      } else if (kind === 'category') {
        const input = {
          description: value('description') || undefined,
          name: value('category-name'),
        };
        if (selectedName && categoryId) {
          await organizationsApi.updateCategory(
            organizationId,
            categoryId,
            input,
          );
        } else {
          await organizationsApi.createCategory(organizationId, {
            ...input,
            color: '#0d6c90',
          });
        }
        setFeedback(`Category “${input.name}” was saved.`);
      } else if (context === 'edit-member') {
        const reservationId = selectedReservationId;
        if (memberId) {
          await rolesApi.removeMember(organizationId, memberId);
          setFeedback(`${selectedName} was removed from the organization.`);
        } else if (reservationId) {
          await rolesApi.cancelOrganizationReservation(
            organizationId,
            reservationId,
          );
          setFeedback(`The reservation for ${selectedName} was cancelled.`);
        }
      } else if (context === 'settings') {
        await organizationsApi.deleteOrganization(organizationId);
        onOrganizationsChanged();
        onOrganizationDeleted();
        return;
      }
      reload();
    } catch (error) {
      setFailure(errorMessage(error, 'The change could not be saved.'));
    }
  }

  function savePreview(
    kind: Exclude<OrganizationDialogKind, null>,
    data: FormData,
  ) {
    const value = (name: string) => String(data.get(name) ?? '').trim();
    if (kind === 'add-member') {
      const email = value('email');
      const name = labelFromEmail(email);
      patchRows((current) => ({
        memberRows: [
          ...current.memberRows,
          [getInitials(name), name, email, value('role'), 'Invited'],
        ],
      }));
      setFeedback(`Invitation prepared for ${email}.`);
    } else if (kind === 'edit-member') {
      patchRows((current) => ({
        memberRows: current.memberRows.map((row) =>
          rowKey(row) === selectedKey
            ? [row[0], row[1], row[2], value('role'), row[4], row[5]]
            : row,
        ),
      }));
      setFeedback(`${selectedName}'s organization access was updated.`);
    } else if (kind === 'settings') {
      onOrganizationNameChange(value('organization-name'));
      onOrganizationDescriptionChange(value('description'));
      setFeedback(
        'Organization details were updated in this frontend preview.',
      );
    } else if (kind === 'category') {
      const name = value('category-name');
      // El identificador de la fila se conserva: es lo que la nombra, no su
      // texto, que es justo lo que se está cambiando.
      const nextRow = (id?: string): OrganizationRow => [
        getInitials(name),
        name,
        value('description'),
        selectedRow?.[3] ?? '0 tickets',
        '',
        id,
      ];
      patchRows((current) => ({
        categoryRows: selectedKey
          ? current.categoryRows.map((row) =>
              rowKey(row) === selectedKey ? nextRow(row[5]) : row,
            )
          : [...current.categoryRows, nextRow()],
      }));
      setFeedback(`Category “${name}” was saved.`);
    } else if (deleteContext === 'edit-member') {
      patchRows((current) => ({
        memberRows: current.memberRows.filter(
          (row) => rowKey(row) !== selectedKey,
        ),
      }));
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
          <span className="text-xs2 tracking-[.08em] text-muted max-md:hidden">
            {canManageOrganization ? 'ORGANIZATION SETTINGS' : 'ORGANIZATION'}
          </span>
          <h1 className="my-2 text-[1.875rem] font-medium max-md:text-[1.375rem]">
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
              <span className="text-xs2 text-success max-md:hidden">
                Organization admin tools
              </span>
              <Button
                className="max-md:!min-h-9 max-md:!px-2.5"
                onClick={() => {
                  setSelectedName(organizationName);
                  setSelectedKey('');
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
            [String(openTickets), 'Open tickets'],
            [String(categoryRows.length), 'Categories'],
          ].map(([value, label]) => (
            <article
              className="grid gap-[5px] rounded-md border border-border bg-surface p-[18px]"
              key={label}
            >
              <strong className="text-[1.375rem] font-medium">{value}</strong>
              <span className="text-xs2 text-muted">{label}</span>
            </article>
          ))}
        </section>
      ) : (
        <section className="my-5 mt-7 grid grid-cols-2 gap-3 max-md:my-[18px] max-md:grid-cols-1">
          <article className="grid gap-1 rounded-md border border-border bg-surface p-[18px]">
            <span className="text-xs2 text-muted">Your access</span>
            <strong className="text-base font-medium">Member</strong>
          </article>
          <article className="grid gap-1 rounded-md border border-border bg-surface p-[18px]">
            <span className="text-xs2 text-muted">Ticket visibility</span>
            <strong className="text-base font-medium">Your tickets only</strong>
          </article>
        </section>
      )}
      {feedback ? (
        <Alert
          aria-live="polite"
          className="-mt-1.5 mb-[18px] !py-2.5 !text-xs2 !text-muted"
          role="status"
          tone="success"
        >
          {feedback}
        </Alert>
      ) : null}
      {failure ? (
        <Alert className="-mt-1.5 mb-[18px] !py-2.5 !text-xs2" tone="danger">
          {failure}
        </Alert>
      ) : null}
      <div
        className={`grid min-w-0 items-start gap-5 max-[900px]:block ${canReadStats ? 'grid-cols-[minmax(0,1fr)_250px]' : 'grid-cols-1'}`}
      >
        <section className="min-w-0 w-full overflow-hidden rounded-md border border-border bg-surface">
          <header className="flex items-center justify-between p-5 max-md:p-4">
            <div>
              <h2 className="text-base font-medium">{title}</h2>
              <p className="mt-1.5 text-xs2 text-muted max-md:hidden">
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
              className={`grid items-center gap-3 bg-surface-secondary px-[18px] py-[11px] text-3xs text-muted max-md:hidden ${tableGridClass}`}
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
            <AsyncState
              emptyDescription={
                tab === 'members'
                  ? 'Add somebody by e-mail address to get started.'
                  : 'Create one to start routing tickets.'
              }
              emptyTitle={
                tab === 'members' ? 'No members yet' : 'No categories yet'
              }
              error={view.error}
              errorTitle="This organization could not be read"
              isEmpty={!rows.length}
              onRetry={reload}
              status={view.status}
            >
              {rows.map((row) => {
                const editor = tab === 'members' ? 'edit-member' : 'category';
                const canEdit =
                  tab === 'members'
                    ? canManageMembers && (row[4] === 'Active' || !previewMode)
                    : tab === 'categories'
                      ? canManageCategories
                      : false;
                const canOpen = tab === 'categories' || canEdit;
                return (
                  <div
                    className={`grid border-t border-border ${tableGridClass} ${rowMobileGridClass}`}
                    key={rowKey(row)}
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
                        setSelectedKey(rowKey(row));
                        if (tab === 'categories') onOpenCategory(row[1]);
                        else if (canEdit) setDialog(editor);
                      }}
                      type="button"
                    >
                      <span className="flex items-center gap-2.5">
                        <b className="grid size-8 place-items-center rounded-full bg-[#d8e5df] text-3xs text-primary">
                          {row[0]}
                        </b>
                        <span className="grid gap-1">
                          <strong className="text-xs">{row[1]}</strong>
                          <small className="text-2xs text-muted max-md:max-w-[180px] max-md:overflow-hidden max-md:text-ellipsis max-md:whitespace-nowrap">
                            {row[2]}
                          </small>
                        </span>
                      </span>
                      {tab !== 'categories' || canReadStats ? (
                        <span className="text-2xs text-muted">{row[3]}</span>
                      ) : null}
                      {tab !== 'categories' ? (
                        <span className="flex items-center gap-1.5 text-2xs text-muted">
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
                                · waiting for the person
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
                          setSelectedKey(rowKey(row));
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
            </AsyncState>
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
            <p className="mt-1.5 text-xs2 text-muted">
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
                <span className="text-3xs text-brand-mint">●</span>
                <strong className="text-2xs">{label}</strong>
                <small className="text-2xs text-muted">{value}</small>
              </div>
            ))}
          </aside>
        ) : null}
      </div>
      {dialog ? (
        <OrganizationDialog
          canDeleteOrganization={
            previewMode ||
            organizationRole === 'GLOBAL_ADMIN' ||
            createdById === currentUserId
          }
          deleteContext={deleteContext}
          dialog={dialog}
          // El administrador de plataforma no se encierra: su alcance no es
          // la organización, así que para él no hay nada que proteger.
          editingSelf={
            !previewMode &&
            organizationRole !== 'GLOBAL_ADMIN' &&
            selectedMemberId === currentUserId
          }
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
