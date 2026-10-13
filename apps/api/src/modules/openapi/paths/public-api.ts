/**
 * ==============================================================================
 *  Public API · /api/v1/public
 *
 *  The surface integrations talk to. Documented in more depth than the rest
 *  because it is the one that is *claimed* as a module and the one an outside
 *  developer reads without having the code in front of them.
 *
 *  Two things worth knowing before using it:
 *
 *    · A key is locked to ONE organization and to a list of scopes. There is no
 *      `organizationId` parameter anywhere: it is taken from the key, so a key
 *      cannot reach across tenants even by accident.
 *    · These routes call the SAME domain services as the web application. The
 *      ticket state machine, the RBAC matrix and the notifications all apply,
 *      so nothing can be done here that could not be done in the interface.
 * ==============================================================================
 */
import {
  op,
  ok,
  created,
  noContent,
  errs,
  body,
  key,
  query,
  type Paths,
} from './_helpers.ts';
import { ref } from '../schemas.ts';

const rateLimited = {
  '429': { $ref: '#/components/responses/TooManyRequests' },
};

/** A row as the search returns it (flat), not a ticket detail. */
const ticketRowExample = {
  id: '018f3a2b-7c4d-7a1e-9b52-2f6d1c8e4a90',
  reference: 'HD-0242',
  title: 'The second floor printer does not print',
  status: 'OPEN',
  priority: 'HIGH',
  organizationId: '018f3a2b-7c4d-7a1e-9b52-000000000001',
  categoryName: 'Hardware',
  categoryColor: '#b4690e',
  authorUsername: 'alopez',
  authorDisplayName: 'Ana López',
  assigneeUsername: null,
  assigneeDisplayName: null,
  commentCount: 2,
  attachmentCount: 1,
  rank: null,
  createdAt: '2026-09-30T09:12:00.000Z',
  updatedAt: '2026-09-30T09:20:00.000Z',
};

