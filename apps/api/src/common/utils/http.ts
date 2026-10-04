import type { Request } from 'express';

/**
 * Express 5 types every route param as `string | string[]` (to accommodate
 * repeating patterns like `/:id+`), even though a plain named param like
 * `:id` is always a single string at runtime. Route handlers use this to say
 * "yes, I know - take the single value" without an inline cast at every call
 * site.
 */
export function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0]! : value;
}

/**
 * Public origin of the request, as the browser saw it. TLS terminates in the
 * proxy, so the scheme and host come from the forwarded headers; e-mails build
 * their links from this so they point at the site the person is actually on
 * (production, staging or a laptop).
 */
export function originOf(req: Request): string {
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https';
  const host =
    (req.headers['x-forwarded-host'] as string | undefined) ??
    req.headers.host ??
    'localhost';
  return `${proto}://${host}`;
}
