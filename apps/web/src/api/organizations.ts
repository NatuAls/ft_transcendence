import {
  createCategorySchema,
  createOrganizationSchema,
  updateCategorySchema,
  updateOrganizationSchema,
  type CreateCategoryInput,
  type CreateOrganizationInput,
  type OrgRole,
  type UpdateOrganizationInput,
} from 'contracts';
import { apiRequest, jsonBody } from '../core/api/client';

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
  return apiRequest('/organizations');
}

export function getOrganization(id: string): Promise<OrganizationRecord> {
  return apiRequest(`/organizations/${id}`);
}

export function createOrganization(
  input: CreateOrganizationInput,
): Promise<OrganizationRecord> {
  return apiRequest('/organizations', {
    method: 'POST',
    ...jsonBody(createOrganizationSchema.parse(input)),
  });
}

export function updateOrganization(
  id: string,
  input: UpdateOrganizationInput,
): Promise<OrganizationRecord> {
  return apiRequest(`/organizations/${id}`, {
    method: 'PATCH',
    ...jsonBody(updateOrganizationSchema.parse(input)),
  });
}

export async function deleteOrganization(id: string): Promise<void> {
  await apiRequest(`/organizations/${id}`, { method: 'DELETE' });
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
  return apiRequest(`/organizations/${id}/stats`);
}

export function listCategories(
  organizationId: string,
): Promise<CategoryRecord[]> {
  return apiRequest(`/organizations/${organizationId}/categories`);
}

export function createCategory(
  organizationId: string,
  input: CreateCategoryInput,
): Promise<CategoryRecord> {
  return apiRequest(`/organizations/${organizationId}/categories`, {
    method: 'POST',
    ...jsonBody(createCategorySchema.parse(input)),
  });
}

export function updateCategory(
  organizationId: string,
  categoryId: string,
  input: Partial<CreateCategoryInput> & { isActive?: boolean },
): Promise<CategoryRecord> {
  return apiRequest(
    `/organizations/${organizationId}/categories/${categoryId}`,
    { method: 'PATCH', ...jsonBody(updateCategorySchema.parse(input)) },
  );
}

export async function deleteCategory(
  organizationId: string,
  categoryId: string,
): Promise<void> {
  await apiRequest(
    `/organizations/${organizationId}/categories/${categoryId}`,
    { method: 'DELETE' },
  );
}
