import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common.ts';
import { ticketPrioritySchema, ticketStatusSchema } from './enums.ts';

/** Ticket contracts. */

export const createTicketSchema = z.object({
  organizationId: uuidSchema,
  title: z
    .string()
    .trim()
    .min(5, { message: 'errors.ticket.titleTooShort' })
    .max(160, { message: 'errors.ticket.titleTooLong' }),
  description: z
    .string()
    .trim()
    .min(10, { message: 'errors.ticket.descriptionTooShort' })
    .max(5000, { message: 'errors.ticket.descriptionTooLong' }),
  priority: ticketPrioritySchema.default('MEDIUM'),
  categoryId: uuidSchema.optional(),
});

export const updateTicketSchema = z
  .object({
    title: z.string().trim().min(5).max(160).optional(),
    description: z.string().trim().min(10).max(5000).optional(),
    priority: ticketPrioritySchema.optional(),
    categoryId: uuidSchema.nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'errors.common.emptyPatch' });

export const changeStatusSchema = z
  .object({
    status: ticketStatusSchema,
    resolution: z.string().trim().min(20).max(2000).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.status !== 'RESOLVED' || (d.resolution?.length ?? 0) >= 20, {
    message: 'errors.ticket.resolutionRequired',
    path: ['resolution'],
  });

export const assignTicketSchema = z.object({
  assigneeId: uuidSchema.nullable(),
});

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, { message: 'errors.comment.empty' }).max(5000),
  isInternal: z.boolean().default(false),
});

export const updateCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

/** Advanced search - full-text + filters. */
const csvEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .transform((raw) =>
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.enum(values)).min(1))
    .optional();

export const searchTicketsQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).optional(),
  organizationId: uuidSchema.optional(),
  status: csvEnum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  priority: csvEnum(['LOW', 'MEDIUM', 'HIGH']),
  categoryId: uuidSchema.optional(),
  assignedToId: z.union([uuidSchema, z.literal('me'), z.literal('unassigned')]).optional(),
  createdById: z.union([uuidSchema, z.literal('me')]).optional(),
  hasAttachments: z.stringbool().optional(),
  createdFrom: z.iso.datetime({ offset: true }).or(z.iso.date()).optional(),
  createdTo: z.iso.datetime({ offset: true }).or(z.iso.date()).optional(),
  updatedFrom: z.iso.datetime({ offset: true }).or(z.iso.date()).optional(),
  updatedTo: z.iso.datetime({ offset: true }).or(z.iso.date()).optional(),
  sort: z
    .enum(['createdAt', 'updatedAt', 'priority', 'status', 'title', 'reference'])
    .default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type SearchTicketsQuery = z.infer<typeof searchTicketsQuerySchema>;
