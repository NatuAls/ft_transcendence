import {
  op,
  ok,
  created,
  noContent,
  errs,
  body,
  session,
  listOf,
  pathParam,
  query,
  type Paths,
} from './_helpers.ts';
import { ref } from '../schemas.ts';

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
  '/admin/role-grants': {
    get: op({
      tag: 'Admin',
      operationId: 'listPlatformRoleReservations',
      summary: 'Platform roles waiting for an account',
      description:
        'GLOBAL_ADMIN only. Every platform role given to an e-mail address that has no verified account yet, with who established the link and whether the address is waiting for an account or for its verification. The administrators themselves are `GET /users?globalRole=GLOBAL_ADMIN`.',
      security: session,
      responses: {
        '200': ok('Reservations, newest first.', {
          type: 'array',
          items: ref('PlatformRoleReservation'),
        }),
        ...errs('401', '403'),
      },
    }),
    post: op({
      tag: 'Admin',
      operationId: 'assignPlatformRole',
      summary: 'Give the platform role to an e-mail address',
      description:
        "GLOBAL_ADMIN only. If a **verified** account has the address, its role changes now (`APPLIED`, 200). Otherwise the role is **reserved** for the address (`RESERVED`, 201) and an e-mail tells the person to create the account - or confirm it - with that address; the role reaches the account when the address is verified, never at sign-up, so registering somebody else's address first gains nothing. Nobody can change their own platform role. Taking the role back is `PATCH /users/{id}/role`.",
      security: session,
      requestBody: body('AssignPlatformRoleInput'),
      responses: {
        '200': ok(
          'Applied to the account, or it already had the role.',
          ref('PlatformRoleAssignment'),
        ),
        '201': created(
          'Reserved for the address.',
          ref('PlatformRoleAssignment'),
        ),
        ...errs('400', '401', '403'),
      },
    }),
  },
  '/admin/role-grants/{grantId}': {
    delete: op({
      tag: 'Admin',
      operationId: 'cancelPlatformRoleReservation',
      summary: 'Cancel a platform role reservation',
      description:
        'GLOBAL_ADMIN only. The address no longer receives the role when it is verified. Recorded in the audit trail.',
      security: session,
      parameters: [pathParam('grantId', 'Reservation id.')],
      responses: {
        '204': noContent('Reservation cancelled.'),
        ...errs('401', '403', '404'),
      },
    }),
  },
};
