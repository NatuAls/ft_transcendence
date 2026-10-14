import {
  createApiKeySchema,
  createCategorySchema,
  createOrganizationSchema,
  updateCategorySchema,
  updateOrganizationSchema,
  type ApiScope,
  type CreateApiKeyInput,
  type CreateCategoryInput,
  type CreateOrganizationInput,
  type OrgRole,
  type UpdateOrganizationInput,
} from 'contracts';
import { request } from '../core/api/client';

/** One organization as `GET /organizations` returns it. */
export interface OrganizationRecord {
  _count: { categories: number; members: number; tickets: number };
  createdAt: string;
  createdById: string;
  description: string | null;
  id: string;
  myRole: OrgRole | null;
  name: string;
  slug: string;
}

export interface CategoryRecord {
  _count?: { tickets: number };
  color: string;
  description: string | null;
  id: string;
  isActive: boolean;
  name: string;
}

/** Every organization of the caller; a platform administrator sees them all. */
export function listOrganizations(): Promise<OrganizationRecord[]> {
  return request('/organizations');
}

export function getOrganization(id: string): Promise<OrganizationRecord> {
  return request(`/organizations/${id}`);
}

export function createOrganization(
  input: CreateOrganizationInput,
): Promise<OrganizationRecord> {
  return request('/organizations', {
    method: 'POST',
    body: createOrganizationSchema.parse(input),
  });
}

export function updateOrganization(
  id: string,
  input: UpdateOrganizationInput,
): Promise<OrganizationRecord> {
  return request(`/organizations/${id}`, {
    method: 'PATCH',
    body: updateOrganizationSchema.parse(input),
  });
}

export async function deleteOrganization(id: string): Promise<void> {
  await request(`/organizations/${id}`, { method: 'DELETE' });
}

/**
 * Stop being a member. The open tickets assigned to you go back to the
 * unassigned queue. The API refuses the last administrator with a 403
 * (`RBAC_FORBIDDEN`): the `member:leave` policy itself says no.
 */
export async function leaveOrganization(id: string): Promise<void> {
  await request(`/organizations/${id}/leave`, { method: 'POST' });
}

export interface OrganizationStats {
  avgFirstResponseSeconds: number;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
  total: number;
  unassigned: number;
}

/** Ticket counters of one organization; AGENT and above. */
export function getOrganizationStats(id: string): Promise<OrganizationStats> {
  return request(`/organizations/${id}/stats`);
}

export function listCategories(
  organizationId: string,
  signal?: AbortSignal,
): Promise<CategoryRecord[]> {
  return request<CategoryRecord[]>(
    `/organizations/${organizationId}/categories`,
    { signal },
  );
}

export function createCategory(
  organizationId: string,
  input: CreateCategoryInput,
): Promise<CategoryRecord> {
  return request(`/organizations/${organizationId}/categories`, {
    method: 'POST',
    body: createCategorySchema.parse(input),
  });
}

export function updateCategory(
  organizationId: string,
  categoryId: string,
  input: Partial<CreateCategoryInput> & { isActive?: boolean },
): Promise<CategoryRecord> {
  return request(`/organizations/${organizationId}/categories/${categoryId}`, {
    method: 'PATCH',
    body: updateCategorySchema.parse(input),
  });
}

export async function deleteCategory(
  organizationId: string,
  categoryId: string,
): Promise<void> {
  await request(`/organizations/${organizationId}/categories/${categoryId}`, {
    method: 'DELETE',
  });
}

/** A key of the public API, as the list returns it: never its secret. */
export interface ApiKeyRecord {
  createdAt: string;
  createdBy: { username: string };
  expiresAt: string | null;
  id: string;
  lastUsedAt: string | null;
  name: string;
  /** Public part of the key, `hdl_live_<prefix>.…`: enough to recognise it. */
  prefix: string;
  rateLimitPerMinute: number;
  revokedAt: string | null;
  scopes: ApiScope[];
}

/**
 * The answer to creating a key: the only time `secret` travels. Whoever
 * receives it shows it once and lets it go — no state that outlives the
 * dialog, no storage, no URL, no log.
 */
export interface CreatedApiKey {
  createdAt: string;
  expiresAt: string | null;
  id: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  secret: string;
}

/** Every key of the organization, revoked ones included. ORG_ADMIN only. */
export function listApiKeys(organizationId: string): Promise<ApiKeyRecord[]> {
  return request(`/organizations/${organizationId}/api-keys`);
}

export function createApiKey(
  organizationId: string,
  input: CreateApiKeyInput,
): Promise<CreatedApiKey> {
  return request(`/organizations/${organizationId}/api-keys`, {
    method: 'POST',
    body: createApiKeySchema.parse(input),
  });
}

/** Revoking is final: the row stays, marked, and the key stops working. */
export async function revokeApiKey(
  organizationId: string,
  id: string,
): Promise<void> {
  await request(`/organizations/${organizationId}/api-keys/${id}`, {
    method: 'DELETE',
  });
}
