/**
 * ==============================================================================
 *  OpenAPI · the document
 *
 *  Assembled at boot from three sources:
 *    · `schemas.ts`  - request bodies converted from the Zod contracts
 *    · `paths/*.ts`  - one file per functional module
 *    · this file     - info, servers, security schemes and the responses,
 *                      parameters and headers every operation reuses
 *
 *  Served at GET /api/v1/openapi.json and rendered by the UI at /api/v1/docs.
 * ==============================================================================
 */
import { componentSchemas, ref, type JsonSchema } from './schemas.ts';
import { GLOBAL_PREFIX } from '../../routing.ts';
import { healthPaths } from './paths/health.ts';
import { authPaths } from './paths/auth.ts';
import { usersPaths } from './paths/users.ts';
import { organizationsPaths } from './paths/organizations.ts';
import { ticketsPaths } from './paths/tickets.ts';
import { filesPaths } from './paths/files.ts';
import { socialPaths } from './paths/social.ts';
import { notificationsPaths } from './paths/notifications.ts';
import { gdprPaths } from './paths/gdpr.ts';
import { adminPaths } from './paths/admin.ts';
import { publicApiPaths } from './paths/public-api.ts';

const DESCRIPTION = `
Multi-tenant help desk: organizations, tickets with a real state machine,
comments and internal notes, attachments, 1-to-1 chat, notifications, GDPR
flows and a key-authenticated **public API**.

## Authentication

| Door | Header | Who uses it |
|---|---|---|
| Session | \`Authorization: Bearer <accessToken>\` | The web application. The token lasts 15 minutes and is renewed with the \`hd_refresh\` cookie through \`POST /auth/refresh\`. |
| Public API | \`X-API-Key: hdl_live_<prefix>.<secret>\` | Integrations. The key is locked to one organization and to a list of scopes. |

Press **Authorize** to use either from this page. The value is kept between
reloads, so a refresh does not log you out of the documentation.

## Errors

Every failure - including the ones raised by the body parser, the rate limiter
or an unmatched URL - comes back as \`ApiError\`: a stable \`code\`, a
translation \`messageKey\`, an English \`message\`, the per-field \`details\`
when the payload is invalid, and the \`requestId\` that ties the response to
the server logs.

## Pagination

Lists answer \`{ data, meta }\`. \`meta\` carries \`total\`, \`page\`, \`take\`
(never above 100) and \`pages\`; ticket search also returns \`nextCursor\` for
cursor pagination, which is the stable one when rows are being inserted while
you page.

## Rate limits

Per IP for the whole API, much tighter on the credential routes, and per key on
the public API (60/min and 1000/hour). The remaining budget travels in the
\`RateLimit-*\` headers of every response.

## Validation

Request bodies below are **generated from the same Zod contracts the API
validates with** (\`packages/contracts\`), shared with the web client. What you
read here is what the server enforces - they cannot drift apart.
`.trim();

const TAGS = [
  {
    name: 'Health',
    description:
      'Liveness, readiness and the public status page. Outside the versioned prefix on purpose.',
  },
  {
    name: 'Auth',
    description:
      'Sign-up, sign-in, refresh rotation with reuse detection, e-mail verification, password recovery and session revocation.',
  },
  {
    name: 'Users',
    description:
      'Own profile, preferences, avatar, public profiles and user search.',
  },
  {
    name: 'Organizations',
    description:
      'Tenants: CRUD, members and roles, categories and the API keys of the public API.',
  },
  {
    name: 'Tickets',
    description:
      'The core: search with filters and facets, the state machine, comments, internal notes, assignment and history.',
  },
  {
    name: 'Files',
    description:
      'Attachments: upload with type detection by magic bytes, thumbnails, quotas and access control.',
  },
  {
    name: 'Social',
    description:
      'Friendships and 1-to-1 chat. The chat is also delivered live over Socket.IO.',
  },
  {
    name: 'Notifications',
    description:
      'Per-user notifications with translation keys instead of frozen text.',
  },
  {
    name: 'GDPR',
    description:
      'Data export and account deletion, both with e-mail confirmation.',
  },
  {
    name: 'Admin',
    description:
      'Platform administration: users, roles, status and the audit trail.',
  },
  {
    name: 'Public API',
    description:
      'Key-authenticated surface for integrations. Same domain services as the web app, so no business rule can be bypassed through this door.',
  },
];

/** Reusable error responses: every operation points at these. */
function errorResponse(description: string, example: JsonSchema): JsonSchema {
  return {
    description,
    content: { 'application/json': { schema: ref('ApiError'), example } },
  };
}

