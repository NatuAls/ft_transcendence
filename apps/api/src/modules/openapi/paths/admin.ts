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
        'GLOBAL_ADMIN only. Every sensitive action, newest first: role changes (including the roles given by e-mail: `role.reserved`, `role.reservation.cancelled`, `role.reservation.claimed`), suspensions, deletions, organization and API-key management and the GDPR operations. Password hashes and tokens are never written here, which is what lets the trail be read without turning it into a second attack surface. Filterable by actor, action, entity and date range.',
      security: session,
      parameters: [
        { $ref: '#/components/parameters/Page' },
        { $ref: '#/components/parameters/Take' },
        query('actorId', 'Who performed the action.', {
          type: 'string',
          format: 'uuid',
        }),
        query('action', 'Action name, exactly.', {
          type: 'string',
          example: 'role.reserved',
        }),
        query('entity', 'Entity type, exactly.', {
          type: 'string',
          example: 'PlatformRoleGrant',
        }),
        query('entityId', 'One entity: the whole history of a user, say.', {
          type: 'string',
          format: 'uuid',
        }),
        query('from', 'From this moment (date or date-time).', {
          type: 'string',
          example: '2026-10-01',
        }),
        query('to', 'Up to this moment (date or date-time).', {
          type: 'string',
          example: '2026-10-04T23:59:59Z',
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
        "GLOBAL_ADMIN only. If a **verified** account has the address, its role changes now (`APPLIED`, 200; `UNCHANGED` if it already had it). Otherwise the role is **reserved** for the address (`RESERVED`, 201) and an e-mail tells the person to create the account - or confirm it - with that address; the role reaches the account when the address is verified, never at sign-up, so registering somebody else's address first gains nothing. Giving the role again to a reserved address updates the reservation instead of duplicating it. Nobody can change their own platform role (403). Taking the role back is `PATCH /users/{id}/role`. Written to the audit trail as `user.role.changed` or `role.reserved`.",
      security: session,
      requestBody: body('AssignPlatformRoleInput'),
      responses: {
        '200': ok(
          'Applied to the account, or it already had the role.',
          ref('PlatformRoleAssignment'),
          {
            outcome: 'APPLIED',
            email: 'lucia.agent@example.com',
            globalRole: 'GLOBAL_ADMIN',
            user: {
              id: '01a106fe-9dff-72f9-88a4-36321c6f0cbd',
              username: 'lucia',
              displayName: 'Lucía Martín',
            },
            reservation: null,
          },
        ),
        '201': created(
          'Reserved for the address.',
          ref('PlatformRoleAssignment'),
          {
            outcome: 'RESERVED',
            email: 'new.admin@example.com',
            globalRole: 'GLOBAL_ADMIN',
            user: null,
            reservation: {
              id: '01a10712-4c1e-7b3d-a0f2-9be1d07c5a11',
              email: 'new.admin@example.com',
              globalRole: 'GLOBAL_ADMIN',
              waitingFor: 'ACCOUNT',
              grantedBy: {
                id: '01a106fe-0b2c-7e11-9f40-6a5d3c2b1a00',
                username: 'ana',
                displayName: 'Ana García',
              },
              createdAt: '2026-10-04T09:30:00.000Z',
              updatedAt: '2026-10-04T09:30:00.000Z',
            },
          },
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
        'GLOBAL_ADMIN only. The address no longer receives the role when it is verified. Recorded in the audit trail as `role.reservation.cancelled`.',
      security: session,
      parameters: [pathParam('grantId', 'Reservation id.')],
      responses: {
        '204': noContent('Reservation cancelled.'),
        ...errs('401', '403', '404'),
      },
    }),
  },
};
