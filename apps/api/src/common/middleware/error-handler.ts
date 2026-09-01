import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody } from 'contracts';
import { DomainError } from '../errors/domain-error.ts';
import { validationError } from './validate.ts';
import { createLogger } from '../logger.ts';

const logger = createLogger('exception');

interface PrismaLikeError {
  code?: string;
  meta?: { target?: string[] };
}

/** The bits of an error the framework layers hand us. */
interface FramedError {
  name?: string;
  type?: string;
  code?: string;
}

type ErrorShape = Pick<
  ApiErrorBody,
  'statusCode' | 'code' | 'messageKey' | 'message'
>;

/**
 * Failures raised by the layers that run BEFORE our own handlers: the
 * body-parser inside `express.json()` and multer's upload guard. They already
 * know the right HTTP status but they are not `DomainError`s, so they used to
 * fall through to the generic 500 - a 2 MB body answered `500 INTERNAL_ERROR`
 * instead of `413`, malformed JSON answered `500` instead of `400`, and an
 * oversized upload answered `500` instead of `413`.
 */
function fromFramework(error: FramedError): ErrorShape | null {
  if (error.type === 'entity.too.large') {
    return {
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
      messageKey: 'errors.common.payloadTooLarge',
      message: 'Request body exceeds the size limit.',
    };
  }
  if (
    error.type === 'entity.parse.failed' ||
    error.type === 'entity.verify.failed' ||
    error.type === 'encoding.unsupported' ||
    error.type === 'charset.unsupported' ||
    error.type === 'request.aborted'
  ) {
    return {
      statusCode: 400,
      code: 'MALFORMED_BODY',
      messageKey: 'errors.common.malformedBody',
      message: 'Request body could not be parsed.',
    };
  }
  if (error.name === 'MulterError') {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return {
        statusCode: 413,
        code: 'FILE_TOO_LARGE',
        messageKey: 'errors.file.tooLarge',
        message: 'Uploaded file exceeds the size limit.',
      };
    }
    // Wrong field name, too many files, too many parts: all caller mistakes.
    return {
      statusCode: 400,
      code: 'UPLOAD_REJECTED',
      messageKey: 'errors.file.uploadRejected',
      message:
        'The upload was rejected. Send a single file in the "file" field.',
    };
  }
  return null;
}

function toBody(
  exception: unknown,
  requestId: string,
  path: string,
): ApiErrorBody {
  const base = { requestId, timestamp: new Date().toISOString(), path };

  // A Zod failure that did not come through the `validate()` middleware: the
  // public API parses `createTicketSchema` by hand because it has to inject the
  // organization from the API key first, so an invalid payload used to escape
  // as a 500 instead of the documented 400. Normalising it here means no route
  // can produce a different shape by parsing a contract on its own.
  if (exception instanceof ZodError) {
    exception = validationError(exception);
  }

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

  const framework = fromFramework(exception as FramedError);
  if (framework) return { ...base, ...framework };

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
    // What Postgres raises through Prisma when a path parameter that should be
    // a UUID is not one ("invalid input syntax for type uuid"). That is a
    // malformed request, not a server fault: GET /tickets/pepito used to
    // answer 500 and log a stack trace for every bot that walks the API.
    //
    // Both codes are mapped on purpose. Prisma 7 with the `pg` driver adapter
    // surfaces it as P2007 (data validation error); P2023 (inconsistent column
    // data) is the code the query engine used, and still the one to expect if
    // the adapter is ever swapped.
    if (prisma.code === 'P2007' || prisma.code === 'P2023') {
      return {
        ...base,
        statusCode: 400,
        code: 'INVALID_IDENTIFIER',
        messageKey: 'errors.common.invalidIdentifier',
        message: 'A path or query identifier is not a valid UUID.',
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
