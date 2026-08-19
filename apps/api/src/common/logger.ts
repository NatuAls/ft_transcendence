import { loadConfiguration } from '../config/env.ts';

const LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'verbose'] as const;
type Level = (typeof LEVELS)[number];

function enabled(level: Level): boolean {
  const configured = loadConfiguration().LOG_LEVEL;
  return LEVELS.indexOf(level) <= LEVELS.indexOf(configured);
}

function line(
  level: Level,
  scope: string,
  message: string,
  error?: unknown,
): void {
  if (!enabled(level)) return;
  const prefix = `[${new Date().toISOString()}] ${level.toUpperCase()} [${scope}]`;
  if (error instanceof Error) {
    console.error(prefix, message, error.stack ?? error.message);
  } else if (error !== undefined) {
    console.error(prefix, message, error);
  } else {
    (level === 'error' || level === 'fatal' ? console.error : console.log)(
      prefix,
      message,
    );
  }
}

export function createLogger(scope: string) {
  return {
    fatal: (message: string, error?: unknown) =>
      line('fatal', scope, message, error),
    error: (message: string, error?: unknown) =>
      line('error', scope, message, error),
    warn: (message: string, error?: unknown) =>
      line('warn', scope, message, error),
    info: (message: string) => line('info', scope, message),
    debug: (message: string) => line('debug', scope, message),
  };
}
