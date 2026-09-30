import { useEffect, useState } from 'react';
import {
  buildHash,
  getActiveSection,
  getTicketFilterParams,
  readLocation,
  type AppLocation,
  type Navigate,
} from './app/routes';
import {
  activeOrganizationName,
  can,
  previewMode,
  previewSessions,
  scopePreviewViewer,
  viewerFromAuthUser,
  type PreviewIdentity,
  type ViewerSession,
} from './app/session';
import { SessionStatePage } from './app/SessionStatePage';
import { WorkspacePage } from './app/WorkspacePage';
import { RegisterPage } from './features/auth/RegisterPage';
import { SignInPage } from './features/auth/SignInPage';
import { LegalPage } from './features/legal/LegalPage';
import type { NewTicketValues } from './features/tickets/CreateTicketPage';
import { initialTickets, type Ticket } from './features/tickets/ticketData';
import {
  organizationById,
  organizationCatalog,
  organizationsForViewer,
  type OrganizationSummary,
} from './features/organizations/organizationsData';
import { AppShell } from './layout/AppShell';
import { logout, refreshSession, type AuthResponse } from './api/auth';

function App() {
  const initialViewer = previewMode ? previewSessions.agent : null;
  const initialOrganizationId =
    initialViewer?.memberships[0]?.organizationId ?? organizationCatalog[0].id;
  const [location, setLocation] = useState<AppLocation>(readLocation);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
    initialViewer?.avatarUrl,
  );
  const [viewer, setViewer] = useState<ViewerSession | null>(initialViewer);
  const [accountProfile, setAccountProfile] = useState(
    initialViewer?.profile ?? null,
  );
  const [sessionReady, setSessionReady] = useState(previewMode);
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [organizationId, setOrganizationId] = useState(initialOrganizationId);
  const [organizationName, setOrganizationName] = useState(
    initialViewer
      ? activeOrganizationName(initialViewer, initialOrganizationId)
      : '',
  );
  const [organizationDescription, setOrganizationDescription] = useState(
    organizationById(initialOrganizationId)?.description ?? '',
  );

  function selectOrganization(nextViewer: ViewerSession, nextId: string) {
    const fallbackId =
      nextViewer.memberships[0]?.organizationId ?? organizationCatalog[0].id;
    const available = organizationsForViewer(nextViewer);
    const selected =
      available.find((organization) => organization.id === nextId) ??
      available.find((organization) => organization.id === fallbackId) ??
      available[0];
    if (!selected) return;
    setOrganizationId(selected.id);
    setOrganizationName(selected.name);
    setOrganizationDescription(selected.description);
  }

  function selectOrganizationSummary(organization: OrganizationSummary) {
    setOrganizationId(organization.id);
    setOrganizationName(organization.name);
    setOrganizationDescription(organization.description);
  }

  useEffect(() => {
    if (previewMode) return;
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
        const authenticatedViewer = viewerFromAuthUser(authData.user);
        setViewer(authenticatedViewer);
        setAccountProfile(authenticatedViewer.profile);
        setAvatarUrl(authenticatedViewer.avatarUrl);
        selectOrganization(
          authenticatedViewer,
          authenticatedViewer.memberships[0]?.organizationId ??
            organizationCatalog[0].id,
        );
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
    const authenticatedViewer = viewerFromAuthUser(user);
    setViewer(authenticatedViewer);
    setAccountProfile(authenticatedViewer.profile);
    setAvatarUrl(authenticatedViewer.avatarUrl);
    selectOrganization(
      authenticatedViewer,
      authenticatedViewer.memberships[0]?.organizationId ??
        organizationCatalog[0].id,
    );
    navigate('tickets');
  }

  function handleRegister(user: AuthResponse['user']) {
    const authenticatedViewer = viewerFromAuthUser(user);
    setViewer(authenticatedViewer);
    setAccountProfile(authenticatedViewer.profile);
    setAvatarUrl(authenticatedViewer.avatarUrl);
    selectOrganization(
      authenticatedViewer,
      authenticatedViewer.memberships[0]?.organizationId ??
        organizationCatalog[0].id,
    );
    navigate('tickets');
  }

  async function handleSignOut() {
    try {
      if (!previewMode) await logout();
    } finally {
      if (!previewMode) {
        setViewer(null);
        setAccountProfile(null);
        setAvatarUrl(undefined);
      }
      navigate('login');
    }
  }

  function handlePreviewIdentityChange(identity: PreviewIdentity) {
    const nextViewer = previewSessions[identity];
    setViewer(nextViewer);
    setAccountProfile(nextViewer.profile);
    setAvatarUrl(nextViewer.avatarUrl);
    selectOrganization(
      nextViewer,
      nextViewer.memberships[0]?.organizationId ?? organizationCatalog[0].id,
    );
    if (location.route === 'admin' && !can(nextViewer, 'user:listAll')) {
      navigate('tickets');
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
      organizationId,
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
        onOpenPreview={previewMode ? () => navigate('tickets') : undefined}
        onSubmit={handleSignIn}
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

  if (!sessionReady || !accountProfile || !viewer) {
    return <main aria-live="polite">Loading...</main>;
  }

  if (viewer.accountState === 'SUSPENDED') {
    return (
      <SessionStatePage
        kind="suspended"
        onPreviewIdentityChange={handlePreviewIdentityChange}
        onSignOut={handleSignOut}
        viewer={viewer}
      />
    );
  }

  if (viewer.globalRole !== 'GLOBAL_ADMIN' && viewer.memberships.length === 0) {
    return (
      <SessionStatePage
        kind="no-organization"
        onPreviewIdentityChange={handlePreviewIdentityChange}
        onSignOut={handleSignOut}
        viewer={viewer}
      />
    );
  }

  const organizationOptions = organizationsForViewer(viewer);
  const scopedViewer = scopePreviewViewer(viewer, organizationId);

  return (
    <AppShell
      activeOrganizationId={organizationId}
      activeSection={getActiveSection(location.route)}
      avatarUrl={avatarUrl}
      hideMobileHeader={location.route === 'ticket-detail'}
      onNavigate={navigate}
      onOrganizationChange={(nextId) => {
        selectOrganization(viewer, nextId);
      }}
      onPreviewIdentityChange={handlePreviewIdentityChange}
      onSignOut={handleSignOut}
      organizationName={organizationName}
      organizationOptions={[
        ...organizationOptions.map(({ id, name }) => ({ id, name })),
        ...(organizationOptions.some(
          (organization) => organization.id === organizationId,
        )
          ? []
          : [{ id: organizationId, name: organizationName }]),
      ]}
      userEmail={accountProfile.email}
      userName={accountProfile.fullName}
      viewer={scopedViewer}
    >
      <WorkspacePage
        accountProfile={accountProfile}
        avatarUrl={avatarUrl}
        location={location}
        navigate={navigate}
        onAvatarChange={setAvatarUrl}
        onCreateTicket={handleCreateTicket}
        onOrganizationDescriptionChange={setOrganizationDescription}
        onOrganizationNameChange={setOrganizationName}
        onOrganizationSelect={selectOrganizationSummary}
        onProfileChange={(profile) => {
          setAccountProfile(profile);
          setViewer((current) => (current ? { ...current, profile } : current));
        }}
        onTicketChange={(updatedTicket) =>
          setTickets((current) =>
            current.map((ticket) =>
              ticket.id === updatedTicket.id ? updatedTicket : ticket,
            ),
          )
        }
        organizationDescription={organizationDescription}
        organizationId={organizationId}
        organizationName={organizationName}
        tickets={tickets}
        viewer={scopedViewer}
      />
    </AppShell>
  );
}

export default App;
