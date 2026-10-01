import {
  op,
  ok,
  created,
  noContent,
  errs,
  body,
  session,
  query,
  pathParam,
  type Paths,
} from './_helpers.ts';
import { ref } from '../schemas.ts';

/**
 * The search parameters are the ones `searchTicketsQuerySchema` validates: the
 * component is generated from that contract, and these entries describe the
 * same names one by one so the browser can offer a form instead of a blob.
 */
const searchParams = [
  { $ref: '#/components/parameters/Page' },
  { $ref: '#/components/parameters/Take' },
  query(
    'cursor',
    'Cursor pagination. Prefer it over `page` on long lists: it does not skip or repeat rows when tickets are being created while you page.',
  ),
  query(
    'q',
    'Full-text search over title and description. Uses a PostgreSQL GIN index with an accent-insensitive Spanish configuration, not a `LIKE %…%`.',
  ),
  query('organizationId', 'Restrict to one organization.', {
    type: 'string',
    format: 'uuid',
  }),
  query(
    'status',
    'One or more states.',
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
    'One or more priorities.',
    {
      type: 'array',
      items: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
    },
    { style: 'form', explode: true },
  ),
  query('categoryId', 'Filter by category.', {
    type: 'string',
    format: 'uuid',
  }),
  query('assignedToId', 'Filter by assignee.', {
    type: 'string',
    format: 'uuid',
  }),
  query('createdById', 'Filter by reporter.', {
    type: 'string',
    format: 'uuid',
  }),
  query('hasAttachments', 'Only tickets with (or without) files.', {
    type: 'boolean',
  }),
  query('createdFrom', 'Created on or after.', {
    type: 'string',
    format: 'date-time',
  }),
  query('createdTo', 'Created on or before.', {
    type: 'string',
    format: 'date-time',
  }),
  query('updatedFrom', 'Updated on or after.', {
    type: 'string',
    format: 'date-time',
  }),
  query('updatedTo', 'Updated on or before.', {
    type: 'string',
    format: 'date-time',
  }),
  query('sort', 'Sort field.', {
    type: 'string',
    enum: ['createdAt', 'updatedAt', 'priority', 'status'],
  }),
  query('order', 'Sort direction.', { type: 'string', enum: ['asc', 'desc'] }),
];

const ticketList = ok('Tickets, with pagination and facets.', {
  type: 'object',
  properties: {
    data: { type: 'array', items: ref('TicketListItem') },
    meta: ref('PaginationMeta'),
    facets: {
      type: 'object',
      description:
        'Counters per value for the current filter: what a filter sidebar needs to show how many results each option would give.',
      additionalProperties: {
        type: 'object',
        additionalProperties: { type: 'integer' },
      },
    },
  },
});

