import {
  op,
  ok,
  errs,
  session,
  listOf,
  query,
  type Paths,
} from './_helpers.ts';

export const adminPaths: Paths = {
  '/admin/stats': {
    get: op({
      tag: 'Admin',
      operationId: 'platformStats',
      summary: 'Platform statistics',
      description:
        'GLOBAL_ADMIN only. Users, organizations, tickets by state and activity of the last days: the numbers behind the administration dashboard.',
      security: session,
      responses: {
        '200': ok('Counters.', {
          type: 'object',
          properties: {
            users: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                active: { type: 'integer' },
                admins: { type: 'integer' },
              },
            },
            organizations: { type: 'integer' },
            tickets: {
              type: 'object',
              additionalProperties: { type: 'integer' },
            },
            recentActivity: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', format: 'date' },
                  tickets: { type: 'integer' },
                },
              },
            },
          },
        }),
        ...errs('401', '403'),
      },
    }),
  },
  '/admin/audit-logs': {
    get: op({
      tag: 'Admin',
      operationId: 'listAuditLogs',
      summary: 'Audit trail',
      description:
        'GLOBAL_ADMIN only. Every sensitive action with before and after. Password hashes and tokens are never written here, which is what lets the trail be read without turning it into a second attack surface. Filterable by actor, action, entity and date range.',
      security: session,
      parameters: [
        { $ref: '#/components/parameters/Page' },
        { $ref: '#/components/parameters/Take' },
        query('actorId', 'Who performed the action.', {
          type: 'string',
          format: 'uuid',
        }),
        query('action', 'Action name.', { type: 'string' }),
        query('entity', 'Entity type.', { type: 'string' }),
        query('from', 'From this moment.', {
          type: 'string',
          format: 'date-time',
        }),
        query('to', 'Up to this moment.', {
          type: 'string',
          format: 'date-time',
        }),
      ],
      responses: {
        '200': listOf('AuditLog', 'Audit entries.'),
        ...errs('401', '403'),
      },
    }),
  },
};
