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
      description: 'Members with their role and join date.',
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
        'ORG_ADMIN only. Invites by e-mail or username and sends the notification. Adding someone twice answers 409 instead of duplicating the membership.',
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
        '200': ok('Updated member.', ref('OrganizationMember')),
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
        'Counters by status, priority and category, plus resolution times. The data behind an analytics panel.',
      security: session,
      parameters: [orgId],
      responses: {
        '200': ok('Aggregated counters.', {
          type: 'object',
          properties: {
            tickets: {
              type: 'object',
              additionalProperties: { type: 'integer' },
              description: 'Tickets by status.',
            },
            priorities: {
              type: 'object',
              additionalProperties: { type: 'integer' },
            },
            members: { type: 'integer' },
            avgResolutionHours: { type: 'number', nullable: true },
          },
        }),
        ...errs('401', '404'),
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
