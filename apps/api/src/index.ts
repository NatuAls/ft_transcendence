// Integración trasladada desde /home/elerazo-/trascenda_felipe_comu/apps/api/src/index.ts.
// Este bootstrap conecta la base de datos, Redis, HTTP, Socket.IO y los jobs
// de mantenimiento antes de publicar la API.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { loadConfiguration } from './config/env.ts';
import { createLogger } from './common/logger.ts';
import { connectDatabase } from './database/prisma.ts';
import { connectRedis } from './database/redis.ts';
import { createApp } from './app.ts';
import { startMaintenanceJobs } from './modules/tickets/maintenance.ts';
import { createSocketServer } from './modules/realtime/socket-server.ts';
import { attachEventBridge } from './modules/realtime/event-bridge.ts';
import { registerNotificationListeners } from './modules/notifications/notifications.service.ts';

const logger = createLogger('bootstrap');

async function bootstrap(): Promise<void> {
  const config = loadConfiguration();

  // Fail fast if the upload volume is not writable, rather than at first upload.
  for (const dir of ['avatars', 'attachments', 'gdpr']) {
    mkdirSync(join(config.UPLOAD_DIR, dir), { recursive: true });
  }

  await connectDatabase();
  await connectRedis();

  const app = createApp();
  const server = createServer(app);

  const realtime = createSocketServer(server);
  attachEventBridge(realtime);
  registerNotificationListeners();
  startMaintenanceJobs();

  server.listen(config.PORT, '0.0.0.0', () => {
    logger.info(`API listening on 0.0.0.0:${config.PORT} (${config.NODE_ENV})`);
  });
}

void bootstrap();
