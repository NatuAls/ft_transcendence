export type AppSection =
  'tickets' | 'people' | 'messages' | 'organization' | 'account';

export type AccountView =
  | 'home'
  | 'profile'
  | 'preferences'
  | 'privacy'
  | 'export-requested'
  | 'export-ready'
  | 'delete';

export type AppRoute =
  | 'login'
  | 'register'
  | 'tickets'
  | 'new-ticket'
  | 'ticket-detail'
  | 'related-tickets'
  | 'people'
  | 'people-profile'
  | 'messages'
  | 'organization'
  | 'account'
  | `account/${Exclude<AccountView, 'home'>}`
  | 'admin'
  | 'organizations'
  | 'privacy-policy'
  | 'terms'
  | 'not-found';

export interface AppLocation {
  params: URLSearchParams;
  route: AppRoute;
}

export type Navigate = (
  route: AppRoute,
  params?: Record<string, string | undefined>,
) => void;

const routes = new Set<AppRoute>([
  'login',
  'register',
  'tickets',
  'new-ticket',
  'ticket-detail',
  'related-tickets',
  'people',
  'people-profile',
  'messages',
  'organization',
  'account',
  'account/profile',
  'account/preferences',
  'account/privacy',
  'account/export-requested',
  'account/export-ready',
  'account/delete',
  'admin',
  'organizations',
  'privacy-policy',
  'terms',
]);

export function readLocation(): AppLocation {
  const rawHash = window.location.hash.slice(1);
  const [path, query = ''] = rawHash.split('?');
  return {
    params: new URLSearchParams(query),
    route: !path
      ? 'login'
      : routes.has(path as AppRoute)
        ? (path as AppRoute)
        : 'not-found',
  };
}

export function buildHash(
  route: AppRoute,
  params: Record<string, string | undefined> = {},
) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const query = search.toString();
  return `#${route}${query ? `?${query}` : ''}`;
}

export function replaceHash(
  route: AppRoute,
  params: Record<string, string | undefined> = {},
) {
  window.history.replaceState(null, '', buildHash(route, params));
}

export function getTicketFilterParams(params: URLSearchParams) {
  return {
    category: params.get('category') ?? undefined,
    page: params.get('page') ?? undefined,
    priority: params.get('priority') ?? undefined,
    q: params.get('q') ?? undefined,
    sort: params.get('sort') ?? undefined,
    status: params.get('status') ?? undefined,
  };
}

export function getAccountView(route: AppRoute): AccountView {
  return route.startsWith('account/')
    ? (route.slice('account/'.length) as AccountView)
    : 'home';
}

export function getActiveSection(route: AppRoute): AppSection {
  if (
    route === 'new-ticket' ||
    route === 'ticket-detail' ||
    route === 'related-tickets'
  )
    return 'tickets';
  if (route === 'people-profile') return 'people';
  if (route === 'organizations') return 'organization';
  if (route.startsWith('account')) return 'account';
  if (
    route === 'tickets' ||
    route === 'people' ||
    route === 'messages' ||
    route === 'organization'
  )
    return route;
  return 'tickets';
}
