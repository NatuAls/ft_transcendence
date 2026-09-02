import type { NextFunction, Request, Response } from 'express';
import { notFound } from '../errors/domain-error.ts';

/**
 * Catch-all for URLs no router matched.
 *
 * Without it Express falls back to its own finalhandler, which answers with an
 * HTML page (`<pre>Cannot GET /api/v1/pepito</pre>`). Two problems with that:
 * the frontend parses every failure as `ApiErrorBody` and would choke on HTML
 * instead of showing a translated message, and the body echoes the method and
 * path back to the caller, which is exactly the kind of noise the rest of the
 * error handling is careful not to produce.
 *
 * Mounted after every router and immediately before `errorHandler`, so a real
 * error still reaches the error handler first.
 */
export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(
    notFound(
      'ROUTE_NOT_FOUND',
      'errors.common.routeNotFound',
      `No route matches ${req.method} on this API.`,
    ),
  );
}
