import {
  adminUpdateUserSchema,
  type GlobalRole,
  type Paginated,
} from 'contracts';
import { request } from '../core/api/client';

/** One account as `GET /users` returns it to a platform administrator. */
export interface PlatformUser {
  _count: { memberships: number; ticketsCreated: number };
  createdAt: string;
  email: string;
  emailVerifiedAt: string | null;
  globalRole: GlobalRole;
  id: string;
  isActive: boolean;
  isPrimary: boolean;
  lastLoginAt: string | null;
  profile: {
    avatarUrl: string | null;
    displayName: string;
    isOnline: boolean;
  } | null;
  username: string;
}

export function listUsers(filters: {
  globalRole?: GlobalRole;
  isActive?: boolean;
  q?: string;
}): Promise<Paginated<PlatformUser>> {
  const search = new URLSearchParams({
    order: 'asc',
    sort: 'createdAt',
    take: '100',
  });
  if (filters.q) search.set('q', filters.q);
  if (filters.globalRole) search.set('globalRole', filters.globalRole);
  if (filters.isActive !== undefined)
    search.set('isActive', String(filters.isActive));
  return request(`/users?${search.toString()}`);
}

export async function updateUserName(
  id: string,
  fullName: string,
): Promise<void> {
  const [firstName = '', ...rest] = fullName.trim().split(/\s+/);
  const lastName = rest.join(' ');
  await request(`/users/${id}`, {
    method: 'PATCH',
    body: adminUpdateUserSchema.parse({
      firstName,
      ...(lastName ? { lastName } : {}),
    }),
  });
}

export async function setUserStatus(
  id: string,
  isActive: boolean,
): Promise<void> {
  await request(`/users/${id}/status`, {
    method: 'PATCH',
    body: { isActive },
  });
}

export async function setGlobalRole(
  id: string,
  globalRole: GlobalRole,
): Promise<void> {
  await request(`/users/${id}/role`, {
    method: 'PATCH',
    body: { globalRole },
  });
}

/** Closes the account: sessions revoked, sign-in refused. */
export async function deleteUser(id: string): Promise<void> {
  await request(`/users/${id}`, { method: 'DELETE' });
}
