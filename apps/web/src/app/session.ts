import type { PendingRole } from 'contracts';
import type { AuthResponse } from '../api/auth';
import type { AccountProfile } from '../features/account/accountData';

export type AccountState = 'ACTIVE' | 'SUSPENDED';
export type GlobalRole = 'USER' | 'GLOBAL_ADMIN';
export type OrganizationRole = 'MEMBER' | 'AGENT' | 'ORG_ADMIN';

export type Permission =
  | 'ticket:create'
  | 'ticket:read'
  | 'ticket:update'
  | 'ticket:changeStatus'
  | 'ticket:selfAssign'
  | 'ticket:assignOther'
  | 'ticket:reopen'
  | 'ticket:delete'
  | 'ticket:viewInternalNotes'
  | 'comment:create'
  | 'comment:createInternal'
  | 'comment:update'
  | 'comment:delete'
  | 'attachment:create'
  | 'attachment:read'
  | 'attachment:delete'
  | 'organization:read'
  | 'organization:update'
  | 'organization:delete'
  | 'member:read'
  | 'member:invite'
  | 'member:changeRole'
  | 'member:remove'
  | 'member:leave'
  | 'category:read'
  | 'category:write'
  | 'apiKey:manage'
  | 'stats:read'
  | 'user:listAll'
  | 'user:updateOther'
  | 'user:setStatus'
  | 'user:setGlobalRole'
  | 'user:deleteOther'
  | 'audit:read';

export interface SessionMembership {
  organizationDescription?: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: OrganizationRole;
}

export type PreviewIdentity =
  | 'member'
  | 'agent'
  | 'organization-admin'
  | 'global-admin'
  | 'suspended'
  | 'no-organization';

export interface ViewerSession {
  accountState: AccountState;
  avatarUrl?: string;
  /** Whether the address was confirmed. Reserved roles wait for it. */
  emailVerified: boolean;
  globalRole: GlobalRole;
  id: string;
  memberships: SessionMembership[];
  /** Roles an administrator reserved for this address, waiting for confirmation. */
  pendingRoles: PendingRole[];
  permissions: Permission[];
  previewIdentity?: PreviewIdentity;
  profile: AccountProfile;
}

export const previewMode = import.meta.env.VITE_PREVIEW_MODE === 'true';

const MEMBER_PERMISSIONS: Permission[] = [
  'ticket:create',
  'comment:create',
  'attachment:create',
  'organization:read',
  'member:leave',
  'category:read',
];

const AGENT_PERMISSIONS: Permission[] = [
  ...MEMBER_PERMISSIONS,
  'ticket:read',
  'ticket:update',
  'ticket:changeStatus',
  'ticket:selfAssign',
  'ticket:reopen',
  'ticket:viewInternalNotes',
  'comment:createInternal',
  'attachment:read',
  'attachment:delete',
  'stats:read',
];

const ORGANIZATION_ADMIN_PERMISSIONS: Permission[] = [
  ...AGENT_PERMISSIONS,
  'ticket:assignOther',
  'ticket:delete',
  'comment:update',
  'comment:delete',
  'organization:update',
  'organization:delete',
  'member:read',
  'member:invite',
  'member:changeRole',
  'member:remove',
  'category:write',
  'apiKey:manage',
];

const PLATFORM_PERMISSIONS: Permission[] = [
  ...ORGANIZATION_ADMIN_PERMISSIONS,
  'user:listAll',
  'user:updateOther',
  'user:setStatus',
  'user:setGlobalRole',
  'user:deleteOther',
  'audit:read',
];

const membership = (
  organizationId: string,
  organizationName: string,
  organizationSlug: string,
  organizationDescription: string,
  role: OrganizationRole,
): SessionMembership => ({
  organizationDescription,
  organizationId,
  organizationName,
  organizationSlug,
  role,
});

const northstar = (role: OrganizationRole) =>
  membership(
    'org-northstar',
    'Northstar Studio',
    'northstar-studio',
    'Design and product operations for the Northstar team.',
    role,
  );

