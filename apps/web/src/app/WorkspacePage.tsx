import type { ReactNode } from 'react';
import type { AccountProfile } from '../features/account/accountData';
import { AccountPage } from '../features/account/AccountPage';
import { AdminAccessDenied } from '../features/admin/AdminAccessDenied';
import { GlobalAdminPage } from '../features/admin/GlobalAdminPage';
import { MessagesPage } from '../features/messages/MessagesPage';
import { OrganizationPage } from '../features/organization/OrganizationPage';
import { OrganizationsPage } from '../features/organizations/OrganizationsPage';
import type { OrganizationSummary } from '../features/organizations/organizationsData';
import { PeoplePage } from '../features/people/PeoplePage';
import { PublicProfilePage } from '../features/people/PublicProfilePage';
import {
  CreateTicketPage,
  type NewTicketValues,
} from '../features/tickets/CreateTicketPage';
import { RelatedTicketsPage } from '../features/tickets/RelatedTicketsPage';
import { TicketDetailPage } from '../features/tickets/TicketDetailPage';
import { TicketListPage } from '../features/tickets/TicketListPage';
import type { Ticket } from '../features/tickets/ticketData';
import { organizationFixture } from '../features/organization/organizationData';
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
  onAvatarChange,
  onCreateTicket,
  onOrganizationDescriptionChange,
  onOrganizationNameChange,
  onOrganizationSelect,
  onSignOut,
  organizationDescription,
  organizationId,
  organizationName,
  onProfileChange,
  onTicketChange,
  tickets,
  viewer,
}: {
  accountProfile: AccountProfile;
  avatarUrl?: string;
  location: AppLocation;
  navigate: Navigate;
  onAvatarChange: (avatarUrl: string) => void;
  onCreateTicket: (values: NewTicketValues) => void;
  onOrganizationDescriptionChange: (description: string) => void;
  onOrganizationNameChange: (organizationName: string) => void;
  onOrganizationSelect: (organization: OrganizationSummary) => void;
  onSignOut: () => void;
  organizationDescription: string;
  organizationId: string;
  organizationName: string;
  onProfileChange: (profile: AccountProfile) => void;
  onTicketChange: (ticket: Ticket) => void;
  tickets: Ticket[];
  viewer: ViewerSession;
}): ReactNode {
  const route: AppRoute = location.route;
  const organizationData = organizationFixture(
    organizationId,
    organizationDescription,
  );
  const organizationTickets = tickets.filter(
    (ticket) => ticket.organizationId === organizationId,
  );
  const visibleTickets = can(viewer, 'ticket:read')
    ? organizationTickets
    : organizationTickets.filter(
        (ticket) => ticket.requester === accountProfile.fullName,
      );
  const requestedTicket = visibleTickets.find(
    (ticket) => ticket.id === location.params.get('id'),
  );

  switch (route) {
    case 'not-found':
      return <NotFoundPage onBack={() => navigate('tickets')} />;
    case 'tickets':
      return (
        <TicketListPage
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
          tickets={visibleTickets}
        />
      );
    case 'new-ticket':
      return (
        <CreateTicketPage
          categories={organizationData.categories.map((row) => ({
            description: row[2],
            name: row[1],
          }))}
          onCancel={() =>
            navigate('tickets', getTicketFilterParams(location.params))
          }
          onSubmit={onCreateTicket}
          organizationName={organizationName}
        />
      );
    case 'ticket-detail':
      return requestedTicket ? (
        <TicketDetailPage
          canAssignOther={can(viewer, 'ticket:assignOther')}
          canChangeStatus={can(viewer, 'ticket:changeStatus')}
          canReopenTickets={can(viewer, 'ticket:reopen')}
          canSelfAssign={can(viewer, 'ticket:selfAssign')}
          currentUserName={accountProfile.fullName}
          key={requestedTicket.id}
          onBack={() =>
            navigate('tickets', getTicketFilterParams(location.params))
          }
          onTicketChange={onTicketChange}
          organizationName={organizationName}
          ticket={requestedTicket}
        />
      ) : (
        <NotFoundPage onBack={() => navigate('tickets')} />
      );
    case 'people':
      return (
        <PeoplePage
          currentUserName={accountProfile.fullName}
          onOpenProfile={(person) => navigate('people-profile', { person })}
        />
      );
    case 'people-profile':
      return (
        <PublicProfilePage
          key={location.params.get('person') ?? 'Maya Singh'}
          onBack={() => navigate('people')}
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
          onViewTickets={(person) => navigate('related-tickets', { person })}
        />
      );
    case 'related-tickets':
      return (
        <RelatedTicketsPage
          onBack={() => navigate('messages')}
          onNewTicket={() => navigate('new-ticket')}
          onOpenTicket={(ticketId) =>
            navigate('ticket-detail', { id: ticketId })
          }
          personName={location.params.get('person') ?? 'Maya Singh'}
        />
      );
    case 'organization':
      return (
        <OrganizationPage
          key={organizationId}
          canManageCategories={can(viewer, 'category:write')}
          canManageMembers={can(viewer, 'member:invite')}
          canManageOrganization={can(viewer, 'organization:update')}
          canReadMembers={can(viewer, 'member:read')}
          canReadStats={can(viewer, 'stats:read')}
          onOpenCategory={(category) => navigate('tickets', { category })}
          onOrganizationDeleted={() => navigate('organizations')}
          onOrganizationDescriptionChange={onOrganizationDescriptionChange}
          onOrganizationNameChange={onOrganizationNameChange}
          organizationDescription={organizationDescription}
          organizationId={organizationId}
          organizationName={organizationName}
          organizationRole={
            viewer.globalRole === 'GLOBAL_ADMIN'
              ? 'GLOBAL_ADMIN'
              : (viewer.memberships.find(
                  (membership) => membership.organizationId === organizationId,
                )?.role ?? 'MEMBER')
          }
        />
      );
    case 'organizations':
      return (
        <OrganizationsPage
          onOpen={(organization) => {
            onOrganizationSelect(organization);
            navigate('organization');
          }}
          viewer={viewer}
        />
      );
    case 'admin':
      return can(viewer, 'user:listAll') ? (
        <GlobalAdminPage />
      ) : (
        <AdminAccessDenied onBack={() => navigate('tickets')} />
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
              navigate('privacy-policy', { from: 'account' })
            }
            onProfileChange={onProfileChange}
            onSignOut={onSignOut}
            onTerms={() => navigate('terms', { from: 'account' })}
            profile={accountProfile}
            view={getAccountView(route)}
          />
        );
      }
      return null;
  }
}
