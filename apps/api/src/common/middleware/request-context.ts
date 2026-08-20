import type { NextFunction, Request, Response } from 'express';
import { uuidv7 } from '../utils/uuid.ts';
import { createLogger } from '../logger.ts';

const logger = createLogger('http');

/**
 * Assigns a correlation id to every request, echoes it back in
 * `X-Request-Id` and logs one structured line per request. When a user
 * reports an error they can read the request id off the screen and we can
 * find the exact log line.
 */
export function requestContext(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers['x-request-id'];
  req.requestId =
    typeof incoming === 'string' && incoming.length <= 64 ? incoming : uuidv7();
  req.startedAt = Date.now();
  res.setHeader('X-Request-Id', req.requestId);

  res.on('finish', () => {
    const ms = Date.now() - (req.startedAt ?? Date.now());
    logger.info(
      `[${req.requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms` +
        (req.actor ? ` actor=${req.actor.username}` : ''),
    );
  });

  next();
}
