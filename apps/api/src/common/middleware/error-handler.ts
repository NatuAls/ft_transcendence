import type { NextFunction, Request, Response } from 'express';
import type { ApiErrorBody } from 'contracts';
import { DomainError } from '../errors/domain-error.ts';
import { createLogger } from '../logger.ts';

const logger = createLogger('exception');

interface PrismaLikeError {
  code?: string;
  meta?: { target?: string[] };
}

function toBody(
  exception: unknown,
  requestId: string,
  path: string,
): ApiErrorBody {
  const base = { requestId, timestamp: new Date().toISOString(), path };

  if (exception instanceof DomainError) {
    return {
      ...base,
      statusCode: exception.status,
      code: exception.code,
      messageKey: exception.messageKey,
      message: exception.message,
      ...(exception.details ? { details: exception.details } : {}),
    };
  }

  // Prisma known errors are mapped so a unique-constraint clash never becomes a 500.
  const prisma = exception as PrismaLikeError;
  if (typeof prisma?.code === 'string' && prisma.code.startsWith('P')) {
    if (prisma.code === 'P2002') {
      return {
        ...base,
        statusCode: 409,
        code: 'UNIQUE_CONSTRAINT',
        messageKey: 'errors.common.duplicate',
        message: 'A record with those values already exists.',
      };
    }
    if (prisma.code === 'P2025') {
      return {
        ...base,
        statusCode: 404,
        code: 'NOT_FOUND',
        messageKey: 'errors.common.notFound',
        message: 'Resource not found.',
      };
    }
    if (prisma.code === 'P2003') {
      return {
        ...base,
        statusCode: 409,
        code: 'FOREIGN_KEY_CONSTRAINT',
        messageKey: 'errors.common.stillReferenced',
        message: 'That record is still referenced by other data.',
      };
    }
  }

  return {
    ...base,
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    messageKey: 'errors.common.internal',
    message: 'Unexpected server error.',
  };
}

/**
 * The only place an error becomes an HTTP response. Guarantees a single
 * shape and guarantees nothing internal leaks: no stack traces, no SQL, no
 * file paths, no dependency versions. Must be mounted LAST.
 */
export function errorHandler(
  exception: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express only treats a 4-arg function as error middleware
  _next: NextFunction,
): void {
  const requestId = req.requestId ?? 'unknown';
  const body = toBody(exception, requestId, req.originalUrl ?? req.url ?? '');

  if (body.statusCode >= 500) {
    logger.error(
      `[${requestId}] ${req.method} ${body.path} -> ${body.statusCode} ${body.code}`,
      exception,
    );
  } else if (body.statusCode !== 404) {
    logger.warn(
      `[${requestId}] ${req.method} ${body.path} -> ${body.statusCode} ${body.code}`,
    );
  }

  if (!res.headersSent) {
    res.status(body.statusCode).json(body);
  }
}