export const ticketsPaths: Paths = {
  '/tickets': {
    get: op({
      tag: 'Tickets',
      operationId: 'searchTickets',
      summary: 'Search tickets',
      description:
        'Seventeen filters, facets, sorting and two kinds of pagination. Only tickets of organizations the caller belongs to are visible, and that scoping happens in SQL, not after the fact.',
      security: session,
      parameters: searchParams,
      responses: { '200': ticketList, ...errs('400', '401') },
    }),
    post: op({
      tag: 'Tickets',
      operationId: 'createTicket',
      summary: 'Create a ticket',
      description:
        'Opens the ticket in OPEN, assigns it a reference and notifies the agents of the organization. The reporter is the caller.',
      security: session,
      requestBody: body('CreateTicketInput'),
      responses: {
        '201': created('Ticket created.', ref('Ticket')),
        ...errs('400', '401', '403', '404'),
      },
    }),
  },
  '/tickets/{id}': {
    get: op({
      tag: 'Tickets',
      operationId: 'getTicket',
      summary: 'Ticket detail',
      description:
        'Includes reporter, assignee, category and counters. A caller outside the organization gets 404.',
      security: session,
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      responses: { '200': ok('Ticket.', ref('Ticket')), ...errs('401', '404') },
    }),
    patch: op({
      tag: 'Tickets',
      operationId: 'updateTicket',
      summary: 'Edit a ticket',
      description:
        'Title, description, priority and category. The state is **not** changed here: it has its own endpoint because it goes through the state machine.',
      security: session,
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      requestBody: body('UpdateTicketInput'),
      responses: {
        '200': ok('Updated ticket.', ref('Ticket')),
        ...errs('400', '401', '403', '404'),
      },
    }),
    delete: op({
      tag: 'Tickets',
      operationId: 'deleteTicket',
      summary: 'Delete a ticket',
      description:
        'ORG_ADMIN only. Soft delete: the history and the audit entries survive.',
      security: session,
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      responses: {
        '204': noContent('Ticket deleted.'),
        ...errs('401', '403', '404'),
      },
    }),
  },
  '/tickets/{id}/status': {
    patch: op({
      tag: 'Tickets',
      operationId: 'changeTicketStatus',
      summary: 'Change the state',
      description:
        'Goes through the state machine: only the declared transitions are accepted, and moving to RESOLVED requires a resolution of at least 20 characters. An invalid transition answers 409, never a silent 200.',
      security: session,
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      requestBody: body('ChangeStatusInput'),
      responses: {
        '200': ok('New state.', ref('Ticket')),
        ...errs('400', '401', '403', '404', '409'),
      },
    }),
  },
  '/tickets/{id}/assignee': {
    patch: op({
      tag: 'Tickets',
      operationId: 'assignTicket',
      summary: 'Assign the ticket',
      description:
        'AGENT or above. Assigning to `null` puts it back in the unassigned queue. The assignee is notified.',
      security: session,
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      requestBody: body('AssignTicketInput'),
      responses: {
        '200': ok('Updated ticket.', ref('Ticket')),
        ...errs('400', '401', '403', '404'),
      },
    }),
  },
  '/tickets/{id}/history': {
    get: op({
      tag: 'Tickets',
      operationId: 'ticketHistory',
      summary: 'Ticket history',
      description:
        'Append-only trail of what changed, who changed it and when. Nothing here can be edited or deleted, which is what makes it worth reading.',
      security: session,
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      responses: {
        '200': ok('Entries, oldest first.', {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              field: { type: 'string', example: 'status' },
              from: { type: 'string', nullable: true },
              to: { type: 'string', nullable: true },
              actor: ref('UserSummary'),
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        }),
        ...errs('401', '404'),
      },
    }),
  },
  '/tickets/{id}/comments': {
    get: op({
      tag: 'Tickets',
      operationId: 'listComments',
      summary: 'Comments',
      description:
        'Internal notes are filtered out for a plain MEMBER: they never leave the server for someone who should not read them, rather than being hidden by the interface.',
      security: session,
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      responses: {
        '200': ok('Comments.', { type: 'array', items: ref('TicketComment') }),
        ...errs('401', '404'),
      },
    }),
    post: op({
      tag: 'Tickets',
      operationId: 'addComment',
      summary: 'Comment on a ticket',
      description:
        'Setting `isInternal` requires AGENT or above. Mentions notify, and the comment is broadcast live to whoever has the ticket open.',
      security: session,
      parameters: [{ $ref: '#/components/parameters/IdPath' }],
      requestBody: body('CreateCommentInput'),
      responses: {
        '201': created('Comment created.', ref('TicketComment')),
        ...errs('400', '401', '403', '404'),
      },
    }),
  },
  '/tickets/{id}/comments/{commentId}': {
    patch: op({
      tag: 'Tickets',
      operationId: 'updateComment',
      summary: 'Edit a comment',
      description:
        'Only its author, and the edit is stamped so the change is visible.',
      security: session,
      parameters: [
        { $ref: '#/components/parameters/IdPath' },
        pathParam('commentId', 'Comment to edit.'),
      ],
      requestBody: body('UpdateCommentInput'),
      responses: {
        '200': ok('Updated comment.', ref('TicketComment')),
        ...errs('400', '401', '403', '404'),
      },
    }),
    delete: op({
      tag: 'Tickets',
      operationId: 'deleteComment',
      summary: 'Delete a comment',
      description: 'Its author or an ORG_ADMIN.',
      security: session,
      parameters: [
        { $ref: '#/components/parameters/IdPath' },
        pathParam('commentId', 'Comment to delete.'),
      ],
      responses: {
        '204': noContent('Comment deleted.'),
        ...errs('401', '403', '404'),
      },
    }),
  },
};