const helio = (role: OrganizationRole) =>
  membership(
    'org-helio',
    'Helio Labs',
    'helio-labs',
    'Research operations and internal support for Helio Labs.',
    role,
  );

const orbit = (role: OrganizationRole) =>
  membership(
    'org-orbit',
    'Orbit Finance',
    'orbit-finance',
    'Finance systems, reporting and employee service requests.',
    role,
  );

function previewProfile(
  fullName: string,
  email: string,
  jobTitle: string,
): AccountProfile {
  const [firstName = '', ...lastNames] = fullName.split(' ');
  return {
    bio: 'Helping teams resolve requests with clear, dependable communication.',
    email,
    firstName,
    fullName,
    jobTitle,
    lastName: lastNames.join(' '),
    location: 'Barcelona, Spain',
    username: email.split('@')[0] ?? email,
  };
}

export const previewSessions: Record<PreviewIdentity, ViewerSession> = {
  member: {
    accountState: 'ACTIVE',
    emailVerified: true,
    pendingRoles: [],
    globalRole: 'USER',
    id: 'preview-member',
    memberships: [northstar('MEMBER'), helio('MEMBER')],
    permissions: MEMBER_PERMISSIONS,
    previewIdentity: 'member',
    profile: previewProfile(
      'John Lee',
      'john.lee@northstar.test',
      'Product designer',
    ),
  },
  agent: {
    accountState: 'ACTIVE',
    emailVerified: true,
    pendingRoles: [],
    globalRole: 'USER',
    id: 'preview-agent',
    memberships: [northstar('AGENT'), orbit('MEMBER')],
    permissions: AGENT_PERMISSIONS,
    previewIdentity: 'agent',
    profile: previewProfile(
      'Maya Singh',
      'maya.singh@northstar.test',
      'Support agent',
    ),
  },
  'organization-admin': {
    accountState: 'ACTIVE',
    emailVerified: true,
    pendingRoles: [],
    globalRole: 'USER',
    id: 'preview-organization-admin',
    memberships: [northstar('ORG_ADMIN')],
    permissions: ORGANIZATION_ADMIN_PERMISSIONS,
    previewIdentity: 'organization-admin',
    profile: previewProfile(
      'Mia Chen',
      'mia.chen@northstar.test',
      'Organization admin',
    ),
  },
  'global-admin': {
    accountState: 'ACTIVE',
    emailVerified: true,
    pendingRoles: [],
    globalRole: 'GLOBAL_ADMIN',
    id: 'preview-global-admin',
    memberships: [],
    permissions: PLATFORM_PERMISSIONS,
    previewIdentity: 'global-admin',
    profile: previewProfile(
      'Sam Okafor',
      'sam@helpdesk.test',
      'Platform administrator',
    ),
  },
  suspended: {
    accountState: 'SUSPENDED',
    emailVerified: true,
    pendingRoles: [],
    globalRole: 'USER',
    id: 'preview-suspended',
    memberships: [northstar('MEMBER')],
    permissions: [],
    previewIdentity: 'suspended',
    profile: previewProfile(
      'Carlos Vega',
      'carlos.vega@northstar.test',
      'Support agent',
    ),
  },
  'no-organization': {
    accountState: 'ACTIVE',
    emailVerified: false,
    pendingRoles: [
      {
        scope: 'ORGANIZATION',
        role: 'AGENT',
        organizationName: 'Northstar Studio',
      },
    ],
    globalRole: 'USER',
    id: 'preview-no-organization',
    memberships: [],
    permissions: [],
    previewIdentity: 'no-organization',
    profile: previewProfile('Noah Kim', 'noah.kim@helpdesk.test', 'New member'),
  },
};

export const previewIdentityOptions: Array<{
  label: string;
  value: PreviewIdentity;
}> = [
  { label: 'Member', value: 'member' },
  { label: 'Agent', value: 'agent' },
  { label: 'Organization admin', value: 'organization-admin' },
  { label: 'Global admin', value: 'global-admin' },
  { label: 'Suspended account', value: 'suspended' },
  { label: 'No active organization', value: 'no-organization' },
];

