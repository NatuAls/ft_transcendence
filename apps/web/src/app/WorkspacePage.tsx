import type { ReactNode } from 'react';
import { uuidSchema } from 'contracts';
import type { AccountProfile } from '../features/account/accountData';
import { AccountPage } from '../features/account/AccountPage';
import { ChangePasswordPage } from '../features/account/ChangePasswordPage';
import { AdminAccessDenied } from '../features/admin/AdminAccessDenied';
import { AuditLogPage } from '../features/admin/AuditLogPage';
import { GlobalAdminPage } from '../features/admin/GlobalAdminPage';
import { MessagesPage } from '../features/messages/MessagesPage';
import { OrganizationPage } from '../features/organization/OrganizationPage';
import { OrganizationsPage } from '../features/organizations/OrganizationsPage';
import type { OrganizationSummary } from '../features/organizations/organizationsData';
import { PeoplePage } from '../features/people/PeoplePage';
import { PublicProfilePage } from '../features/people/PublicProfilePage';
import { OrganizationRolesPage } from '../features/roles/OrganizationRolesPage';
import { PlatformRolesPage } from '../features/roles/PlatformRolesPage';
import { CreateTicketPage } from '../features/tickets/CreateTicketPage';
import { RelatedTicketsPage } from '../features/tickets/RelatedTicketsPage';
import { TicketDetailPage } from '../features/tickets/TicketDetailPage';
import { TicketListPage } from '../features/tickets/TicketListPage';
import { NotFoundPage } from './NotFoundPage';
import { can, type ViewerSession } from './session';
import {
  getAccountView,
  getTicketFilterParams,
  readLocation,
  replaceHash,
  type AppLocation,
  type AppRoute,
  type Navigate,
} from './routes';

