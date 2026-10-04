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
): Promise<CategoryRecord[]> {
  return request(`/organizations/${organizationId}/categories`);
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