export function can(
  viewer: Pick<ViewerSession, 'accountState' | 'permissions'>,
  permission: Permission,
): boolean {
  return (
    viewer.accountState === 'ACTIVE' && viewer.permissions.includes(permission)
  );
}

export function activeMembership(
  viewer: ViewerSession,
  organizationId?: string,
) {
  return organizationId
    ? viewer.memberships.find(
        (membership) => membership.organizationId === organizationId,
      )
    : viewer.memberships[0];
}

export function activeOrganizationName(
  viewer: ViewerSession,
  organizationId?: string,
) {
  return (
    activeMembership(viewer, organizationId)?.organizationName ??
    (viewer.globalRole === 'GLOBAL_ADMIN' ? 'Northstar Studio' : '')
  );
}

export function permissionsForOrganizationRole(
  role: OrganizationRole,
): Permission[] {
  if (role === 'ORG_ADMIN') return ORGANIZATION_ADMIN_PERMISSIONS;
  if (role === 'AGENT') return AGENT_PERMISSIONS;
  return MEMBER_PERMISSIONS;
}

export function membershipForOrganization(
  viewer: ViewerSession,
  organizationId: string,
) {
  return activeMembership(viewer, organizationId);
}

/**
 * Los permisos de la sesión, recortados a UNA organización.
 *
 * `/auth/me` manda el rol más alto que la persona tiene en cualquiera de sus
 * organizaciones, y lo dice en su propio comentario: sirve para apagar
 * controles, no para decidir. Quien es ORG_ADMIN en una y MEMBER en otra
 * llegaría con permisos de administrador a las dos. Aquí se vuelve a calcular
 * con la pertenencia a la organización activa, así que al cambiar de
 * organización los permisos cambian con ella; sin pertenencia no queda
 * ninguno. El administrador de plataforma pasa entero: su alcance no es una
 * organización.
 *
 * La API vuelve a comprobarlo todo (`orgScope`): esto decide lo que se ve, no
 * lo que se puede.
 */
export function scopeViewerToOrganization(
  viewer: ViewerSession,
  organizationId: string,
): ViewerSession {
  if (viewer.globalRole === 'GLOBAL_ADMIN') return viewer;
  const scopedMembership = membershipForOrganization(viewer, organizationId);
  if (!scopedMembership) return { ...viewer, permissions: [] };
  return {
    ...viewer,
    permissions: permissionsForOrganizationRole(scopedMembership.role),
  };
}

export function viewerFromAuthUser(user: AuthResponse['user']): ViewerSession {
  const memberships = user.memberships.filter(
    (membership): membership is SessionMembership =>
      Boolean(
        membership &&
        typeof membership.organizationId === 'string' &&
        typeof membership.organizationName === 'string' &&
        typeof membership.organizationSlug === 'string' &&
        (membership.role === 'MEMBER' ||
          membership.role === 'AGENT' ||
          membership.role === 'ORG_ADMIN'),
      ),
  );
  return {
    accountState: 'ACTIVE',
    avatarUrl: user.avatarUrl ?? undefined,
    emailVerified: user.emailVerified,
    globalRole: user.globalRole === 'GLOBAL_ADMIN' ? 'GLOBAL_ADMIN' : 'USER',
    id: user.id,
    memberships,
    pendingRoles: user.pendingRoles ?? [],
    permissions: user.permissions.filter(
      (permission): permission is Permission => typeof permission === 'string',
    ),
    profile: {
      bio: user.bio ?? '',
      email: user.email,
      firstName: user.firstName,
      fullName: user.displayName || `${user.firstName} ${user.lastName}`.trim(),
      jobTitle: user.jobTitle ?? '',
      lastName: user.lastName,
      location: user.timezone,
      username: user.username,
    },
  };
}
