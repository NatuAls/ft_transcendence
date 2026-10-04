import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildHash,
  getActiveSection,
  getTicketFilterParams,
  publicRoutes,
  readLocation,
  returnRoute,
  type AppLocation,
  type Navigate,
} from './app/routes';
import {
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
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { VerifyEmailPage } from './features/auth/VerifyEmailPage';
import { LegalPage } from './features/legal/LegalPage';
import type { NewTicketValues } from './features/tickets/CreateTicketPage';
import { initialTickets, type Ticket } from './features/tickets/ticketData';
import {
  getOrganizationInitials,
  organizationsForViewer,
  summaryFromRecord,
  type OrganizationSummary,
} from './features/organizations/organizationsData';
import { AppShell } from './layout/AppShell';
import { logout, refreshSession, type AuthResponse } from './api/auth';
import { listOrganizations } from './api/organizations';
import { connectRealtime, disconnectRealtime } from './app/realtime';

const roleLabels = {
  AGENT: 'Support agent',
  MEMBER: 'Member',
  ORG_ADMIN: 'Organization admin',
} as const;

/**
 * The organizations the viewer can switch between.
 *
 * In the preview they come from local sample data. In the real application
 * they come from `GET /organizations` - every organization of the account, or
 * every organization of the platform for a platform administrator - so the
 * active organization is a real one and every screen that works inside it
 * talks about the right tenant.
 */
async function loadOrganizations(
  viewer: ViewerSession,
): Promise<OrganizationSummary[]> {
  if (previewMode) return organizationsForViewer(viewer);
  try {
    return (await listOrganizations()).map(summaryFromRecord);
  } catch {
    // The memberships still name every organization of the account; only the
    // descriptions and counters wait for the next successful load.
    return viewer.memberships.map((membership) => ({
      description: membership.organizationDescription ?? '',
      id: membership.organizationId,
      initials: getOrganizationInitials(membership.organizationName),
      name: membership.organizationName,
      roleLabel: roleLabels[membership.role],
      slug: membership.organizationSlug,
      summary: '',
    }));
  }
}

/** Changes whenever the set of organizations or roles of the account does. */
function accessSignature(viewer: ViewerSession) {
  return [
    viewer.id,
    viewer.globalRole,
    ...viewer.memberships
      .map((membership) => `${membership.organizationId}:${membership.role}`)
      .sort(),
  ].join('|');
}

function App() {
  const initialViewer = previewMode ? previewSessions.agent : null;
  const initialOrganizations = initialViewer
    ? organizationsForViewer(initialViewer)
    : [];
  const initialOrganization =
    initialOrganizations.find(
      (organization) =>
        organization.id === initialViewer?.memberships[0]?.organizationId,
    ) ?? initialOrganizations[0];
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
  const [organizations, setOrganizations] =
    useState<OrganizationSummary[]>(initialOrganizations);
  const [organizationId, setOrganizationId] = useState(
    initialOrganization?.id ?? '',
  );
  const [organizationName, setOrganizationName] = useState(
    initialOrganization?.name ?? '',
  );
  const [organizationDescription, setOrganizationDescription] = useState(
    initialOrganization?.description ?? '',
  );
  // Read from callbacks only: the session effect re-selects the organization
  // the person was on instead of jumping back to the first one.
  const organizationIdRef = useRef(organizationId);
  const loadedSignatureRef = useRef('');

  useEffect(() => {
    organizationIdRef.current = organizationId;
  }, [organizationId]);

  function selectFrom(
    available: OrganizationSummary[],
    nextViewer: ViewerSession,
    preferredId?: string,
  ) {
    const selected =
      available.find((organization) => organization.id === preferredId) ??
      available.find(
        (organization) =>
          organization.id === nextViewer.memberships[0]?.organizationId,
      ) ??
      available[0];
    setOrganizationId(selected?.id ?? '');
    setOrganizationName(selected?.name ?? '');
    setOrganizationDescription(selected?.description ?? '');
  }

  function selectOrganizationSummary(organization: OrganizationSummary) {
    setOrganizationId(organization.id);
    setOrganizationName(organization.name);
    setOrganizationDescription(organization.description);
  }

  /**
   * Applies a user as the API returned it. The organization list is only
   * fetched again when the account's access changed (or when asked to), not
   * on every navigation.
   */
  const establishSession = useCallback(
    async (
      user: AuthResponse['user'],
      options: { force?: boolean; preferredId?: string } = {},
    ) => {
      const nextViewer = viewerFromAuthUser(user);
      setViewer(nextViewer);
      setAccountProfile(nextViewer.profile);
      setAvatarUrl(nextViewer.avatarUrl);
      // Present for everybody else while signed in, on any screen.
      if (!previewMode) connectRealtime();
      const signature = accessSignature(nextViewer);
      if (options.force || signature !== loadedSignatureRef.current) {
        loadedSignatureRef.current = signature;
        const available = await loadOrganizations(nextViewer);
        setOrganizations(available);
        selectFrom(
          available,
          nextViewer,
          options.preferredId ?? organizationIdRef.current,
        );
      }
      return nextViewer;
    },
    [],
  );

  /**
   * Reads the session again from the server. Used after anything that may
   * have changed the viewer's own access: a role they changed on themselves,
   * a confirmed address that claimed reserved roles, an organization created
   * or deleted.
   */
  const reloadSession = useCallback(
    async (preferredId?: string): Promise<ViewerSession | null> => {
      if (previewMode) return viewer;
      const authData = await refreshSession();
      if (!authData) return null;
      return establishSession(authData.user, { force: true, preferredId });
    },
    [establishSession, viewer],
  );

  useEffect(() => {
    if (previewMode) return;
    void refreshSession()
      .then(async (authData) => {
        if (!authData) {
          disconnectRealtime();
          if (!publicRoutes.has(location.route)) {
            window.location.hash = buildHash('login');
          }
          return;
        }
        await establishSession(authData.user);
        if (location.route === 'login' || location.route === 'register') {
          window.location.hash = buildHash('tickets');
        }
      })
      .finally(() => setSessionReady(true));
  }, [establishSession, location.route]);

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
    loadedSignatureRef.current = '';
    await establishSession(user);
    navigate('tickets');
  }

  async function handleRegister(user: AuthResponse['user']) {
    loadedSignatureRef.current = '';
    await establishSession(user);
    navigate('tickets');
  }

  async function handleSignOut() {
    try {
      if (!previewMode) await logout();
    } finally {
      if (!previewMode) {
        disconnectRealtime();
        setViewer(null);
        setAccountProfile(null);
        setAvatarUrl(undefined);
        setOrganizations([]);
        loadedSignatureRef.current = '';
      }
      navigate('login');
    }
  }

  function handlePreviewIdentityChange(identity: PreviewIdentity) {
    const nextViewer = previewSessions[identity];
    setViewer(nextViewer);
    setAccountProfile(nextViewer.profile);
    setAvatarUrl(nextViewer.avatarUrl);
    const available = organizationsForViewer(nextViewer);
    setOrganizations(available);
    selectFrom(available, nextViewer);
    if (
      (location.route === 'admin' || location.route === 'platform-roles') &&
      !can(nextViewer, 'user:listAll')
    ) {
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
        initialEmail={location.params.get('email') ?? ''}
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

  if (location.route === 'verify-email') {
    return (
      <VerifyEmailPage
        onContinue={(signedIn) => navigate(signedIn ? 'tickets' : 'login')}
        onVerified={reloadSession}
        token={location.params.get('token') ?? ''}
      />
    );
  }

  if (location.route === 'forgot-password') {
    return <ForgotPasswordPage onBack={() => navigate('login')} />;
  }

  if (location.route === 'reset-password') {
    return (
      <ResetPasswordPage
        onDone={() => navigate('login')}
        onRequestNew={() => navigate('forgot-password')}
        token={location.params.get('token') ?? ''}
      />
    );
  }

  if (location.route === 'privacy-policy' || location.route === 'terms') {
    const from = returnRoute(location.params.get('from'));
    const signedIn = Boolean(viewer);
    return (
      <LegalPage
        kind={location.route === 'terms' ? 'terms' : 'privacy'}
        onBack={() => navigate(from ?? (signedIn ? 'tickets' : 'login'))}
        onNavigate={(kind) =>
          navigate(kind === 'privacy' ? 'privacy-policy' : 'terms', {
            from,
          })
        }
        onSignIn={() => navigate(signedIn ? 'tickets' : 'login')}
        signedIn={signedIn}
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
        onRecheck={reloadSession}
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
        onRecheck={reloadSession}
        onSignOut={handleSignOut}
        viewer={viewer}
      />
    );
  }

  const scopedViewer = scopePreviewViewer(viewer, organizationId);

  return (
    <AppShell
      activeOrganizationId={organizationId}
      activeRoute={location.route}
      activeSection={getActiveSection(location.route)}
      avatarUrl={avatarUrl}
      hideMobileHeader={location.route === 'ticket-detail'}
      onNavigate={navigate}
      onOrganizationChange={(nextId) => {
        const selected = organizations.find(
          (organization) => organization.id === nextId,
        );
        if (selected) selectOrganizationSummary(selected);
      }}
      onPreviewIdentityChange={handlePreviewIdentityChange}
      onSignOut={handleSignOut}
      organizationName={organizationName}
      organizationOptions={[
        ...organizations.map(({ id, name }) => ({ id, name })),
        ...(organizationId &&
        !organizations.some(
          (organization) => organization.id === organizationId,
        )
          ? [{ id: organizationId, name: organizationName }]
          : []),
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
        onAccessChanged={() => void reloadSession()}
        onAvatarChange={setAvatarUrl}
        onCreateTicket={handleCreateTicket}
        onOrganizationDescriptionChange={setOrganizationDescription}
        onOrganizationNameChange={setOrganizationName}
        onOrganizationSelect={selectOrganizationSummary}
        onOrganizationsChanged={(preferredId) =>
          void reloadSession(preferredId)
        }
        onSignOut={handleSignOut}
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
        organizations={organizations}
        tickets={tickets}
        viewer={scopedViewer}
      />
    </AppShell>
  );
}

export default App;
