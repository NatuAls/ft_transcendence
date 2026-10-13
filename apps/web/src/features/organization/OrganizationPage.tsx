import { Alert, Button, Dialog, IconButton, Tabs } from 'ui';
import { useState } from 'react';
import { orgRoleSchema, type OrgRole } from 'contracts';
import * as organizationsApi from '../../api/organizations';
import * as rolesApi from '../../api/roles';
import { previewMode } from '../../app/session';
import { getInitials } from '../../app/text';
import { organizationRoleLabel } from '../roles/rolesGateway';
import { OrganizationDialog } from './OrganizationDialog';
import { errorKey, isApiError } from '../../core/api/errors';
import { AsyncState } from '../../core/async/AsyncState';
import { useAsync } from '../../core/async/useAsync';
import { useToast } from '../../core/feedback/useToast';
import { useTranslation } from '../../core/i18n';
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
  CategoryRow,
  DeleteContext,
  MemberRow,
  OrganizationDialogKind,
  OrganizationFixture,
  OrgTab,
} from './organizationData';

/** El rol que envía un formulario: su código, o MEMBER si no es ninguno. */
function roleFromForm(value: string): OrgRole {
  const parsed = orgRoleSchema.safeParse(value);
  return parsed.success ? parsed.data : 'MEMBER';
}

/** Una fila tal como la pinta la tabla, sea de la pestaña que sea. */
interface TableRow {
  /** Sólo en la pestaña de roles: el acceso que da. */
  access?: string;
  badge: string;
  category?: CategoryRow;
  detail: string;
  key: string;
  member?: MemberRow;
  name: string;
  /** Segunda columna: el rol, los miembros o los tickets. */
  second: string;
}

