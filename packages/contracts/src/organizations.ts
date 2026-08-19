import { z } from 'zod';
import { slugSchema, uuidSchema } from './common.ts';
import { orgRoleSchema } from './enums.ts';

/** Organization & membership contracts. */

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, { message: 'errors.org.nameTooShort' }).max(80),
  slug: slugSchema.optional(),
  description: z.string().trim().max(500).optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).optional(),
});

export const inviteMemberSchema = z.object({
  identifier: z.string().trim().min(3).max(254), // username or email
  role: orgRoleSchema.default('MEMBER'),
});

export const updateMemberRoleSchema = z.object({ role: orgRoleSchema });

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(240).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { message: 'errors.color.invalid' })
    .default('#0d6c90'),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export { uuidSchema };
