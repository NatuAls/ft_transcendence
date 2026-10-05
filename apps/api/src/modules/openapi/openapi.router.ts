/**
 * ==============================================================================
 *  OpenAPI · routes
 *
 *      GET /api/v1/openapi.json   the document (for Swagger UI, Postman, code
 *                                 generators or a client's CI)
 *      GET /api/v1/docs           the browsable reference, with Try it out
 *      GET /api/v1/docs/init.js   our bootstrap (kept out of the HTML so the
 *                                 page survives `script-src 'self'`)
 *      GET /api/v1/docs/assets/*  Swagger UI itself, from swagger-ui-dist
 *
 *  The document is built once at boot: it is derived from the contracts, which
 *  do not change while the process is running, and rebuilding it per request
 *  would be pure waste on a page that is polled by browsers.
 * ==============================================================================
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import express, { Router } from 'express';
import { buildDocument } from './document.ts';
import { page, initScript } from './ui.ts';
import { requireDocsAccess, docsAccessMode } from './docs-access.ts';
import { GLOBAL_PREFIX } from '../../routing.ts';
import { createLogger } from '../../common/logger.ts';

const DOCS_PATH = `${GLOBAL_PREFIX}/docs`;
const SPEC_PATH = `${GLOBAL_PREFIX}/openapi.json`;

/**
 * Extra servers for the Authorize/Try it out selector. They are configuration,
 * not code: a deployment that does not set them simply offers the relative one,
 * which is what makes the page work on any host without being told its name.
 */
function extraServers(): Array<{ url: string; description: string }> {
  const raw = process.env['OPENAPI_SERVERS'];
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [url, ...rest] = entry.split('|');
      return {
        url: (url ?? '').trim(),
        description: rest.join('|').trim() || 'Configured server',
      };
    })
    .filter((server) => server.url.length > 0);
}

const document = buildDocument({ servers: extraServers() });

/** Directory shipped by swagger-ui-dist, resolved from node_modules. */
function swaggerUiAssets(): string {
  const require_ = createRequire(import.meta.url);
  return path.dirname(require_.resolve('swagger-ui-dist/package.json'));
}

export const openapiRouter: Router = Router();

// Everything under here is gated. The guard answers 404 when the caller is
// not entitled, so the documentation does not even announce itself.
openapiRouter.use(['/openapi.json', '/docs'], requireDocsAccess());

createLogger('openapi').info(
  `documentation mounted at ${DOCS_PATH} (access: ${docsAccessMode()})`,
);

// The document itself. Cached for a minute: it only changes with a deployment,
// and Swagger UI asks for it on every reload.
openapiRouter.get('/openapi.json', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json(document);
});

openapiRouter.get('/docs/init.js', (_req, res) => {
  res.type('application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.send(initScript(SPEC_PATH));
});

openapiRouter.use(
  '/docs/assets',
  express.static(swaggerUiAssets(), {
    index: false,
    immutable: true,
    maxAge: '7d',
    // The package also ships its own index.html and swagger-initializer.js,
    // which bootstrap with an inline script. Ours replaces them; serving both
    // would only offer a version of the page that the CSP blocks.
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  }),
);

openapiRouter.get('/docs', (_req, res) => {
  res.type('html');
  res.send(page(DOCS_PATH, SPEC_PATH));
});
