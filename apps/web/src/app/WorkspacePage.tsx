import type { ReactNode } from 'react';
import type { AccountProfile } from '../features/account/accountData';
import { AccountPage } from '../features/account/AccountPage';
import { MessagesPage } from '../features/messages/MessagesPage';
import { OrganizationPage } from '../features/organization/OrganizationPage';
import { OrganizationsPage } from '../features/organizations/OrganizationsPage';
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
import { NotFoundPage } from './NotFoundPage';
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
  organizationName,
  onOrganizationChange,
  onProfileChange,
  onTicketChange,
  tickets,
}: {
  accountProfile: AccountProfile;
  avatarUrl?: string;
  location: AppLocation;
  navigate: Navigate;
  onAvatarChange: (avatarUrl: string) => void;
  onCreateTicket: (values: NewTicketValues) => void;
  organizationName: string;
  onOrganizationChange: (organizationName: string) => void;
  onProfileChange: (profile: AccountProfile) => void;
  onTicketChange: (ticket: Ticket) => void;
  tickets: Ticket[];
}): ReactNode {
  const route: AppRoute = location.route;

  switch (route) {
    case 'not-found':
      return <NotFoundPage onBack={() => navigate('tickets')} />;
    case 'tickets':
      return (
        <TicketListPage
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
          tickets={tickets}
        />
      );
    case 'new-ticket':
      return (
        <CreateTicketPage
          onCancel={() =>
            navigate('tickets', getTicketFilterParams(location.params))
          }
          onSubmit={onCreateTicket}
        />
      );
    case 'ticket-detail':
      return (
        <TicketDetailPage
          currentUserName={accountProfile.fullName}
          key={location.params.get('id') ?? tickets[0].id}
          onBack={() =>
            navigate('tickets', getTicketFilterParams(location.params))
          }
          onTicketChange={onTicketChange}
          ticket={
            tickets.find((ticket) => ticket.id === location.params.get('id')) ??
            tickets[0]
          }
        />
      );
    case 'people':
      return (
        <PeoplePage
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
          onOpenCategory={(category) => navigate('tickets', { category })}
          onOrganizationDeleted={() => navigate('organizations')}
          onOrganizationNameChange={onOrganizationChange}
          organizationName={organizationName}
        />
      );
    case 'organizations':
      return (
        <OrganizationsPage
          onOpen={(name) => {
            onOrganizationChange(name);
            navigate('organization');
          }}
        />
      );
    default:
      if (route === 'account' || route.startsWith('account/')) {
        return (
          <AccountPage
            avatarUrl={avatarUrl}
            onAvatarChange={onAvatarChange}
            onNavigate={(view) =>
              navigate(view === 'home' ? 'account' : `account/${view}`)
            }
            onPrivacyPolicy={() =>
              navigate('privacy-policy', { from: 'account' })
            }
            onProfileChange={onProfileChange}
            onTerms={() => navigate('terms', { from: 'account' })}
            profile={accountProfile}
            view={getAccountView(route)}
          />
        );
      }
      return null;
  }
}
