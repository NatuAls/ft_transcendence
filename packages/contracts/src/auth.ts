import { z } from 'zod';
import { emailSchema, passwordSchema, usernameSchema } from './common.ts';
import { localeSchema } from './enums.ts';

/** Authentication contracts. */

export const registerSchema = z
  .object({
    email: emailSchema,
    username: usernameSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    acceptTerms: z.literal(true, { message: 'errors.terms.required' }),
    locale: localeSchema.default('EN'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'errors.password.mismatch',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: 'errors.password.required' }),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(256),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'errors.password.mismatch',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'errors.password.mismatch',
    path: ['confirmPassword'],
  })
  .refine((d) => d.password !== d.currentPassword, {
    message: 'errors.password.mustDiffer',
    path: ['password'],
  });

export const verifyEmailSchema = z.object({
  token: z.string().min(20).max(256),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