export const publicApiPaths: Paths = {
  '/public/me': {
    get: op({
      tag: 'Public API',
      operationId: 'publicMe',
      summary: 'Who is this key',
      description:
        'The organization the key is locked to, its scopes and the user who created it. The first call to make when wiring an integration: if this answers, the key is valid, active and not expired.',
      security: key(),
      responses: {
        '200': ok('Identity of the key.', {
          type: 'object',
          properties: {
            organizationId: { type: 'string', format: 'uuid' },
            scopes: {
              type: 'array',
              items: { type: 'string', example: 'tickets:read' },
            },
            owner: ref('UserSummary'),
          },
        }),
        ...errs('401'),
        ...rateLimited,
      },
    }),
  },
  '/public/tickets': {
    get: op({
      tag: 'Public API',
      operationId: 'publicListTickets',
      summary: 'List tickets',
      description:
        'Same search engine as the web application - full text, filters, facets and pagination - restricted to the organization of the key. Requires the `tickets:read` scope.',
      security: key('tickets:read'),
      parameters: [
        { $ref: '#/components/parameters/Page' },
        { $ref: '#/components/parameters/Take' },
        query('q', 'Full-text search over title and description.'),
        query(
          'status',
          'Filter by state.',
          {
            type: 'array',
            items: {
              type: 'string',
              enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'],
            },
          },
          { style: 'form', explode: true },
        ),
        query(
          'priority',
          'Filter by priority.',
          {
            type: 'array',
            items: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          },
          { style: 'form', explode: true },
        ),
        query(
          'cursor',
          'Cursor pagination, stable while rows are being inserted.',
        ),
      ],
      responses: {
        // Mismo buscador que la aplicación, así que mismo bloque `meta`: con
        // `tookMs` y `facets` DENTRO. Declaraba la paginación a secas.
        '200': ok(
          'Tickets of the organization.',
          {
            type: 'object',
            properties: {
              data: { type: 'array', items: ref('TicketListItem') },
              meta: ref('SearchMeta'),
            },
          },
          {
            data: [ticketRowExample],
            meta: {
              total: 1,
              page: 1,
              take: 20,
              pages: 1,
              tookMs: 9,
              facets: { status: { OPEN: 1 }, priority: { MEDIUM: 1 } },
            },
          },
        ),
        ...errs('400', '401', '403'),
        ...rateLimited,
      },
    }),
    post: op({
      tag: 'Public API',
      operationId: 'publicCreateTicket',
      summary: 'Create a ticket',
      description:
        'The organization is injected from the key, so `organizationId` is ignored if sent. The ticket is created exactly as the interface would create it: it opens in OPEN, gets a reference and notifies the agents. Requires `tickets:write`.',
      security: key('tickets:write'),
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: ref('CreateTicketPublicInput'),
            example: {
              title: 'The second floor printer does not print',
              description:
                'It shows a paper jam that is not there. Restarting it does not help.',
              priority: 'HIGH',
            },
          },
        },
      },
      responses: {
        '201': created('Ticket created.', ref('Ticket')),
        ...errs('400', '401', '403'),
        ...rateLimited,
      },
    }),
  },
  '/public/tickets/{id}': {
    get: op({
      tag: 'Public API',
      operationId: 'publicGetTicket',
      summary: 'Ticket detail',
      description:
        'A ticket of another organization answers 404, never 403: the key cannot even confirm that it exists. Requires `tickets:read`.',
      security: key('tickets:read'),
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      responses: {
        '200': ok('Ticket.', ref('Ticket')),
        ...errs('401', '403', '404'),
        ...rateLimited,
      },
    }),
    put: op({
      tag: 'Public API',
      operationId: 'publicReplaceTicket',
      summary: 'Update a ticket (PUT)',
      description:
        'Kept alongside PATCH because many integrations only speak PUT. Both apply the same partial update: fields that are not sent are left alone. Requires `tickets:write`.',
      security: key('tickets:write'),
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      requestBody: body('UpdateTicketInput'),
      responses: {
        '200': ok('Updated ticket.', ref('Ticket')),
        ...errs('400', '401', '403', '404'),
        ...rateLimited,
      },
    }),
    patch: op({
      tag: 'Public API',
      operationId: 'publicUpdateTicket',
      summary: 'Update a ticket (PATCH)',
      description:
        'Title, description, priority and category. To change the state, the integration has to go through the web API, which is where the state machine lives. Requires `tickets:write`.',
      security: key('tickets:write'),
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      requestBody: body('UpdateTicketInput'),
      responses: {
        '200': ok('Updated ticket.', ref('Ticket')),
        ...errs('400', '401', '403', '404'),
        ...rateLimited,
      },
    }),
    delete: op({
      tag: 'Public API',
      operationId: 'publicDeleteTicket',
      summary: 'Delete a ticket',
      description:
        'Soft delete, same as the interface: the history survives. Requires `tickets:write`.',
      security: key('tickets:write'),
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      responses: {
        '204': noContent('Ticket deleted.'),
        ...errs('401', '403', '404'),
        ...rateLimited,
      },
    }),
  },
  '/public/tickets/{id}/comments': {
    get: op({
      tag: 'Public API',
      operationId: 'publicListComments',
      summary: 'Comments of a ticket',
      description:
        'Internal notes are **not** returned here: a key is an integration, not an agent. Requires `comments:read`.',
      security: key('comments:read'),
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      responses: {
        '200': ok('Comments.', { type: 'array', items: ref('TicketComment') }),
        ...errs('401', '403', '404'),
        ...rateLimited,
      },
    }),
    post: op({
      tag: 'Public API',
      operationId: 'publicAddComment',
      summary: 'Comment on a ticket',
      description:
        'The comment is attributed to the user who created the key, and it reaches the interface live over the socket like any other. Requires `comments:write`.',
      security: key('comments:write'),
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      requestBody: body('CreateCommentInput'),
      responses: {
        '201': created('Comment created.', ref('TicketComment')),
        ...errs('400', '401', '403', '404'),
        ...rateLimited,
      },
    }),
  },
  '/public/categories': {
    get: op({
      tag: 'Public API',
      operationId: 'publicListCategories',
      summary: 'Categories',
      description:
        'Categories of the organization of the key. Requires `categories:read`.',
      security: key('categories:read'),
      responses: {
        '200': ok('Categories.', { type: 'array', items: ref('Category') }),
        ...errs('401', '403'),
        ...rateLimited,
      },
    }),
    post: op({
      tag: 'Public API',
      operationId: 'publicCreateCategory',
      summary: 'Create a category',
      description: 'Requires `categories:write`.',
      security: key('categories:write'),
      requestBody: body('CreateCategoryInput'),
      responses: {
        '201': created('Category created.', ref('Category')),
        ...errs('400', '401', '403', '409'),
        ...rateLimited,
      },
    }),
  },
  '/public/categories/{id}': {
    put: op({
      tag: 'Public API',
      operationId: 'publicUpdateCategory',
      summary: 'Update a category',
      description: 'Requires `categories:write`.',
      security: key('categories:write'),
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      requestBody: body('UpdateCategoryInput'),
      responses: {
        '200': ok('Updated category.', ref('Category')),
        ...errs('400', '401', '403', '404'),
        ...rateLimited,
      },
    }),
    delete: op({
      tag: 'Public API',
      operationId: 'publicDeleteCategory',
      summary: 'Delete a category',
      description:
        'Tickets in it are left without a category. Requires `categories:write`.',
      security: key('categories:write'),
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      responses: {
        '204': noContent('Category deleted.'),
        ...errs('401', '403', '404'),
        ...rateLimited,
      },
    }),
  },
  '/public/organizations/{id}/stats': {
    get: op({
      tag: 'Public API',
      operationId: 'publicOrganizationStats',
      summary: 'Organization statistics',
      description:
        'Counters by state, priority and category. The id must be the organization of the key; any other answers 404. Requires `stats:read`.',
      security: key('stats:read'),
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      responses: {
        '200': ok('Counters.', {
          type: 'object',
          properties: {
            tickets: {
              type: 'object',
              additionalProperties: { type: 'integer' },
            },
            members: { type: 'integer' },
          },
        }),
        ...errs('401', '403', '404'),
        ...rateLimited,
      },
    }),
  },
};
