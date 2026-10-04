import {
  assignOrganizationRoleSchema,
  assignPlatformRoleSchema,
  type AssignOrganizationRoleInput,
  type AssignPlatformRoleInput,
  type OrgRole,
  type OrganizationRoleAssignment,
  type OrganizationRoleReservation,
  type Paginated,
  type PlatformRoleAssignment,
  type PlatformRoleReservation,
} from 'contracts';
import { request } from '../core/api/client';

/**
 * Role assignment by e-mail, against the API. The two screens never import
 * this directly: they go through `features/roles/rolesGateway.ts`, which
 * swaps it for an in-memory version in the frontend preview.
 */

export interface PlatformAdministrator {
  avatarUrl: string | null;
  displayName: string;
  email: string;
  emailVerified: boolean;
  id: string;
  isActive: boolean;
  isPrimary: boolean;
  lastLoginAt: string | null;
  username: string;
}

export interface OrganizationMemberRow {
  avatarUrl: string | null;
  displayName: string;
  email: string;
  isOnline: boolean;
  joinedAt: string;
  role: OrgRole;
  userId: string;
  username: string;
}

interface ApiUserRow {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  emailVerifiedAt: string | null;
  isPrimary?: boolean;
  profile: { displayName: string; avatarUrl: string | null } | null;
}

interface ApiMemberRow {
  role: OrgRole;
  joinedAt: string;
  user: {
    id: string;
    username: string;
    email: string;
    profile: {
      displayName: string;
      avatarUrl: string | null;
      isOnline: boolean;
    } | null;
  };
}

export async function listPlatformAdministrators(): Promise<
  PlatformAdministrator[]
> {
  const page = await request<Paginated<ApiUserRow>>(
    '/users?globalRole=GLOBAL_ADMIN&take=100&sort=createdAt&order=asc',
  );
  return page.data.map((row) => ({
    avatarUrl: row.profile?.avatarUrl ?? null,
    displayName: row.profile?.displayName || row.username,
    email: row.email,
    emailVerified: Boolean(row.emailVerifiedAt),
    id: row.id,
    isActive: row.isActive,
    isPrimary: Boolean(row.isPrimary),
    lastLoginAt: row.lastLoginAt,
    username: row.username,
  }));
}

export function listPlatformReservations(): Promise<PlatformRoleReservation[]> {
  return request('/admin/role-grants');
}

export function assignPlatformRole(
  input: AssignPlatformRoleInput,
): Promise<PlatformRoleAssignment> {
  return request('/admin/role-grants', {
    method: 'POST',
    body: assignPlatformRoleSchema.parse(input),
  });
}

/** Back to a standard account. The API refuses it on yourself and on the primary administrator. */
export async function withdrawPlatformRole(userId: string): Promise<void> {
  await request(`/users/${userId}/role`, {
    method: 'PATCH',
    body: { globalRole: 'USER' },
  });
}

export async function cancelPlatformReservation(id: string): Promise<void> {
  await request(`/admin/role-grants/${id}`, { method: 'DELETE' });
}

export async function listMembers(
  organizationId: string,
): Promise<OrganizationMemberRow[]> {
  const rows = await request<ApiMemberRow[]>(
    `/organizations/${organizationId}/members`,
  );
  return rows.map((row) => ({
    avatarUrl: row.user.profile?.avatarUrl ?? null,
    displayName: row.user.profile?.displayName || row.user.username,
    email: row.user.email,
    isOnline: row.user.profile?.isOnline ?? false,
    joinedAt: row.joinedAt,
    role: row.role,
    userId: row.user.id,
    username: row.user.username,
  }));
}

export function listOrganizationReservations(
  organizationId: string,
): Promise<OrganizationRoleReservation[]> {
  return request(`/organizations/${organizationId}/role-grants`);
}

export function assignOrganizationRole(
  organizationId: string,
  input: AssignOrganizationRoleInput,
): Promise<OrganizationRoleAssignment> {
  return request(`/organizations/${organizationId}/role-grants`, {
    method: 'POST',
    body: assignOrganizationRoleSchema.parse(input),
  });
}

export async function changeMemberRole(
  organizationId: string,
  userId: string,
  role: OrgRole,
): Promise<void> {
  await request(`/organizations/${organizationId}/members/${userId}`, {
    method: 'PATCH',
    body: { role },
  });
}

export async function removeMember(
  organizationId: string,
  userId: string,
): Promise<void> {
  await request(`/organizations/${organizationId}/members/${userId}`, {
    method: 'DELETE',
  });
}

export async function cancelOrganizationReservation(
  organizationId: string,
  id: string,
): Promise<void> {
  await request(`/organizations/${organizationId}/role-grants/${id}`, {
    method: 'DELETE',
  });
}
