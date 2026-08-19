import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common.ts';
import { globalRoleSchema, localeSchema, orgRoleSchema } from './enums.ts';

/** User & profile contracts. */

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  displayName: z.string().trim().min(1).max(80).optional(),
  bio: z.string().trim().max(500).optional(),
  jobTitle: z.string().trim().max(80).optional(),
});

export const updatePreferencesSchema = z.object({
  locale: localeSchema.optional(),
  timezone: z.string().max(64).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  notifyOnTicketUpdate: z.boolean().optional(),
  notifyOnComment: z.boolean().optional(),
  notifyOnMention: z.boolean().optional(),
  notifyOnMessage: z.boolean().optional(),
});

export const adminUpdateUserSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  isActive: z.boolean().optional(),
});

export const setGlobalRoleSchema = z.object({ globalRole: globalRoleSchema });
export const setUserStatusSchema = z.object({ isActive: z.boolean() });

export const listUsersQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  globalRole: globalRoleSchema.optional(),
  isActive: z.stringbool().optional(),
  sort: z.enum(['createdAt', 'username', 'email', 'lastLoginAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  jobTitle: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface SessionUser extends PublicUser {
  email: string;
  globalRole: z.infer<typeof globalRoleSchema>;
  locale: z.infer<typeof localeSchema>;
  timezone: string;
  emailVerified: boolean;
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    role: z.infer<typeof orgRoleSchema>;
  }>;
  permissions: string[];
}

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export { uuidSchema };
