import {
  op,
  ok,
  created,
  noContent,
  errs,
  body,
  session,
  pathParam,
  type Paths,
} from './_helpers.ts';
import { ref } from '../schemas.ts';

const orgId = { $ref: '#/components/parameters/OrganizationIdPath' };

export const organizationsPaths: Paths = {
  '/organizations': {
    get: op({
      tag: 'Organizations',
      operationId: 'listOrganizations',
      summary: 'Organizations I belong to',
      description:
        'Every organization where the caller is a member, with their role in each and counters of members, tickets and categories. A GLOBAL_ADMIN sees all of them.',
      security: session,
      responses: {
        '200': ok('Organizations.', {
          type: 'array',
          items: ref('Organization'),
        }),
        ...errs('401'),
      },
    }),
    post: op({
      tag: 'Organizations',
      operationId: 'createOrganization',
      summary: 'Create an organization',
      description:
        'The caller becomes its ORG_ADMIN, and four categories are seeded (General, Hardware, Software, Network) so the first ticket already has somewhere to go. The slug is derived from the name when not given.',
      security: session,
      requestBody: body('CreateOrganizationInput'),
      responses: {
        '201': created('Organization created.', ref('Organization')),
        ...errs('400', '401', '409'),
      },
    }),
  },
  '/organizations/{organizationId}': {
    get: op({
      tag: 'Organizations',
      operationId: 'getOrganization',
      summary: 'Organization detail',
      description:
        'A caller who is not a member gets **404, not 403**: the API does not confirm that an organization it cannot see exists.',
      security: session,
      parameters: [orgId],
      responses: {
        '200': ok('Organization.', ref('Organization')),
        ...errs('401', '404'),
      },
    }),
    patch: op({
      tag: 'Organizations',
      operationId: 'updateOrganization',
      summary: 'Edit the organization',
      description:
        'ORG_ADMIN only. Name and description; the slug does not change, because URLs already handed out must keep working.',
      security: session,
      parameters: [orgId],
      requestBody: body('UpdateOrganizationInput'),
      responses: {
        '200': ok('Updated organization.', ref('Organization')),
        ...errs('400', '401', '403', '404'),
      },
    }),
    delete: op({
      tag: 'Organizations',
      operationId: 'deleteOrganization',
      summary: 'Delete the organization',
      description:
        'ORG_ADMIN only. Soft delete: the row keeps `deletedAt` so tickets and audit entries do not lose their context.',
      security: session,
      parameters: [orgId],
      responses: {
        '204': noContent('Organization deleted.'),
        ...errs('401', '403', '404'),
      },
    }),
  },
  '/organizations/{organizationId}/members': {
    get: op({
      tag: 'Organizations',
      operationId: 'listMembers',
      summary: 'Members',
      description:
        'Any member may read it. Members with their role, join date and live presence, administrators first. Accounts deleted by their owner are left out. People invited by e-mail who have no verified account yet are not members: they are listed by `GET /organizations/{organizationId}/role-grants`.',
      security: session,
      parameters: [orgId],
      responses: {
        '200': ok('Members.', {
          type: 'array',
          items: ref('OrganizationMember'),
        }),
        ...errs('401', '404'),
      },
    }),
    post: op({
      tag: 'Organizations',
      operationId: 'inviteMember',
      summary: 'Add a member',
      description:
        'ORG_ADMIN only. Adds an **existing** account, found by e-mail or username, and sends the notification and the e-mail. Adding someone twice answers 409 instead of duplicating the membership. To invite an address that has no account yet, use `POST /organizations/{organizationId}/role-grants`.',
      security: session,
      parameters: [orgId],
      requestBody: body('InviteMemberInput'),
      responses: {
        '201': created('Member added.', ref('OrganizationMember')),
        ...errs('400', '401', '403', '404', '409'),
      },
    }),
  },
  '/organizations/{organizationId}/members/{userId}': {
    patch: op({
      tag: 'Organizations',
      operationId: 'updateMemberRole',
      summary: 'Change a member role',
      description:
        'ORG_ADMIN only. The API refuses to remove the **last** administrator: an organization without one cannot be managed by anybody.',
      security: session,
      parameters: [orgId, pathParam('userId', 'User whose role changes.')],
      requestBody: body('UpdateMemberRoleInput'),
      responses: {
        '200': ok('Updated member.', {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'Membership.' },
            role: { type: 'string', enum: ['MEMBER', 'AGENT', 'ORG_ADMIN'] },
            organizationId: { type: 'string', format: 'uuid' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                username: { type: 'string' },
              },
            },
          },
        }),
        ...errs('400', '401', '403', '404', '409'),
      },
    }),
    delete: op({
      tag: 'Organizations',
      operationId: 'removeMember',
      summary: 'Remove a member',
      description: 'ORG_ADMIN only, with the same last-administrator guard.',
      security: session,
      parameters: [orgId, pathParam('userId', 'User to remove.')],
      responses: {
        '204': noContent('Member removed.'),
        ...errs('401', '403', '404', '409'),
      },
    }),
  },
  '/organizations/{organizationId}/leave': {
    post: op({
      tag: 'Organizations',
      operationId: 'leaveOrganization',
      summary: 'Leave the organization',
      description:
        'Any member may leave; the last administrator may not, for the same reason as above.',
      security: session,
      parameters: [orgId],
      responses: {
        '204': noContent('You are no longer a member.'),
        ...errs('401', '404', '409'),
      },
    }),
  },
  '/organizations/{organizationId}/role-grants': {
    get: op({
      tag: 'Organizations',
      operationId: 'listOrganizationRoleReservations',
      summary: 'Organization roles waiting for an account',
      description:
        'ORG_ADMIN (or GLOBAL_ADMIN) only, because the rows are e-mail addresses of people who are not members yet. Each one says whether the address still needs an account or only its verification. The members themselves are `GET /organizations/{organizationId}/members`.',
      security: session,
      parameters: [orgId],
      responses: {
        '200': ok('Reservations, newest first.', {
          type: 'array',
          items: ref('OrganizationRoleReservation'),
        }),
        ...errs('401', '403', '404'),
      },
    }),
    post: op({
      tag: 'Organizations',
      operationId: 'assignOrganizationRole',
      summary: 'Give a role in the organization to an e-mail address',
      description:
        'ORG_ADMIN (or GLOBAL_ADMIN) only. If the address belongs to a **member**, their role changes now - with the same last-administrator rule as `PATCH /members/{userId}`. If it belongs to a **verified** account that is not a member, it joins now with that role. Either is `APPLIED` (200), or `UNCHANGED` when nothing had to change. Otherwise the role is **reserved** for the address (`RESERVED`, 201) and an e-mail invites the person to create the account - or confirm it - with that address; they join the organization when the address is verified, never at sign-up. Giving a role again to a reserved address updates the reservation instead of duplicating it. Written to the audit trail as `member.role.changed`, `member.invited` or `role.reserved`.',
      security: session,
      parameters: [orgId],
      requestBody: body('AssignOrganizationRoleInput'),
      responses: {
        '200': ok(
          'Applied to the account, or it already had the role.',
          ref('OrganizationRoleAssignment'),
          {
            outcome: 'APPLIED',
            email: 'lucia.agent@example.com',
            role: 'AGENT',
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
          ref('OrganizationRoleAssignment'),
          {
            outcome: 'RESERVED',
            email: 'new.hire@example.com',
            role: 'MEMBER',
            user: null,
            reservation: {
              id: '01a10712-4c1e-7b3d-a0f2-9be1d07c5a11',
              organizationId: '01a106f0-77aa-7c51-8d0e-5f3a2c9b1e42',
              email: 'new.hire@example.com',
              role: 'MEMBER',
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
        ...errs('400', '401', '403', '404', '409'),
      },
    }),
  },
  '/organizations/{organizationId}/role-grants/{grantId}': {
    delete: op({
      tag: 'Organizations',
      operationId: 'cancelOrganizationRoleReservation',
      summary: 'Cancel an organization role reservation',
      description:
        'ORG_ADMIN (or GLOBAL_ADMIN) only. The address no longer joins the organization when it is verified; recorded in the audit trail as `role.reservation.cancelled`. A reservation of another organization is a 404, like any resource of a tenant you cannot see.',
      security: session,
      parameters: [orgId, pathParam('grantId', 'Reservation id.')],
      responses: {
        '204': noContent('Reservation cancelled.'),
        ...errs('401', '403', '404'),
      },
    }),
  },
  '/organizations/{organizationId}/categories': {
    get: op({
      tag: 'Organizations',
      operationId: 'listCategories',
      summary: 'Categories',
      description:
        'Categories are per organization: two tenants can both have "Hardware" without sharing anything.',
      security: session,
      parameters: [orgId],
      responses: {
        '200': ok('Categories.', { type: 'array', items: ref('Category') }),
        ...errs('401', '404'),
      },
    }),
    post: op({
      tag: 'Organizations',
      operationId: 'createCategory',
      summary: 'Create a category',
      description: 'ORG_ADMIN only.',
      security: session,
      parameters: [orgId],
      requestBody: body('CreateCategoryInput'),
      responses: {
        '201': created('Category created.', ref('Category')),
        ...errs('400', '401', '403', '404', '409'),
      },
    }),
  },
  '/organizations/{organizationId}/categories/{categoryId}': {
    patch: op({
      tag: 'Organizations',
      operationId: 'updateCategory',
      summary: 'Edit a category',
      description: 'ORG_ADMIN only. Name and colour.',
      security: session,
      parameters: [orgId, pathParam('categoryId', 'Category to edit.')],
      requestBody: body('UpdateCategoryInput'),
      responses: {
        '200': ok('Updated category.', ref('Category')),
        ...errs('400', '401', '403', '404'),
      },
    }),
    delete: op({
      tag: 'Organizations',
      operationId: 'deleteCategory',
      summary: 'Delete a category',
      description:
        'ORG_ADMIN only. Tickets in it are left without a category, never deleted with it.',
      security: session,
      parameters: [orgId, pathParam('categoryId', 'Category to delete.')],
      responses: {
        '204': noContent('Category deleted.'),
        ...errs('401', '403', '404'),
      },
    }),
  },
  '/organizations/{organizationId}/stats': {
    get: op({
      tag: 'Organizations',
      operationId: 'organizationStats',
      summary: 'Organization statistics',
      description:
        'AGENT or ORG_ADMIN (a plain MEMBER gets 403). Tickets by status and by priority, the unassigned backlog and the average time to the first reply: the numbers behind the organization overview.',
      security: session,
      parameters: [orgId],
      responses: {
        '200': ok('Aggregated counters.', ref('OrganizationStats')),
        ...errs('401', '403', '404'),
      },
    }),
  },
  '/organizations/{organizationId}/api-keys': {
    get: op({
      tag: 'Organizations',
      operationId: 'listApiKeys',
      summary: 'API keys of the organization',
      description:
        'ORG_ADMIN only. Metadata and prefixes; the secrets are not stored in a readable form, so they cannot be listed.',
      security: session,
      parameters: [orgId],
      responses: {
        '200': ok('Keys.', { type: 'array', items: ref('ApiKey') }),
        ...errs('401', '403', '404'),
      },
    }),
    post: op({
      tag: 'Organizations',
      operationId: 'createApiKey',
      summary: 'Create an API key',
      description:
        'ORG_ADMIN only. **The full key comes back exactly once**: only the prefix and an Argon2id hash of the secret are kept, so a database dump does not hand over working keys. This is the key you paste into Authorize to use the Public API section of this page.',
      security: session,
      parameters: [orgId],
      requestBody: body('CreateApiKeyInput'),
      responses: {
        '201': created(
          'Key created. Copy the `key` field now.',
          ref('ApiKeyCreated'),
        ),
        ...errs('400', '401', '403', '404'),
      },
    }),
  },
  '/organizations/{organizationId}/api-keys/{id}': {
    delete: op({
      tag: 'Organizations',
      operationId: 'revokeApiKey',
      summary: 'Revoke an API key',
      description:
        'ORG_ADMIN only. Takes effect on the very next request made with it.',
      security: session,
      parameters: [orgId, { $ref: '#/components/parameters/IdPath' }],
      responses: {
        '204': noContent('Key revoked.'),
        ...errs('401', '403', '404'),
      },
    }),
  },
};
