import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import { badRequest, type DomainError } from '../errors/domain-error.ts';

type Target = 'body' | 'query' | 'params';

/**
 * Turns a Zod failure into the project's error envelope.
 *
 * Exported because this middleware is not the only place a contract gets
 * parsed: a couple of routes (the public API, which has to inject the
 * organization from the API key before validating) call `schema.parse()`
 * directly. Sharing this function is what keeps those routes answering the
 * same `400 VALIDATION_FAILED` shape - and the global error handler falls back
 * to it, so a stray `.parse()` can never surface as a 500 again.
 */
export function validationError(error: ZodError): DomainError {
  return badRequest(
    'VALIDATION_FAILED',
    'errors.common.validationFailed',
    'Request payload failed validation.',
    error.issues.map((issue) => ({
      path: issue.path.join('.') || '(root)',
      code: issue.code,
      // Contracts put i18n keys in `message`; anything else is a plain description.
      messageKey: issue.message.startsWith('errors.')
        ? issue.message
        : 'errors.field.invalid',
    })),
  );
}

/**
 * Runs the SAME schema the browser used (packages/contracts) on the server.
 * This is how "validated in both the frontend and backend" is satisfied
 * without the two definitions being able to drift apart.
 */
export function validate<T>(
  schema: ZodType<T>,
  target: Target = 'body',
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[target]);
      // req.query is a getter in Express 5 (recomputed from the URL on every
      // access, so mutating the object it returns is silently discarded).
      // Shadowing it with an own property on this request instance is the
      // only way to make the parsed/coerced/defaulted value stick.
      Object.defineProperty(req, target, {
        value: parsed,
        writable: true,
        configurable: true,
        enumerable: true,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) throw validationError(error);
      throw error;
    }
  };
}
