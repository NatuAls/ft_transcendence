import { z } from 'zod';

/**
 * Environment validation. The process refuses to boot with a bad or missing
 * variable rather than failing at 3am on some request.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  PORT: z.coerce.number().int().default(3000),
  APP_VERSION: z.string().default('1.0.0'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'verbose'])
    .default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://redis:6379'),
  // Comma-separated origins keep CORS explicit while supporting local and
  // production deployments without embedding a domain in application code.
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://127.0.0.1:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  // Declared for parity with the reference app; currently unused - refresh
  // tokens are opaque random bytes, not JWTs (see modules/auth/token.ts).
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  PASSWORD_PEPPER: z
    .string()
    .min(16, 'PASSWORD_PEPPER must be at least 16 chars'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),

  SMTP_HOST: z.string().default('mailpit'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  MAIL_FROM: z.string().default('HelpDesk Lite <no-reply@helpdesk.local>'),

  UPLOAD_DIR: z.string().default('/var/lib/helpdesk/uploads'),
  UPLOAD_MAX_BYTES: z.coerce
    .number()
    .int()
    .default(10 * 1024 * 1024),
  UPLOAD_MAX_PER_TICKET: z.coerce.number().int().default(5),

  RATE_LIMIT_GLOBAL_PER_MIN: z.coerce.number().int().default(300),
  RATE_LIMIT_AUTH_PER_MIN: z.coerce.number().int().default(10),
  API_KEY_RATE_PER_MIN: z.coerce.number().int().default(60),
  API_KEY_RATE_PER_HOUR: z.coerce.number().int().default(1000),

  SEED_ON_BOOT: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | undefined;

export function loadConfiguration(): AppConfig {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
