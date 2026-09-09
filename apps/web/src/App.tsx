import { useEffect, useState } from 'react';
import {
  buildHash,
  getActiveSection,
  getTicketFilterParams,
  readLocation,
  type AppLocation,
  type Navigate,
} from './app/routes';
import { sessionCapabilities } from './app/session';
import { WorkspacePage } from './app/WorkspacePage';
import { initialAccountProfile } from './features/account/accountData';
import { AdminAccessDenied } from './features/admin/AdminAccessDenied';
import { GlobalAdminPage } from './features/admin/GlobalAdminPage';
import {
  RegisterPage,
  type RegisterValues,
} from './features/auth/RegisterPage';
import { SignInPage, type SignInValues } from './features/auth/SignInPage';
import { LegalPage } from './features/legal/LegalPage';
import type { NewTicketValues } from './features/tickets/CreateTicketPage';
import { initialTickets, type Ticket } from './features/tickets/ticketData';
import { AppShell } from './layout/AppShell';

function App() {
  const [location, setLocation] = useState<AppLocation>(readLocation);
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [accountProfile, setAccountProfile] = useState(initialAccountProfile);
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [organizationName, setOrganizationName] = useState('Northstar Studio');

  useEffect(() => {
    const handleHashChange = () => setLocation(readLocation());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate: Navigate = (route, params = {}) => {
    const hash = buildHash(route, params);
    if (window.location.hash === hash) {
      setLocation(readLocation());
      return;
    }
    window.location.hash = hash;
  };

  function handleSignIn(values: SignInValues) {
    // The future auth service call belongs here; the page only owns form state.
    void values;
    navigate('tickets');
  }

  function handleRegister(values: RegisterValues) {
    // The future auth service call belongs here; the page only owns form state.
    void values;
    navigate('tickets');
  }

  function handleCreateTicket(values: NewTicketValues) {
    const ticketNumber =
      244 + Math.max(0, tickets.length - initialTickets.length);
    const ticket: Ticket = {
      assignee: 'Unassigned',
      category: values.category,
      description: values.description,
      id: `HD-${String(ticketNumber).padStart(4, '0')}`,
      priority: values.priority,
      requester: accountProfile.fullName,
      status: 'Open',
      statusTone: 'open',
      time: 'Just now',
      title: values.subject,
    };
    setTickets((current) => [ticket, ...current]);
    navigate('tickets', getTicketFilterParams(location.params));
  }

  if (location.route === 'register') {
    return (
      <RegisterPage
        onSignIn={() => navigate('login')}
        onSubmit={handleRegister}
      />
    );
  }

  if (location.route === 'login') {
    return (
      <SignInPage
        onCreateAccount={() => navigate('register')}
        onSubmit={handleSignIn}
      />
    );
  }

  if (location.route === 'admin') {
    if (!sessionCapabilities.managePlatform) {
      return <AdminAccessDenied onBack={() => navigate('tickets')} />;
    }
    return (
      <GlobalAdminPage
        onExit={() => navigate('tickets')}
        onOrganizations={() => navigate('organizations')}
      />
    );
  }

  if (location.route === 'privacy-policy' || location.route === 'terms') {
    return (
      <LegalPage
        kind={location.route === 'terms' ? 'terms' : 'privacy'}
        onBack={() =>
          navigate(
            location.params.get('from') === 'account'
              ? 'account/privacy'
              : 'login',
          )
        }
        onNavigate={(kind) =>
          navigate(kind === 'privacy' ? 'privacy-policy' : 'terms', {
            from: location.params.get('from') ?? undefined,
          })
        }
        onSignIn={() => navigate('login')}
      />
    );
  }

  return (
    <AppShell
      activeSection={getActiveSection(location.route)}
      avatarUrl={avatarUrl}
      onNavigate={navigate}
      organizationName={organizationName}
      userEmail={accountProfile.email}
      userName={accountProfile.fullName}
    >
      <WorkspacePage
        accountProfile={accountProfile}
        avatarUrl={avatarUrl}
        location={location}
        navigate={navigate}
        onAvatarChange={setAvatarUrl}
        onCreateTicket={handleCreateTicket}
        onOrganizationChange={setOrganizationName}
        onProfileChange={setAccountProfile}
        onTicketChange={(updatedTicket) =>
          setTickets((current) =>
            current.map((ticket) =>
              ticket.id === updatedTicket.id ? updatedTicket : ticket,
            ),
          )
        }
        organizationName={organizationName}
        tickets={tickets}
      />
    </AppShell>
  );
}

export default App;
