import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';
import { loadConfiguration } from '../config/env.ts';
import { createLogger } from '../common/logger.ts';

const logger = createLogger('prisma');

const adapter = new PrismaPg({ connectionString: loadConfiguration().DATABASE_URL });

/**
 * Single Prisma connection for the process. Slow queries are logged so the
 * team can spot a missing index before an evaluator does.
 */
export const prisma = new PrismaClient({
  adapter,
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
});

prisma.$on('warn', (event) => logger.warn(event.message));
prisma.$on('error', (event) => logger.error(event.message));
prisma.$on('query', (event) => {
  if (event.duration > 200) {
    logger.warn(`slow query ${event.duration}ms: ${event.query.slice(0, 200)}`);
  }
});

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('database connected');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

/** Used by the readiness probe. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
