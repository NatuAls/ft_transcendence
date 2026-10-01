/**
 * The document is generated, not maintained by hand - but the *list of routes*
 * in it is written by a person, so it can fall behind the code. This test is
 * what keeps it honest: it walks the real routers and compares them with the
 * document, in both directions.
 *
 * If it fails after adding a route, the fix is one entry in
 * `src/modules/openapi/paths/`, not an exception here.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// The app validates its configuration at import time; these are throwaway
// values, only good enough to let it build.
process.env['NODE_ENV'] ??= 'test';
process.env['DATABASE_URL'] ??=
  'postgresql://u:p@localhost:5432/d?schema=public';
process.env['JWT_ACCESS_SECRET'] ??=
  'test_access_secret_not_a_real_secret_0123456789';
process.env['JWT_REFRESH_SECRET'] ??=
  'test_refresh_secret_not_a_real_secret_0123456789';
process.env['PASSWORD_PEPPER'] ??= 'test_pepper_not_a_real_secret_0123456789';
process.env['CORS_ORIGINS'] ??= 'http://localhost:5173';

/** The document is walked dynamically; this is as much shape as it needs. */
type Loose = Record<string, unknown>;
type Operation = {
  operationId?: string;
  tags?: string[];
  summary?: string;
  description?: string;
  security?: unknown;
  responses?: Record<string, unknown>;
};

type Layer = {
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: Layer[] };
};

/**
 * Express 5 no longer exposes the regexp of a mount point (it keeps opaque
 * matchers), so a router prefix cannot be read back from the app. This table
 * mirrors the `v1.use(...)` calls of `src/app.ts`; the count check further
 * down is what catches a module mounted there and forgotten here.
 */
const MOUNTS: Array<[string, string, string]> = [
  ['/api/v1/auth', '../../src/modules/auth/auth.router.ts', 'authRouter'],
  ['/api/v1/users', '../../src/modules/users/users.router.ts', 'usersRouter'],
  [
    '/api/v1/organizations',
    '../../src/modules/organizations/organizations.router.ts',
    'organizationsRouter',
  ],
  [
    '/api/v1/organizations/:organizationId/api-keys',
    '../../src/modules/public-api/public-api.router.ts',
    'apiKeysRouter',
  ],
  [
    '/api/v1/tickets',
    '../../src/modules/tickets/tickets.router.ts',
    'ticketsRouter',
  ],
  ['/api/v1', '../../src/modules/friendship/social.router.ts', 'socialRouter'],
  [
    '/api/v1/notifications',
    '../../src/modules/notifications/notifications.router.ts',
    'notificationsRouter',
  ],
  ['/api/v1', '../../src/modules/files/files.router.ts', 'filesRouter'],
  ['/api/v1/gdpr', '../../src/modules/gdpr/gdpr.router.ts', 'gdprRouter'],
  [
    '/api/v1/public',
    '../../src/modules/public-api/public-api.router.ts',
    'publicApiRouter',
  ],
  ['/api/v1/admin', '../../src/modules/admin/admin.router.ts', 'adminRouter'],
  ['/api/health', '../../src/modules/health/health.router.ts', 'healthRouter'],
  [
    '/api/version',
    '../../src/modules/health/health.router.ts',
    'versionRouter',
  ],
];

/** `METHOD /path` for every route a router declares, with its mount prefix. */
function routesOf(router: { stack: Layer[] }, prefix: string): string[] {
  const found: string[] = [];
  for (const layer of router.stack) {
    if (!layer.route) continue;
    const path = (prefix + layer.route.path).replace(/\/$/, '') || '/';
    for (const method of Object.keys(layer.route.methods)) {
      if (method === '_all') continue;
      found.push(method.toUpperCase() + ' ' + path);
    }
  }
  return found;
}

/** Counts routes anywhere in the app, prefix or not: the safety net. */
function countRoutes(stack: Layer[]): number {
  let total = 0;
  for (const layer of stack) {
    if (layer.route)
      total += Object.keys(layer.route.methods).filter(
        (method) => method !== '_all',
      ).length;
    else if (layer.handle?.stack) total += countRoutes(layer.handle.stack);
  }
  return total;
}

/**
 * Express writes `:id`; OpenAPI writes `{id}`. And a path template is keyed by
 * POSITION, not by parameter name: `/users/{id}` and `/users/{username}` are
 * the same path for OpenAPI (which is why the document describes them under
 * one entry). Both sides are therefore compared with the names blanked out.
 */
function normalise(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}').replace(/\{[^}]+\}/g, '{}');
}

/** Deliberately undocumented; each would be worse published than absent. */
const UNDOCUMENTED = new Set([
  'GET /api/metrics', // Prometheus only, internal network, behind a token
  'GET /', // courtesy answer so a browser at the root is not a 404 in the logs
  'GET /api/v1/openapi.json',
  'GET /api/v1/docs',
  'GET /api/v1/docs/init.js',
]);

