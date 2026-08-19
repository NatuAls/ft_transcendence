import { z } from 'zod';

/** Shared primitives and pagination envelope. */

export const uuidSchema = z.uuid({ version: 'v7' }).or(z.uuid());

/**
 * Password policy. Deliberately explicit so the same message keys can be
 * shown by the frontend and returned by the backend.
 */
export const passwordSchema = z
  .string()
  .min(10, { message: 'errors.password.tooShort' })
  .max(128, { message: 'errors.password.tooLong' })
  .regex(/[a-z]/, { message: 'errors.password.needsLowercase' })
  .regex(/[A-Z]/, { message: 'errors.password.needsUppercase' })
  .regex(/[0-9]/, { message: 'errors.password.needsDigit' })
  .regex(/[^A-Za-z0-9]/, { message: 'errors.password.needsSymbol' });

/** Trim and lowercase BEFORE validating: users paste emails with stray spaces. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'errors.email.invalid' }).max(254));

export const usernameSchema = z
  .string()
  .trim()
  .min(3, { message: 'errors.username.tooShort' })
  .max(32, { message: 'errors.username.tooLong' })
  .regex(/^[a-zA-Z0-9_-]+$/, { message: 'errors.username.invalidChars' })
  .transform((value) => value.toLowerCase());

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'errors.slug.invalid' });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  take: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(512).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PageMeta {
  total: number;
  page: number;
  take: number;
  pages: number;
  nextCursor?: string | null;
  tookMs?: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

/** Uniform error envelope produced by the global error-handling middleware. */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  messageKey: string;
  message: string;
  details?: Array<{ path: string; code: string; messageKey: string }>;
  requestId: string;
  timestamp: string;
  path: string;
}