export function WorkspacePage({
  accountProfile,
  avatarUrl,
  location,
  navigate,
  onAccessChanged,
  onAvatarChange,
  onOrganizationDescriptionChange,
  onOrganizationNameChange,
  onOrganizationSelect,
  onOrganizationsChanged,
  onSignOut,
  organizationDescription,
  organizationId,
  organizationName,
  organizations,
  onProfileChange,
  viewer,
}: {
  accountProfile: AccountProfile;
  avatarUrl?: string;
  location: AppLocation;
  navigate: Navigate;
  /** The viewer's own access may have changed: read the session again. */
  onAccessChanged: () => void;
  onAvatarChange: (avatarUrl: string) => void;
  onOrganizationDescriptionChange: (description: string) => void;
  onOrganizationNameChange: (organizationName: string) => void;
  onOrganizationSelect: (organization: OrganizationSummary) => void;
  /** An organization was created, renamed or deleted; optionally switch to one. */
  onOrganizationsChanged: (preferredId?: string) => void;
  onSignOut: () => void;
  organizationDescription: string;
  organizationId: string;
  organizationName: string;
  organizations: OrganizationSummary[];
  onProfileChange: (profile: AccountProfile) => void;
  // La prop `tickets` se ha eliminado de la firma porque la UI ya usa la API real.
  viewer: ViewerSession;
}): ReactNode {
  const route: AppRoute = location.route;

  const organizationRole =
    viewer.globalRole === 'GLOBAL_ADMIN'
      ? 'GLOBAL_ADMIN'
      : (viewer.memberships.find(
          (membership) => membership.organizationId === organizationId,
        )?.role ?? 'MEMBER');

  switch (route) {
    case 'account/password':
      return (
        <ChangePasswordPage
          onBack={() => navigate('account')}
          onSignOut={onSignOut}
        />
      );
    case 'not-found':
      return <NotFoundPage onBack={() => navigate('tickets')} />;
    case 'tickets':
      return (
        <TicketListPage
          key={organizationId}
          currentUserName={accountProfile.fullName}
          initialCategory={location.params.get('category') ?? ''}
          initialPage={Number(location.params.get('page') ?? '1')}
          initialPriority={location.params.get('priority') ?? 'all'}
          initialQuery={location.params.get('q') ?? ''}
          initialSort={location.params.get('sort') ?? 'newest'}
          initialStatus={location.params.get('status') ?? 'all'}
          onBackToCategories={() => navigate('organization')}
          onCreateTicket={() =>
            navigate('new-ticket', getTicketFilterParams(readLocation().params))
          }
          onFiltersChange={(params) => replaceHash('tickets', params)}
          onOpenTicket={(ticketId) =>
            navigate('ticket-detail', {
              ...getTicketFilterParams(readLocation().params),
              id: ticketId,
            })
          }
          organizationWide={can(viewer, 'ticket:read')}
          organizationId={organizationId}
        />
      );
    case 'new-ticket':
      return can(viewer, 'ticket:create') ? (
        <CreateTicketPage
          key={organizationId}
          onCancel={() =>
            navigate('tickets', getTicketFilterParams(location.params))
          }
          onCreated={() =>
            navigate('tickets', getTicketFilterParams(location.params))
          }
          organizationName={organizationName}
          organizationId={organizationId}
        />
      ) : (
        <AdminAccessDenied onBack={() => navigate('tickets')} />
      );
    case 'ticket-detail': {
      // Extraemos el ID directamente de la URL. TicketDetailPage se encarga de hacer el fetch.
      const ticketId = location.params.get('id');

      return ticketId && uuidSchema.safeParse(ticketId).success ? (
        <TicketDetailPage
          canReassign={
            organizationRole === 'ORG_ADMIN' ||
            viewer.globalRole === 'GLOBAL_ADMIN'
          }
          canChangeStatus={can(viewer, 'ticket:changeStatus')}
          canReopenTickets={can(viewer, 'ticket:reopen')}
          canSelfAssign={can(viewer, 'ticket:selfAssign')}
          canUpdate={can(viewer, 'ticket:update')}
          canDelete={can(viewer, 'ticket:delete')}
          canCreateInternal={can(viewer, 'comment:createInternal')}
          canViewInternal={can(viewer, 'comment:createInternal')}
          currentUserId={viewer.id}
          key={ticketId}
          onBack={() =>
            navigate('tickets', getTicketFilterParams(location.params))
          }
          organizationName={organizationName}
          organizationId={organizationId}
          ticketId={ticketId}
        />
      ) : (
        <NotFoundPage onBack={() => navigate('tickets')} />
      );
    }
    case 'people':
      return (
        <PeoplePage
          currentUserId={viewer.id}
          currentUserName={accountProfile.fullName}
          onMessage={(person) => navigate('messages', { person })}
          onOpenProfile={(person) => navigate('people-profile', { person })}
          organizationId={organizationId}
        />
      );
    case 'people-profile':
      return (
        <PublicProfilePage
          currentUserId={viewer.id}
          key={location.params.get('person') ?? 'Maya Singh'}
          onBack={() => navigate('people')}
          onEditOwnProfile={() => navigate('account/profile')}
          onMessage={(person) => navigate('messages', { person })}
          personName={location.params.get('person') ?? 'Maya Singh'}
        />
      );
    case 'messages':
      return (
        <MessagesPage
          key={location.params.get('person') ?? 'messages'}
          initialPerson={location.params.get('person') ?? undefined}
          onOpenProfile={(person) => navigate('people-profile', { person })}
          onViewTickets={(personId, personName) =>
            navigate('related-tickets', { personId, person: personName })
          }
          viewer={viewer}
        />
      );
    case 'related-tickets': {
      const personId = location.params.get('personId') ?? '';
      const personName =
        personId &&
        location.params.get('person') !== 'Selecciona una conversación'
          ? (location.params.get('person') ?? '')
          : '';
      return (
        <RelatedTicketsPage
          onBack={() => navigate('messages')}
          onNewTicket={() => navigate('new-ticket')}
          onOpenTicket={(ticketId) =>
            navigate('ticket-detail', { id: ticketId })
          }
          organizationId={organizationId}
          personId={personId}
          personName={personName}
        />
      );
    }
    case 'organization':
      return (
        <OrganizationPage
          key={organizationId}
          // Irse es de quien pertenece: el administrador de plataforma que
          // entra sin ser miembro no tiene de dónde salir.
          canLeave={
            can(viewer, 'member:leave') &&
            viewer.memberships.some(
              (membership) => membership.organizationId === organizationId,
            )
          }
          canManageApiKeys={can(viewer, 'apiKey:manage')}
          canManageCategories={can(viewer, 'category:write')}
          canManageMembers={can(viewer, 'member:invite')}
          canManageOrganization={can(viewer, 'organization:update')}
          canReadMembers={can(viewer, 'member:read')}
          canReadStats={can(viewer, 'stats:read')}
          currentUserId={viewer.id}
          onAccessChanged={onAccessChanged}
          // Plataforma = quien puede repartir roles de plataforma.
          isPlatformAdmin={can(viewer, 'user:setGlobalRole')}
          onOpenCategory={(categoryId) =>
            navigate('tickets', { category: categoryId })
          }
          onLeft={() => navigate('organizations')}
          onOrganizationDeleted={() => navigate('organizations')}
          onOrganizationsChanged={onOrganizationsChanged}
          onOrganizationDescriptionChange={onOrganizationDescriptionChange}
          onOrganizationNameChange={onOrganizationNameChange}
          organizationDescription={organizationDescription}
          organizationId={organizationId}
          organizationName={organizationName}
          organizationRole={organizationRole}
        />
      );
    case 'organizations':
      return (
        <OrganizationsPage
          isPlatformAdmin={can(viewer, 'user:setGlobalRole')}
          onOpen={(organization) => {
            onOrganizationSelect(organization);
            navigate('organization');
          }}
          onOrganizationsChanged={onOrganizationsChanged}
          organizations={organizations}
          viewer={viewer}
        />
      );
    case 'admin':
      return can(viewer, 'user:listAll') ? (
        <GlobalAdminPage
          currentUserId={viewer.id}
          organizations={organizations}
        />
      ) : (
        <AdminAccessDenied onBack={() => navigate('tickets')} />
      );
    case 'admin/audit': {
      // Lo que llega en la dirección se filtra antes de llegar a la API: un
      // `actor` que no es un identificador daría un 400 que ningún botón de
      // la pantalla puede arreglar.
      const param = (name: string) => location.params.get(name) || undefined;
      const day = (name: string) =>
        /^\d{4}-\d{2}-\d{2}$/.test(param(name) ?? '') ? param(name) : undefined;
      const actor = param('actor');
      return can(viewer, 'audit:read') ? (
        <AuditLogPage
          initialFilters={{
            action: param('action'),
            actorId:
              actor && uuidSchema.safeParse(actor).success ? actor : undefined,
            entity: param('entity'),
            from: day('from'),
            page: Math.max(1, Number(param('page') ?? '1') || 1),
            to: day('to'),
          }}
          onFiltersChange={(params) => replaceHash('admin/audit', params)}
        />
      ) : (
        <AdminAccessDenied onBack={() => navigate('tickets')} />
      );
    }
    case 'platform-roles':
      return can(viewer, 'user:setGlobalRole') ? (
        <PlatformRolesPage currentUserId={viewer.id} />
      ) : (
        <AdminAccessDenied onBack={() => navigate('tickets')} />
      );
    case 'organization-roles':
      return (
        <OrganizationRolesPage
          canManage={can(viewer, 'member:invite')}
          currentUserId={viewer.id}
          key={organizationId}
          onAccessChanged={onAccessChanged}
          onOpenOrganizations={() => navigate('organizations')}
          organizationId={organizationId}
          organizationName={organizationName}
          viewerRole={organizationRole}
        />
      );
    default:
      if (route === 'account' || route.startsWith('account/')) {
        return (
          <AccountPage
            avatarUrl={avatarUrl}
            confirmationToken={location.params.get('token') ?? undefined}
            onAvatarChange={onAvatarChange}
            onNavigate={(view) =>
              navigate(view === 'home' ? 'account' : `account/${view}`)
            }
            onPrivacyPolicy={() =>
              navigate('privacy-policy', { from: 'account/privacy' })
            }
            onProfileChange={onProfileChange}
            onSignOut={onSignOut}
            onTerms={() => navigate('terms', { from: 'account/privacy' })}
            profile={accountProfile}
            view={getAccountView(route)}
          />
        );
      }
      return null;
  }
}