const RESPONSES: Record<string, JsonSchema> = {
  BadRequest: errorResponse(
    'The payload failed the shared Zod contract. `details` says which field and why.',
    {
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      messageKey: 'errors.common.validationFailed',
      message: 'Request payload failed validation.',
      details: [
        {
          path: 'title',
          code: 'too_small',
          messageKey: 'errors.ticket.titleTooShort',
        },
      ],
      requestId: '01JB2K9Z',
      timestamp: '2026-09-30T10:00:00.000Z',
      path: '/api/v1/tickets',
    },
  ),
  Unauthorized: errorResponse(
    'Missing, expired or revoked credentials. With a session, renew it through `POST /auth/refresh`.',
    {
      statusCode: 401,
      code: 'UNAUTHORIZED',
      messageKey: 'errors.auth.sessionExpired',
      message: 'Authentication required.',
      requestId: '01JB2K9Z',
      timestamp: '2026-09-30T10:00:00.000Z',
      path: '/api/v1/tickets',
    },
  ),
  Forbidden: errorResponse(
    'Authenticated, but the role or the key scope does not allow this action.',
    {
      statusCode: 403,
      code: 'FORBIDDEN',
      messageKey: 'errors.common.forbidden',
      message: 'Not allowed.',
      requestId: '01JB2K9Z',
      timestamp: '2026-09-30T10:00:00.000Z',
      path: '/api/v1/tickets',
    },
  ),
  NotFound: errorResponse(
    'The resource does not exist **or** the caller is not a member of its organization: a non-member gets 404, never 403, so the API never confirms that a resource exists.',
    {
      statusCode: 404,
      code: 'NOT_FOUND',
      messageKey: 'errors.common.notFound',
      message: 'Resource not found.',
      requestId: '01JB2K9Z',
      timestamp: '2026-09-30T10:00:00.000Z',
      path: '/api/v1/tickets/6f1c…',
    },
  ),
  Conflict: errorResponse(
    'The action clashes with the current state: a taken slug, a duplicate membership, or a transition the ticket state machine forbids.',
    {
      statusCode: 409,
      code: 'ORG_SLUG_TAKEN',
      messageKey: 'errors.org.slugTaken',
      message: 'That organization slug is already in use.',
      requestId: '01JB2K9Z',
      timestamp: '2026-09-30T10:00:00.000Z',
      path: '/api/v1/organizations',
    },
  ),
  InternalError: errorResponse(
    'Unexpected failure. The envelope still carries a `requestId`, which is how the matching log line is found.',
    {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      messageKey: 'errors.common.unexpected',
      message: 'Unexpected error.',
      requestId: '01JB2K9Z',
      timestamp: '2026-09-30T10:00:00.000Z',
      path: '/api/health',
    },
  ),
  TooManyRequests: errorResponse(
    'Rate limit exhausted. `Retry-After` says how many seconds to wait.',
    {
      statusCode: 429,
      code: 'RATE_LIMITED',
      messageKey: 'errors.common.rateLimited',
      message: 'Too many requests.',
      requestId: '01JB2K9Z',
      timestamp: '2026-09-30T10:00:00.000Z',
      path: '/api/v1/auth/login',
    },
  ),
};

const PARAMETERS: Record<string, JsonSchema> = {
  IdPath: {
    name: 'id',
    in: 'path',
    required: true,
    description: 'Resource identifier.',
    schema: { type: 'string', format: 'uuid' },
  },
  OrganizationIdPath: {
    name: 'organizationId',
    in: 'path',
    required: true,
    description: 'Organization identifier.',
    schema: { type: 'string', format: 'uuid' },
  },
  Page: {
    name: 'page',
    in: 'query',
    description: '1-based page number.',
    schema: { type: 'integer', minimum: 1, default: 1 },
  },
  Take: {
    name: 'take',
    in: 'query',
    description: 'Page size. Capped at 100 by the server.',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
};

const HEADERS: Record<string, JsonSchema> = {
  RateLimitLimit: {
    description: 'Requests allowed in the current window.',
    schema: { type: 'integer' },
  },
  RateLimitRemaining: {
    description: 'Requests left in the current window.',
    schema: { type: 'integer' },
  },
  RateLimitReset: {
    description: 'Seconds until the window resets.',
    schema: { type: 'integer' },
  },
  RequestId: {
    description:
      'Correlation id, also present in the body of every error and in the logs.',
    schema: { type: 'string' },
  },
};

export interface BuildOptions {
  /** Shown as the document version; the deployment injects it as APP_VERSION. */
  version?: string;
  /** Extra servers (staging, production) beyond the relative one. */
  servers?: Array<{ url: string; description: string }>;
}

export function buildDocument(options: BuildOptions = {}): JsonSchema {
  const paths: Record<string, JsonSchema> = {
    ...healthPaths,
    ...authPaths,
    ...usersPaths,
    ...organizationsPaths,
    ...ticketsPaths,
    ...filesPaths,
    ...socialPaths,
    ...notificationsPaths,
    ...gdprPaths,
    ...adminPaths,
    ...publicApiPaths,
  };

  return {
    openapi: '3.0.3',
    info: {
      title: 'HelpDesk Lite API',
      version: options.version ?? process.env['APP_VERSION'] ?? '1.0.0',
      description: DESCRIPTION,
      license: { name: 'MIT', url: 'https://opensource.org/license/mit' },
    },
    servers: [
      {
        url: GLOBAL_PREFIX,
        description: 'This deployment (same origin as this page).',
      },
      ...(options.servers ?? []),
    ],
    tags: TAGS,
    // Nothing is public by default: each operation says which door it accepts.
    security: [],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Session access token, 15 minutes. Obtained from `POST /auth/login` and renewed with `POST /auth/refresh`.',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description:
            'Public API key: `hdl_live_<prefix>.<secret>`. Created by an ORG_ADMIN at `POST /organizations/{organizationId}/api-keys`; the secret is shown once.',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'hd_refresh',
          description:
            'HttpOnly refresh cookie. The browser sends it on its own to `POST /auth/refresh`; it cannot be set from this page.',
        },
      },
      schemas: componentSchemas,
      responses: RESPONSES,
      parameters: PARAMETERS,
      headers: HEADERS,
    },
  };
}
