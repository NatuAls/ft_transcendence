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
 * Public origin of the site, for the links that travel by e-mail (confirm the
 * account, reset the password, claim a reserved role).
 *
 * `APP_PUBLIC_ORIGIN` wins when it is set, because only the deployment knows
 * where the web really answers. Without it the origin is deduced from the
 * request, which is right behind the proxy - the web and the API share the
 * host there - but wrong in development: the browser is on 5173 and Vite
 * forwards /api to 5000 with `changeOrigin`, so the API sees
 * `Host: localhost:5000` and the link pointed at the API's port, over https,
 * with nothing serving it.
 */
export function originOf(req: Request): string {
  // Se lee del entorno y no de `loadConfiguration()` a propósito: esto es un
  // ayudante de cabeceras que usan rutas de todo tipo, y hacerlo depender de
  // que TODA la configuración parsee lo convertía en algo que revienta cuando
  // falta cualquier otra variable. Quien valida el valor es el esquema de
  // config/env.ts, en el arranque: un origen mal escrito no despliega.
  const configured = process.env['APP_PUBLIC_ORIGIN']?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https';
  const host =
    (req.headers['x-forwarded-host'] as string | undefined) ??
    req.headers.host ??
    'localhost';
  return `${proto}://${host}`;
}