describe('OpenAPI document', () => {
  let doc: Loose;
  let documented: Set<string>;
  let real: Set<string>;
  let appRouteCount = 0;

  before(async () => {
    const { buildDocument } =
      await import('../../src/modules/openapi/document.ts');
    const { createApp } = await import('../../src/app.ts');
    doc = buildDocument({ version: 'test' }) as Loose;

    documented = new Set<string>();
    for (const [path, item] of Object.entries(
      doc['paths'] as Record<string, Loose>,
    )) {
      for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
        if (!item[method]) continue;
        // Probe paths carry their own `servers`, so they are already absolute.
        const full = path.startsWith('/api/') ? path : '/api/v1' + path;
        documented.add(method.toUpperCase() + ' ' + normalise(full));
      }
    }

    const collected: string[] = [];
    for (const [prefix, module, exported] of MOUNTS) {
      const loaded = (await import(module)) as Record<
        string,
        { stack: Layer[] }
      >;
      collected.push(...routesOf(loaded[exported]!, prefix));
    }
    real = new Set(
      collected
        .filter((entry) => !UNDOCUMENTED.has(entry))
        .map((entry) => {
          const [method, path] = entry.split(' ');
          return method + ' ' + normalise(path ?? '');
        }),
    );

    const app = createApp() as unknown as { router: { stack: Layer[] } };
    appRouteCount = countRoutes(app.router.stack);
  });

  it('documents every route the application answers', () => {
    const missing = [...real].filter((route) => !documented.has(route)).sort();
    assert.deepStrictEqual(
      missing,
      [],
      'Routes without documentation (add them to src/modules/openapi/paths/):\n' +
        missing.join('\n'),
    );
  });

  it('documents no route that does not exist', () => {
    const ghosts = [...documented].filter((route) => !real.has(route)).sort();
    assert.deepStrictEqual(
      ghosts,
      [],
      'Documented routes the application does not answer:\n' +
        ghosts.join('\n'),
    );
  });

  it('sees every route the application mounts, not only the ones in its table', () => {
    const accounted = real.size + UNDOCUMENTED.size;
    assert.strictEqual(
      appRouteCount,
      accounted,
      'The app answers ' +
        appRouteCount +
        ' routes and this test accounts for ' +
        accounted +
        '. A router was probably mounted in src/app.ts without being added to MOUNTS.',
    );
  });

  it('gives every operation an id, a tag, a summary and declared security', () => {
    const broken: string[] = [];
    for (const [path, item] of Object.entries(
      doc['paths'] as Record<string, Loose>,
    )) {
      for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
        const operation = item[method] as Operation | undefined;
        if (!operation) continue;
        const where = method.toUpperCase() + ' ' + path;
        if (!operation.operationId) broken.push(where + ': no operationId');
        if (!operation.tags?.length) broken.push(where + ': no tag');
        if (!operation.summary) broken.push(where + ': no summary');
        if (!operation.description) broken.push(where + ': no description');
        if (!Array.isArray(operation.security))
          broken.push(where + ': security not declared');
        if (!operation.responses || !Object.keys(operation.responses).length)
          broken.push(where + ': no responses');
      }
    }
    assert.deepStrictEqual(broken, [], broken.join('\n'));
  });

  it('has unique operation ids, which is what code generators rely on', () => {
    const ids: string[] = [];
    for (const item of Object.values(doc['paths'] as Record<string, Loose>))
      for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
        const operation = item[method] as Operation | undefined;
        if (operation?.operationId) ids.push(operation.operationId);
      }
    const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);
    assert.deepStrictEqual(duplicated, []);
  });

  it('resolves every $ref it uses', () => {
    const text = JSON.stringify(doc);
    const refs = new Set(
      [...text.matchAll(/"\$ref":"#\/components\/(\w+)\/([^"]+)"/g)].map(
        (match) => match[1] + '/' + match[2],
      ),
    );
    const missing = [...refs].filter((entry) => {
      const [section, name] = entry.split('/');
      const components = doc['components'] as Record<
        string,
        Record<string, unknown>
      >;
      return !components[section!]?.[name!];
    });
    assert.deepStrictEqual(
      missing,
      [],
      'Dangling references: ' + missing.join(', '),
    );
  });

  it('builds request bodies from the shared contracts, not from prose', async () => {
    const { createTicketSchema } = await import('contracts');
    const components = doc['components'] as Record<
      string,
      Record<string, Loose>
    >;
    const generated = components['schemas']!['CreateTicketInput'] as {
      properties: Record<string, { minLength?: number; maxLength?: number }>;
    };
    // The contract says a title is between 5 and 160 characters; if someone
    // relaxes the contract, this document says so too, with no extra work.
    assert.strictEqual(generated.properties.title.minLength, 5);
    assert.strictEqual(generated.properties.title.maxLength, 160);
    assert.strictEqual(
      createTicketSchema.safeParse({ title: 'abc' }).success,
      false,
    );
  });
});