export function OrganizationPage({
  canLeave = false,
  canManageCategories,
  canManageMembers,
  canManageOrganization,
  canReadMembers,
  canReadStats,
  currentUserId,
  onAccessChanged,
  isPlatformAdmin = false,
  onLeft = () => {},
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
  /**
   * You belong to this organization and may leave it. A platform
   * administrator who is not a member has nothing to leave.
   */
  canLeave?: boolean;
  canManageCategories: boolean;
  canManageMembers: boolean;
  canManageOrganization: boolean;
  canReadMembers: boolean;
  canReadStats: boolean;
  currentUserId: string;
  onAccessChanged: () => void;
  /**
   * Quien mira es administrador de plataforma. Lo decide `can()` en el
   * armazón, no esta pantalla comparando el texto del rol: la guía del bloque
   * lo prohíbe (§5) y lo único que justificaba aquí `organizationRole` era el
   * texto descriptivo.
   */
  isPlatformAdmin?: boolean;
  /** You left it: the shell takes you somewhere you still belong. */
  onLeft?: () => void;
  onOpenCategory: (categoryId: string) => void;
  onOrganizationDescriptionChange: (description: string) => void;
  onOrganizationNameChange: (name: string) => void;
  onOrganizationDeleted: () => void;
  onOrganizationsChanged: (preferredId?: string) => void;
  organizationDescription: string;
  organizationId: string;
  organizationName: string;
  organizationRole: 'AGENT' | 'GLOBAL_ADMIN' | 'MEMBER' | 'ORG_ADMIN';
}) {
  const { t } = useTranslation();
  const toast = useToast();
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
  const [selectedName, setSelectedName] = useState('');
  const [feedback, setFeedback] = useState('');
  const [failure, setFailure] = useState('');
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

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
      categoryRows: categories.map((category): CategoryRow => ({
        description: category.description ?? '',
        id: category.id,
        initials: getInitials(category.name),
        name: category.name,
        tickets: category._count?.tickets ?? 0,
      })),
      createdById: detail?.createdById ?? null,
      // Cada fila con su identificador. Antes se guardaban tres diccionarios
      // (miembros, reservas y categorías) con el TEXTO de la fila como clave,
      // y con tres cuentas llamadas igual sólo sobrevivía la última: la
      // pantalla acababa cambiando el rol de otra persona.
      memberRows: [
        ...(members ?? []).map((member): MemberRow => ({
          email: member.email,
          id: member.userId,
          initials: getInitials(member.displayName),
          name: member.displayName,
          role: member.role,
          waitingFor: null,
        })),
        ...(reservations ?? []).map((reservation): MemberRow => ({
          email: reservation.email,
          id: reservation.id,
          initials: getInitials(labelFromEmail(reservation.email)),
          name: reservation.email,
          role: reservation.role,
          waitingFor: reservation.waitingFor,
        })),
      ],
      // Sólo OPEN, igual que la tarjeta «Open» de la lista de tickets. Antes
      // sumaba también IN_PROGRESS: los datos eran los mismos, pero la misma
      // palabra contaba dos conjuntos distintos en dos pantallas — 7 aquí
      // (6 abiertos + 1 en curso) contra 6 allí —, y parecía un error de
      // cálculo. Quien quiera el desglose lo tiene en la lista.
      openTickets: stats ? (stats.byStatus.OPEN ?? 0) : fixture.openTickets,
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
  // El último administrador no puede irse: la API lo rechaza, y la pantalla
  // lo dice antes de que lo intente en vez de ofrecer algo que se negará.
  // Sólo se sabe con la lista de miembros, que es justo la que ve quien
  // administra; nadie más puede ser el último administrador.
  const administrators = memberRows.filter(
    (row) => row.waitingFor === null && row.role === 'ORG_ADMIN',
  );
  const onlyAdministrator =
    administrators.length === 1 && administrators[0]!.id === currentUserId;

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

  // Quién es la fila elegida, sacado de ELLA y no de un diccionario por texto.
  const selectedMember =
    tab === 'members'
      ? memberRows.find((row) => rowKey(row) === selectedKey)
      : undefined;
  const selectedCategory =
    tab === 'categories'
      ? categoryRows.find((row) => rowKey(row) === selectedKey)
      : undefined;
  const selectedMemberId =
    selectedMember?.waitingFor === null ? selectedMember.id : undefined;
  const selectedReservationId = selectedMember?.waitingFor
    ? selectedMember.id
    : undefined;
  const selectedCategoryId = selectedCategory?.id;
  const title = t(`organization.page.title.${tab}`);
  const description = t(`organization.page.description.${tab}`, {
    organization: organizationName,
  });

  // Lo que se pinta, traducido aquí y no al leer de la API: así la tabla
  // cambia de idioma con la aplicación abierta.
  const rows: TableRow[] =
    tab === 'members'
      ? memberRows.map((row) => ({
          badge: row.initials,
          detail: row.waitingFor
            ? t(`organization.access.waiting.${row.waitingFor}.label`)
            : row.email,
          key: rowKey(row),
          member: row,
          name: row.name,
          second: organizationRoleLabel(row.role),
        }))
      : tab === 'roles'
        ? roleRows.map((row) => ({
            access: t(`organization.page.roleRows.${row.role}.access`),
            badge: t(`organization.page.roleRows.${row.role}.badge`),
            detail: t(`organization.page.roleRows.${row.role}.description`),
            key: row.role,
            name: organizationRoleLabel(row.role),
            second: t('organization.members', { count: row.members }),
          }))
        : categoryRows.map((row) => ({
            badge: row.initials,
            category: row,
            detail: row.description,
            key: rowKey(row),
            name: row.name,
            second: t('organization.tickets', { count: row.tickets }),
          }));
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
          role: roleFromForm(value('role')),
        });
        const name = result.user?.displayName ?? result.email;
        setFeedback(
          result.outcome === 'RESERVED'
            ? t('organization.page.feedback.roleReserved', {
                email: result.email,
              })
            : result.outcome === 'UNCHANGED'
              ? t('organization.page.feedback.alreadyHad', { name })
              : t('organization.page.feedback.nowHasAccess', {
                  name,
                  organization: organizationName,
                }),
        );
      } else if (kind === 'edit-member') {
        const role = roleFromForm(value('role'));
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
        setFeedback(
          t('organization.page.feedback.accessUpdated', { name: selectedName }),
        );
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
        setFeedback(t('organization.page.feedback.detailsUpdated'));
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
        setFeedback(
          t('organization.page.feedback.categorySaved', { name: input.name }),
        );
      } else if (context === 'edit-member') {
        const reservationId = selectedReservationId;
        if (memberId) {
          await rolesApi.removeMember(organizationId, memberId);
          setFeedback(
            t('organization.page.feedback.removed', { name: selectedName }),
          );
        } else if (reservationId) {
          await rolesApi.cancelOrganizationReservation(
            organizationId,
            reservationId,
          );
          setFeedback(
            t('organization.page.feedback.reservationCancelled', {
              name: selectedName,
            }),
          );
        }
      } else if (context === 'settings') {
        await organizationsApi.deleteOrganization(organizationId);
        onOrganizationsChanged();
        onOrganizationDeleted();
        return;
      }
      reload();
    } catch (error) {
      setFailure(t(errorKey(error)));
    }
  }

  async function leave() {
    setLeaving(true);
    setFailure('');
    try {
      if (!previewMode)
        await organizationsApi.leaveOrganization(organizationId);
      toast.success(
        t('organization.leave.done', { organization: organizationName }),
      );
      onOrganizationsChanged();
      onLeft();
    } catch (error) {
      // A un miembro, la API sólo le niega la salida si es el último
      // administrador: la política `member:leave` responde 403 sin más
      // detalle. Se explica con el motivo, no con «tu rol no lo permite».
      setFailure(
        isApiError(error) && error.code === 'RBAC_FORBIDDEN'
          ? t('organization.leave.lastAdmin')
          : t(errorKey(error)),
      );
      setConfirmingLeave(false);
    } finally {
      setLeaving(false);
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
          {
            email,
            initials: getInitials(name),
            name,
            role: roleFromForm(value('role')),
            waitingFor: 'ACCOUNT',
          },
        ],
      }));
      setFeedback(
        t('organization.page.feedback.invitationPrepared', { email }),
      );
    } else if (kind === 'edit-member') {
      patchRows((current) => ({
        memberRows: current.memberRows.map((row) =>
          rowKey(row) === selectedKey
            ? { ...row, role: roleFromForm(value('role')) }
            : row,
        ),
      }));
      setFeedback(
        t('organization.page.feedback.accessUpdated', { name: selectedName }),
      );
    } else if (kind === 'settings') {
      onOrganizationNameChange(value('organization-name'));
      onOrganizationDescriptionChange(value('description'));
      setFeedback(t('organization.page.feedback.detailsUpdatedPreview'));
    } else if (kind === 'category') {
      const name = value('category-name');
      // El identificador de la fila se conserva: es lo que la nombra, no su
      // texto, que es justo lo que se está cambiando.
      const nextRow = (previous?: CategoryRow): CategoryRow => ({
        description: value('description'),
        id: previous?.id,
        initials: getInitials(name),
        name,
        tickets: previous?.tickets ?? 0,
      });
      patchRows((current) => ({
        categoryRows: selectedKey
          ? current.categoryRows.map((row) =>
              rowKey(row) === selectedKey ? nextRow(row) : row,
            )
          : [...current.categoryRows, nextRow()],
      }));
      setFeedback(t('organization.page.feedback.categorySaved', { name }));
    } else if (deleteContext === 'edit-member') {
      patchRows((current) => ({
        memberRows: current.memberRows.filter(
          (row) => rowKey(row) !== selectedKey,
        ),
      }));
      setFeedback(
        t('organization.page.feedback.removed', { name: selectedName }),
      );
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
            {canManageOrganization
              ? t('organization.page.eyebrowSettings')
              : t('organization.eyebrow')}
          </span>
          <h1 className="my-2 text-[1.875rem] font-medium max-md:text-[1.375rem]">
            {organizationName}
          </h1>
          <p className="text-sm text-muted max-md:hidden">
            {canManageOrganization
              ? organizationDescription || t('organization.defaultDescription')
              : organizationRole === 'AGENT'
                ? t('organization.page.descriptionAgent')
                : t('organization.page.descriptionMember')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canManageOrganization ? (
            <>
              <span className="text-xs2 text-success max-md:hidden">
                {t('organization.page.adminTools')}
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
                {t('organization.page.edit')}
              </Button>
            </>
          ) : null}
        </div>
      </header>
      {canReadStats ? (
        <section className="my-5 mt-7 grid grid-cols-4 gap-3 max-md:my-[18px] max-md:grid-cols-2">
          {[
            [
              String(
                memberRows.filter((row) => row.waitingFor === null).length,
              ),
              t('organization.page.stats.members'),
            ],
            [
              String(
                memberRows.filter(
                  (row) => row.role === 'AGENT' && row.waitingFor === null,
                ).length,
              ),
              t('organization.page.stats.agents'),
            ],
            [String(openTickets), t('organization.page.stats.openTickets')],
            [
              String(categoryRows.length),
              t('organization.page.stats.categories'),
            ],
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
            <span className="text-xs2 text-muted">
              {t('organization.page.yourAccess')}
            </span>
            <strong className="text-base font-medium">
              {organizationRoleLabel('MEMBER')}
            </strong>
          </article>
          <article className="grid gap-1 rounded-md border border-border bg-surface p-[18px]">
            <span className="text-xs2 text-muted">
              {t('organization.page.visibility')}
            </span>
            <strong className="text-base font-medium">
              {t('organization.page.yourTicketsOnly')}
            </strong>
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
                {tab === 'members'
                  ? t('organization.page.addMember')
                  : t('organization.page.createCategory')}
              </Button>
            ) : null}
          </header>
          {canReadMembers ? (
            <div className="overflow-auto border-y border-border px-[15px] max-md:px-[5px]">
              <Tabs
                activeTab={tab}
                items={[
                  { id: 'members', label: t('organization.page.tabs.members') },
                  { id: 'roles', label: t('organization.page.tabs.roles') },
                  {
                    id: 'categories',
                    label: t('organization.page.tabs.categories'),
                  },
                ]}
                label={t('organization.page.tabsLabel')}
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
                  ? t('organization.page.columns.member')
                  : tab === 'roles'
                    ? t('organization.page.columns.role')
                    : t('organization.page.columns.category')}
              </span>
              {tab !== 'categories' || canReadStats ? (
                <span>
                  {tab === 'members'
                    ? t('organization.page.columns.role')
                    : tab === 'roles'
                      ? t('organization.page.columns.members')
                      : t('organization.page.columns.tickets')}
                </span>
              ) : null}
              {tab !== 'categories' ? (
                <span>
                  {tab === 'roles'
                    ? t('organization.page.columns.access')
                    : t('organization.page.columns.status')}
                </span>
              ) : null}
              {tab !== 'roles' ? <span aria-hidden="true" /> : null}
            </div>
            <AsyncState
              emptyDescription={
                tab === 'members'
                  ? t('organization.page.empty.membersDescription')
                  : t('organization.page.empty.categoriesDescription')
              }
              emptyTitle={
                tab === 'members'
                  ? t('organization.page.empty.membersTitle')
                  : t('organization.page.empty.categoriesTitle')
              }
              error={view.error}
              errorTitle={t('organization.page.errorTitle')}
              isEmpty={!rows.length}
              onRetry={reload}
              status={view.status}
            >
              {rows.map((row) => {
                const editor = tab === 'members' ? 'edit-member' : 'category';
                const canEdit =
                  tab === 'members'
                    ? canManageMembers &&
                      (row.member?.waitingFor === null || !previewMode)
                    : tab === 'categories'
                      ? canManageCategories
                      : false;
                const canOpen = tab === 'categories' || canEdit;
                return (
                  <div
                    className={`grid border-t border-border ${tableGridClass} ${rowMobileGridClass}`}
                    key={row.key}
                    role="row"
                  >
                    <button
                      aria-label={
                        tab === 'categories'
                          ? t('organization.page.viewTickets', {
                              name: row.name,
                            })
                          : t('organization.page.open', { name: row.name })
                      }
                      className={`grid min-h-[68px] w-full items-center gap-3 px-[18px] py-[11px] text-left enabled:hover:bg-surface-secondary disabled:cursor-default max-md:col-span-1 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:p-3 ${rowContentClass}`}
                      disabled={!canOpen}
                      onClick={() => {
                        setSelectedName(row.name);
                        setSelectedKey(row.key);
                        // El ID, no el nombre: la lista de tickets filtra por
                        // `categoryId` contra la API, y con el nombre ésta
                        // respondía 400 («Could not load tickets»). Las filas
                        // de muestra no traen ID y caen al nombre, que es lo
                        // que entiende la lista de la vista previa.
                        if (row.category)
                          onOpenCategory(row.category.id ?? row.category.name);
                        else if (canEdit) setDialog(editor);
                      }}
                      type="button"
                    >
                      <span className="flex items-center gap-2.5">
                        <b className="grid size-8 place-items-center rounded-full bg-surface-secondary text-3xs text-primary">
                          {row.badge}
                        </b>
                        <span className="grid gap-1">
                          <strong className="text-xs">{row.name}</strong>
                          <small className="text-2xs text-muted max-md:max-w-[180px] max-md:overflow-hidden max-md:text-ellipsis max-md:whitespace-nowrap">
                            {row.detail}
                          </small>
                        </span>
                      </span>
                      {tab !== 'categories' || canReadStats ? (
                        <span className="text-2xs text-muted">
                          {row.second}
                        </span>
                      ) : null}
                      {tab !== 'categories' ? (
                        <span className="flex items-center gap-1.5 text-2xs text-muted">
                          {row.member ? (
                            <i
                              className={`size-1.5 rounded-full ${row.member.waitingFor ? 'bg-warning' : 'bg-success'}`}
                            />
                          ) : null}
                          {row.member ? (
                            row.member.waitingFor ? (
                              <>
                                {t('organization.page.invited')}
                                <span className="max-md:hidden">
                                  {t('organization.page.waitingForPerson')}
                                </span>
                              </>
                            ) : (
                              t('organization.page.active')
                            )
                          ) : (
                            row.access
                          )}
                        </span>
                      ) : null}
                    </button>
                    {canEdit ? (
                      <IconButton
                        label={t('organization.page.editRow', {
                          name: row.name,
                        })}
                        icon="more"
                        onClick={() => {
                          setSelectedName(row.name);
                          setSelectedKey(row.key);
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
              {t(`organization.page.aside.${tab}Title`)}
            </h2>
            <p className="mt-1.5 text-xs2 text-muted">
              {t(`organization.page.aside.${tab}Description`)}
            </p>
            {(tab === 'roles'
              ? (
                  [
                    ['createTickets', 3],
                    ['handleTickets', 2],
                    ['manageMembers', 1],
                    ['manageCategories', 1],
                  ] as const
                ).map(([capability, roles]) => ({
                  key: capability,
                  label: t(`organization.page.aside.${capability}`),
                  value: t('organization.page.aside.accessRoles', {
                    count: roles,
                  }),
                }))
              : categoryRows.slice(0, 4).map((row) => ({
                  key: rowKey(row),
                  label: row.name,
                  value: t('organization.tickets', { count: row.tickets }),
                }))
            ).map(({ key, label, value }) => (
              <div
                className="mt-[18px] grid grid-cols-[12px_1fr_auto] gap-[7px]"
                key={key}
              >
                <span className="text-3xs text-brand-mint">●</span>
                <strong className="text-2xs">{label}</strong>
                <small className="text-2xs text-muted">{value}</small>
              </div>
            ))}
          </aside>
        ) : null}
      </div>
      {canLeave ? (
        <section className="mt-5 flex items-center justify-between gap-4 rounded-md border border-border bg-surface p-5 max-md:grid max-md:p-4">
          <div className="min-w-0">
            <h2 className="text-base font-medium">
              {t('organization.leave.title', {
                organization: organizationName,
              })}
            </h2>
            <p className="mt-1.5 text-xs2 text-muted">
              {onlyAdministrator
                ? t('organization.leave.lastAdmin')
                : t('organization.leave.description')}
            </p>
          </div>
          <Button
            className="shrink-0"
            disabled={onlyAdministrator}
            onClick={() => setConfirmingLeave(true)}
            variant="secondary"
          >
            {t('organization.leave.button')}
          </Button>
        </section>
      ) : null}
      {confirmingLeave ? (
        <Dialog
          description={t('organization.leave.confirmDescription', {
            organization: organizationName,
          })}
          eyebrow={t('organization.eyebrow')}
          footer={
            <>
              <Button
                disabled={leaving}
                onClick={() => setConfirmingLeave(false)}
                variant="secondary"
              >
                {t('organization.leave.stay')}
              </Button>
              <Button disabled={leaving} type="submit" variant="destructive">
                {leaving
                  ? t('organization.leave.leaving')
                  : t('organization.leave.button')}
              </Button>
            </>
          }
          onClose={() => {
            if (!leaving) setConfirmingLeave(false);
          }}
          onSubmit={(event) => {
            event.preventDefault();
            void leave();
          }}
          title={t('organization.leave.confirmTitle', {
            organization: organizationName,
          })}
        />
      ) : null}
      {dialog ? (
        <OrganizationDialog
          canDeleteOrganization={
            previewMode || isPlatformAdmin || createdById === currentUserId
          }
          deleteContext={deleteContext}
          dialog={dialog}
          // El administrador de plataforma no se encierra: su alcance no es
          // la organización, así que para él no hay nada que proteger.
          editingSelf={
            !previewMode &&
            !isPlatformAdmin &&
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
          selectedCategory={selectedCategory}
          selectedMember={selectedMember}
          selectedName={selectedName}
        />
      ) : null}
    </div>
  );
}
