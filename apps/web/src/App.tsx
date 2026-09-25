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
import { AdminAccessDenied } from './features/admin/AdminAccessDenied';
import { GlobalAdminPage } from './features/admin/GlobalAdminPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { SignInPage } from './features/auth/SignInPage';
import { LegalPage } from './features/legal/LegalPage';
import type { NewTicketValues } from './features/tickets/CreateTicketPage';
import { initialTickets, type Ticket } from './features/tickets/ticketData';
import type { AccountProfile } from './features/account/accountData';
import { AppShell } from './layout/AppShell';
import { logout, refreshSession, type AuthResponse } from './api/auth';

function accountProfileFromUser(user: AuthResponse['user']): AccountProfile {
  return {
    bio: user.bio ?? '',
    email: user.email,
    firstName: user.firstName,
    fullName: user.displayName,
    jobTitle: user.jobTitle ?? '',
    lastName: user.lastName,
    location: user.timezone,
    username: user.username,
  };
}

function App() {
  const [location, setLocation] = useState<AppLocation>(readLocation);
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(
    null,
  );
  const [sessionReady, setSessionReady] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [organizationName, setOrganizationName] = useState('Northstar Studio');

  useEffect(() => {
    void refreshSession()
      .then((authData) => {
        if (!authData) {
          if (
            location.route !== 'login' &&
            location.route !== 'register' &&
            location.route !== 'privacy-policy' &&
            location.route !== 'terms'
          ) {
            window.location.hash = buildHash('login');
          }
          return;
        }
        setAccountProfile(accountProfileFromUser(authData.user));
        setAvatarUrl(authData.user.avatarUrl ?? undefined);
        if (location.route === 'login' || location.route === 'register') {
          window.location.hash = buildHash('tickets');
        }
      })
      .finally(() => setSessionReady(true));
  }, [location.route]);

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

  async function handleSignIn(user: AuthResponse['user']) {
    setAccountProfile(accountProfileFromUser(user));
    setAvatarUrl(user.avatarUrl ?? undefined);
    navigate('tickets');
  }

  function handleRegister(user: AuthResponse['user']) {
    setAccountProfile(accountProfileFromUser(user));
    setAvatarUrl(user.avatarUrl ?? undefined);
    navigate('tickets');
  }

  async function handleSignOut() {
    try {
      await logout();
    } finally {
      setAccountProfile(null);
      setAvatarUrl(undefined);
      navigate('login');
    }
  }

  function handleCreateTicket(values: NewTicketValues) {
    if (!accountProfile) return;
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

  if (!sessionReady || !accountProfile) {
    return <main aria-live="polite">Loading...</main>;
  }

  return (
    <AppShell
      activeSection={getActiveSection(location.route)}
      avatarUrl={avatarUrl}
      onNavigate={navigate}
      onSignOut={handleSignOut}
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
