/**
 * Answers of the API, shaped like its OpenAPI document says (and checked
 * against it by `reply()` wherever they are used).
 */
export const ids = {
  admin: '01a106fe-0b2c-7e11-9f40-6a5d3c2b1a00',
  agent: '01a106fe-1c3d-7e22-8a51-7b6e4d3c2b11',
  member: '01a106fe-2d4e-7f33-9b62-8c7f5e4d3c22',
  organization: '01a106f0-77aa-7c51-8d0e-5f3a2c9b1e42',
  primary: '01a106fe-3e5f-7a44-8c73-9d806f5e4d33',
  reservation: '01a10712-4c1e-7b3d-a0f2-9be1d07c5a11',
  session: '01a10713-5d2f-7c4e-b103-ac0e18d6b622',
  otherSession: '01a10713-6e3a-7d5f-8214-bd1f29e7c733',
};

const at = '2026-10-04T09:30:00.000Z';

export const grantor = {
  id: ids.admin,
  username: 'ana',
  displayName: 'Ana García',
};

export function adminUser(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.admin,
    username: 'ana',
    email: 'ana@example.com',
    globalRole: 'GLOBAL_ADMIN',
    isActive: true,
    createdAt: at,
    lastLoginAt: at,
    emailVerifiedAt: at,
    profile: { displayName: 'Ana García', avatarUrl: null, isOnline: true },
    _count: { memberships: 1, ticketsCreated: 3 },
    isPrimary: false,
    ...overrides,
  };
}

export function page<T>(data: T[]) {
  return {
    data,
    meta: { total: data.length, page: 1, take: 100, pages: 1 },
  };
}

export function member(
  overrides: {
    id?: string;
    role?: string;
    username?: string;
    email?: string;
    displayName?: string | null;
    isOnline?: boolean;
  } = {},
) {
  const id = overrides.id ?? ids.member;
  return {
    id: ids.reservation,
    role: overrides.role ?? 'MEMBER',
    joinedAt: at,
    user: {
      id,
      username: overrides.username ?? 'john',
      email: overrides.email ?? 'john@example.com',
      profile: {
        displayName:
          overrides.displayName === undefined
            ? 'John Lee'
            : overrides.displayName,
        avatarUrl: null,
        isOnline: overrides.isOnline ?? false,
        lastSeenAt: at,
      },
    },
  };
}

export function organizationReservation(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: ids.reservation,
    organizationId: ids.organization,
    email: 'new.hire@example.com',
    role: 'AGENT',
    waitingFor: 'ACCOUNT',
    grantedBy: grantor,
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}

export function platformReservation(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.reservation,
    email: 'new.admin@example.com',
    globalRole: 'GLOBAL_ADMIN',
    waitingFor: 'ACCOUNT',
    grantedBy: grantor,
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}

export function deviceSession(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.session,
    createdAt: at,
    lastUsedAt: at,
    expiresAt: '2026-10-11T09:30:00.000Z',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/131.0 Safari/537.36',
    ip: '83.45.120.0',
    current: true,
    ...overrides,
  };
}
