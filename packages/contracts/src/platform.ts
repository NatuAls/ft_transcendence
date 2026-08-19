import { z } from 'zod';
import { apiScopeSchema, gdprRequestTypeSchema } from './enums.ts';
import { paginationQuerySchema, uuidSchema } from './common.ts';

/** API keys, GDPR and admin contracts. */

export const createApiKeySchema = z.object({
  name: z.string().trim().min(3).max(60),
  scopes: z
    .array(apiScopeSchema)
    .min(1, { message: 'errors.apiKey.scopesRequired' }),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
});

export const gdprRequestSchema = z.object({ type: gdprRequestTypeSchema });

export const gdprConfirmSchema = z.object({
  token: z.string().min(20).max(256),
  /** Deleting requires typing your own username back. Second confirmation factor. */
  confirmUsername: z.string().trim().min(3).max(32).optional(),
});

export const listAuditQuerySchema = paginationQuerySchema.extend({
  entity: z.string().trim().max(40).optional(),
  entityId: uuidSchema.optional(),
  actorId: uuidSchema.optional(),
  action: z.string().trim().max(40).optional(),
  from: z.iso.datetime({ offset: true }).or(z.iso.date()).optional(),
  to: z.iso.datetime({ offset: true }).or(z.iso.date()).optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type GdprConfirmInput = z.infer<typeof gdprConfirmSchema>;
