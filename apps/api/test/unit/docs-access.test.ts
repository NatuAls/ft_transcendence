/**
 * The documentation guard is the only thing between a map of 105 routes and
 * the internet, so its decisions are worth pinning down: who gets in, who
 * does not, and - just as important - that a refusal looks like a 404 and not
 * like a locked door.
 *
 * `DOCS_ACCESS` is read through the configuration, which is parsed once per
 * process. The middleware is therefore exercised in this process with the
 * production default (`gateway`), and the mode table is checked in child
 * processes, one environment each.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';

const GATEWAY_TOKEN = 'docs_gateway_token_for_tests_0123456789';

// Throwaway values, only good enough to let the configuration parse.
const BASE_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/d?schema=public',
  JWT_ACCESS_SECRET: 'test_access_secret_not_a_real_secret_0123456789',
  JWT_REFRESH_SECRET: 'test_refresh_secret_not_a_real_secret_0123456789',
  PASSWORD_PEPPER: 'test_pepper_not_a_real_secret_0123456789',
  CORS_ORIGINS: 'http://localhost:5173',
  LOG_LEVEL: 'error',
};
for (const [key, value] of Object.entries(BASE_ENV)) process.env[key] ??= value;
process.env['DOCS_ACCESS'] ??= 'gateway';
process.env['DOCS_GATEWAY_TOKEN'] ??= GATEWAY_TOKEN;

const { GATEWAY_HEADER, docsAccessMode, requireDocsAccess } =
  await import('../../src/modules/openapi/docs-access.ts');
const { signAccessToken } = await import('../../src/common/jwt.ts');

const MODULE = fileURLToPath(
  new URL('../../src/modules/openapi/docs-access.ts', import.meta.url),
);

/** The effective mode for one environment, resolved in its own process. */
function modeWith(env: Record<string, string | undefined>): string {
  const output = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { docsAccessMode } from ${JSON.stringify(MODULE)};
       console.log('MODE=' + docsAccessMode());`,
    ],
    {
      env: { ...BASE_ENV, ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const line = output.split('\n').find((l) => l.startsWith('MODE='));
  assert.ok(line, `the child process printed no mode:\n${output}`);
  return line.slice('MODE='.length).trim();
}

function token(role: 'GLOBAL_ADMIN' | 'USER'): string {
  return signAccessToken({
    sub: '00000000-0000-7000-8000-000000000001',
    username: 'tester',
    email: 'tester@example.com',
    role,
    jti: 'test-jti',
  });
}

describe('documentation access · the mode table', () => {
  it('closes the gate by default in production and opens it in development', () => {
    assert.equal(modeWith({ NODE_ENV: 'production' }), 'gateway');
    assert.equal(modeWith({ NODE_ENV: 'development' }), 'public');
  });

  it('honours an explicit mode', () => {
    assert.equal(modeWith({ DOCS_ACCESS: 'disabled' }), 'disabled');
    assert.equal(modeWith({ DOCS_ACCESS: 'session' }), 'session');
  });

  /**
   * The point of the whole exercise: a mistake in the deployment must not be
   * able to publish the documentation.
   */
  it('refuses DOCS_ACCESS=public in production', () => {
    assert.equal(
      modeWith({ NODE_ENV: 'production', DOCS_ACCESS: 'public' }),
      'gateway',
    );
  });
});

describe('documentation access · the guard', () => {
  let server: Server;
  let base: string;

  before(async () => {
    const express = (await import('express')).default;
    const app = express();
    app.use(requireDocsAccess());
    app.use((_req, res) => void res.send('the documentation'));

    server = createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    base = `http://127.0.0.1:${address.port}`;
  });

  after(() => server.close());

  const get = (headers: Record<string, string> = {}) =>
    fetch(base, { headers });

  it('is in gateway mode for these tests', () => {
    assert.equal(docsAccessMode(), 'gateway');
  });

  it('answers 404 - not 401 - to a visitor with no credentials', async () => {
    const response = await get();
    assert.equal(response.status, 404);
    const body = (await response.json()) as { code?: string };
    assert.equal(body.code, 'NOT_FOUND');
    // Nothing in the answer may hint that there is a door here.
    assert.equal(response.headers.get('www-authenticate'), null);
  });

  it('lets through a request carrying the gateway token', async () => {
    const response = await get({ [GATEWAY_HEADER]: GATEWAY_TOKEN });
    assert.equal(response.status, 200);
  });

  it('rejects a wrong or truncated gateway token', async () => {
    for (const value of [
      'wrong',
      GATEWAY_TOKEN.slice(0, -1),
      `${GATEWAY_TOKEN}x`,
      '',
    ]) {
      const response = await get({ [GATEWAY_HEADER]: value });
      assert.equal(response.status, 404, `token ${JSON.stringify(value)}`);
    }
  });

  it('lets through an administrator session and nobody else', async () => {
    const asAdmin = await get({
      authorization: `Bearer ${token('GLOBAL_ADMIN')}`,
    });
    assert.equal(asAdmin.status, 200);

    const asUser = await get({ authorization: `Bearer ${token('USER')}` });
    assert.equal(asUser.status, 404);

    const garbage = await get({ authorization: 'Bearer not.a.token' });
    assert.equal(garbage.status, 404);
  });
});
