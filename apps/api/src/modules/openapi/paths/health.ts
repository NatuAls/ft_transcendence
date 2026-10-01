import { op, ok, errs, open, type Paths } from './_helpers.ts';
import { ref } from '../schemas.ts';

/**
 * Probes. They live OUTSIDE /api/v1 on purpose: Docker's HEALTHCHECK and
 * anyone asking whether the service is alive should not have to know which
 * API version is deployed. Their `servers` override says so.
 */
const rootServer = [{ url: '/', description: 'Probes are not versioned.' }];

export const healthPaths: Paths = {
  '/api/health': {
    servers: rootServer,
    get: op({
      tag: 'Health',
      operationId: 'healthLive',
      summary: 'Liveness',
      description:
        'Answers from memory, touches no dependency and is never rate limited: it is what the container HEALTHCHECK polls. A 200 here only means the process is up.',
      security: open,
      responses: {
        '200': ok('The process is running.', {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            uptimeSeconds: { type: 'integer' },
          },
        }),
        '500': { $ref: '#/components/responses/InternalError' },
      },
    }),
  },
  '/api/health/ready': {
    servers: rootServer,
    get: op({
      tag: 'Health',
      operationId: 'healthReady',
      summary: 'Readiness',
      description:
        'Checks PostgreSQL, Redis, SMTP and disk. It answers **200 even when something is degraded**: the real state is in the body, because a load balancer removing the only instance over a degraded mail server would be worse than the degradation. Rate limited, since it does touch dependencies.',
      security: open,
      responses: {
        '200': ok('Report of every dependency.', {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'degraded'] },
            services: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'database' },
                  status: { type: 'string', enum: ['up', 'degraded', 'down'] },
                  latencyMs: { type: 'number' },
                },
              },
            },
          },
        }),
        ...errs('429'),
      },
    }),
  },
  '/api/health/status': {
    servers: rootServer,
    get: op({
      tag: 'Health',
      operationId: 'healthStatus',
      summary: 'Public status page',
      description:
        'The version meant for users: functional areas and nothing else. It deliberately hides which component failed, because a public page that names the broken piece of infrastructure is a gift to whoever is probing it.',
      security: open,
      responses: {
        '200': ok('State by functional area.', ref('HealthStatus')),
        ...errs('429'),
      },
    }),
  },
  '/api/version': {
    servers: rootServer,
    get: op({
      tag: 'Health',
      operationId: 'version',
      summary: 'Deployed release',
      description:
        'Commit, build time and Node version baked into the image at build time. It is how a deployment is proven to have actually landed: if this does not change, the new image is not the one running.',
      security: open,
      responses: {
        '500': { $ref: '#/components/responses/InternalError' },
        '200': ok('Release identity.', {
          type: 'object',
          properties: {
            name: { type: 'string' },
            version: { type: 'string', example: 'main-42' },
            commit: { type: 'string', example: '9f8e7d6' },
            buildTime: { type: 'string', format: 'date-time' },
            node: { type: 'string', example: 'v24.19.0' },
          },
        }),
      },
    }),
  },
};
