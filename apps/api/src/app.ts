// Integración trasladada desde /home/elerazo-/trascenda_felipe_comu/apps/api/src/app.ts.
// Centraliza middleware, health checks, rutas versionadas y errores HTTP.
import express, { type Express } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { loadConfiguration } from './config/env.ts';
import { GLOBAL_PREFIX } from './routing.ts';
import { requestContext } from './common/middleware/request-context.ts';
import { notFoundHandler } from './common/middleware/not-found.ts';
import { errorHandler } from './common/middleware/error-handler.ts';
import { healthRouter, versionRouter } from './modules/health/health.router.ts';
import { authRouter } from './modules/auth/auth.router.ts';
import { usersRouter } from './modules/users/users.router.ts';
import { organizationsRouter } from './modules/organizations/organizations.router.ts';
import { ticketsRouter } from './modules/tickets/tickets.router.ts';
import { socialRouter } from './modules/friendship/social.router.ts';
import { notificationsRouter } from './modules/notifications/notifications.router.ts';
import { filesRouter } from './modules/files/files.router.ts';
import { gdprRouter } from './modules/gdpr/gdpr.router.ts';
import { publicApiRouter } from './modules/public-api/public-api.router.ts';
import { adminRouter } from './modules/admin/admin.router.ts';

export function createApp(): Express {
  const config = loadConfiguration();
  const app = express();

  // Nginx (or, in dev, nothing) terminates TLS; trust X-Forwarded-* so req.ip
  // is the real client when the API sits behind a proxy.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
  app.use(compression());
  // Before the body parsers on purpose: a request that dies inside
  // express.json() (malformed JSON, body over the 1 MB limit) still needs a
  // correlation id, otherwise its error response comes back with
  // `"requestId": "unknown"` and cannot be matched against any log line.
  app.use(requestContext);
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));
  app.use(
    cors({
      // The allowlist comes from deployment configuration so credentials are
      // accepted only by known frontend origins in every environment.
      origin: config.CORS_ORIGINS,
      credentials: true,
      exposedHeaders: [
        'X-Request-Id',
        'RateLimit-Limit',
        'RateLimit-Remaining',
        'RateLimit-Reset',
        'Retry-After',
      ],
    }),
  );

  // Compatibilidad añadida durante la integración en
  // /home/elerazo-/ft_transcendence: algunos navegadores y comprobaciones
  // locales consultan GET /. La API funcional vive bajo /api, pero devolvemos
  // información básica aquí para evitar un 404 engañoso en los logs.
  app.get('/', (_req, res) => {
    res.json({
      name: 'HelpDesk Lite API',
      status: 'ok',
      health: '/api/health',
      version: '/api/version',
    });
  });

  // Probes live outside the versioned prefix: Docker's HEALTHCHECK and anyone
  // checking liveness should never have to know which API version is deployed.
  app.use('/api/health', healthRouter);
  app.use('/api/version', versionRouter);
  //app.use('/login', authRouter);

  const v1 = express.Router();
  v1.use('/auth', authRouter);
  v1.use('/users', usersRouter);
  v1.use('/organizations', organizationsRouter);
  v1.use('/tickets', ticketsRouter);
  // No prefix: mirrors the reference's routes (GET /friends, /conversations, ...).
  v1.use(socialRouter);
  v1.use('/notifications', notificationsRouter);
  // No prefix: mirrors the reference's routes (GET /attachments/:id, POST /tickets/:id/attachments, ...).
  v1.use(filesRouter);
  v1.use('/gdpr', gdprRouter);
  v1.use('/public', publicApiRouter);
  v1.use('/admin', adminRouter);
  app.use(GLOBAL_PREFIX, v1);

  // After every router: turns an unmatched URL into the same JSON error
  // envelope as everything else, instead of Express's default HTML page.
  app.use(notFoundHandler);

  // Must be mounted LAST: the only place an error becomes an HTTP response.
  app.use(errorHandler);

  return app;
}
