import {
  op,
  ok,
  noContent,
  errs,
  body,
  session,
  open,
  pathParam,
  query,
  listOf,
  type Paths,
} from './_helpers.ts';
import { ref } from '../schemas.ts';

const preferences = {
  type: 'object',
  properties: {
    locale: {
      type: 'string',
      enum: ['EN', 'ES', 'CA'],
      description:
        'Interface language. The API stores it; the client decides what to do with it.',
    },
    timezone: { type: 'string', example: 'Europe/Madrid' },
    theme: { type: 'string', enum: ['LIGHT', 'DARK', 'SYSTEM'] },
    notifyOnTicketUpdate: { type: 'boolean' },
    notifyOnComment: { type: 'boolean' },
    notifyOnMention: { type: 'boolean' },
    notifyOnMessage: { type: 'boolean' },
    notifyOnFriendship: { type: 'boolean' },
  },
} as const;

export const usersPaths: Paths = {
  '/users': {
    get: op({
      tag: 'Users',
      operationId: 'listUsers',
      summary: 'List users (platform administration)',
      description:
        'Only for GLOBAL_ADMIN. Paginated and filterable; it is the backing list of the administration panel.',
      security: session,
      parameters: [
        { $ref: '#/components/parameters/Page' },
        { $ref: '#/components/parameters/Take' },
        query('q', 'Free text over username, name and e-mail.'),
        query('isActive', 'Only active or only suspended accounts.', {
          type: 'boolean',
        }),
      ],
      responses: {
        '200': listOf('UserSummary', 'Users.'),
        ...errs('401', '403'),
      },
    }),
  },
  '/users/search': {
    get: op({
      tag: 'Users',
      operationId: 'searchUsers',
      summary: 'Search users',
      description:
        'Typeahead for mentions, assignment and invitations. Returns only what a profile shows in public.',
      security: session,
      parameters: [
        query(
          'q',
          'Text to match against username and display name.',
          { type: 'string' },
          { required: true },
        ),
      ],
      responses: {
        '200': ok('Matches.', { type: 'array', items: ref('UserSummary') }),
        ...errs('400', '401'),
      },
    }),
  },
  '/users/me': {
    patch: op({
      tag: 'Users',
      operationId: 'updateProfile',
      summary: 'Update my profile',
      description:
        'Display name, first and last name, bio, job title and timezone. The username is not here: it is immutable by design.',
      security: session,
      requestBody: body('UpdateProfileInput'),
      responses: {
        '200': ok('Updated profile.', ref('UserSummary')),
        ...errs('400', '401'),
      },
    }),
  },
  '/users/me/preferences': {
    get: op({
      tag: 'Users',
      operationId: 'getPreferences',
      summary: 'My preferences',
      description:
        'Language, timezone, theme and the five notification switches.',
      security: session,
      responses: {
        '200': ok('Current preferences.', preferences),
        ...errs('401'),
      },
    }),
    patch: op({
      tag: 'Users',
      operationId: 'updatePreferences',
      summary: 'Update my preferences',
      description: 'Partial update: only the keys sent are changed.',
      security: session,
      requestBody: body('UpdatePreferencesInput'),
      responses: {
        '200': ok('Updated preferences.', preferences),
        ...errs('400', '401'),
      },
    }),
  },
  '/users/me/avatar': {
    put: op({
      tag: 'Users',
      operationId: 'uploadAvatar',
      summary: 'Upload my avatar',
      description:
        'Multipart upload. The image is re-encoded to WebP 512×512 and **stripped of EXIF**, so the picture cannot leak the GPS coordinates of where it was taken.',
      security: session,
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                file: {
                  type: 'string',
                  format: 'binary',
                  description: 'PNG, JPEG or WebP.',
                },
              },
              required: ['file'],
            },
          },
        },
      },
      responses: {
        '200': ok('New avatar URL.', {
          type: 'object',
          properties: { avatarUrl: { type: 'string' } },
        }),
        ...errs('400', '401'),
      },
    }),
    delete: op({
      tag: 'Users',
      operationId: 'deleteAvatar',
      summary: 'Remove my avatar',
      description:
        'Deletes the file and leaves `avatarUrl` null; the interface falls back to initials.',
      security: session,
      responses: {
        '200': ok('Avatar removed.', {
          type: 'object',
          properties: { avatarUrl: { type: 'string', nullable: true } },
        }),
        ...errs('401'),
      },
    }),
  },
  '/users/avatars/{key}': {
    get: op({
      tag: 'Users',
      operationId: 'getAvatar',
      summary: 'Download an avatar',
      description:
        'Serves the stored image by its opaque key. Public on purpose: the key carries no identity and avatars are shown in every list.',
      security: open,
      parameters: [pathParam('key', 'Opaque file key.', { type: 'string' })],
      responses: {
        '200': {
          description: 'The image.',
          content: {
            'image/webp': { schema: { type: 'string', format: 'binary' } },
          },
        },
        ...errs('404'),
      },
    }),
  },
  // One template, three operations: the server answers `GET /users/:username`
  // and `PATCH|DELETE /users/:id` on the same URL shape, so OpenAPI - which
  // keys paths by template, not by parameter name - has to describe them
  // together. Each operation says what its segment really is.
  '/users/{user}': {
    get: op({
      tag: 'Users',
      operationId: 'getPublicProfile',
      summary: 'Public profile',
      description:
        'The segment here is the **username**, not the id: it is the URL a person can type. Returns only public fields.',
      security: session,
      parameters: [
        pathParam('user', 'Handle of the user.', { type: 'string' }),
      ],
      responses: {
        '200': ok('Public profile.', ref('UserSummary')),
        ...errs('401', '404'),
      },
    }),
    patch: op({
      tag: 'Users',
      operationId: 'adminUpdateUser',
      summary: 'Edit a user (administration)',
      description:
        'GLOBAL_ADMIN only. The segment here is the user **id**. Every change is written to the audit trail with before and after.',
      security: session,
      parameters: [pathParam('user', 'User identifier.')],
      requestBody: body('AdminUpdateUserInput'),
      responses: {
        '200': ok('Updated user.', ref('UserSummary')),
        ...errs('400', '401', '403', '404'),
      },
    }),
    delete: op({
      tag: 'Users',
      operationId: 'adminDeleteUser',
      summary: 'Delete a user (administration)',
      description:
        'GLOBAL_ADMIN only, by user **id**. For the user-initiated path with e-mail confirmation, see the GDPR endpoints.',
      security: session,
      parameters: [pathParam('user', 'User identifier.')],
      responses: {
        '204': noContent('User deleted.'),
        ...errs('401', '403', '404'),
      },
    }),
  },
  '/users/{user}/status': {
    patch: op({
      tag: 'Users',
      operationId: 'setUserStatus',
      summary: 'Activate or suspend a user',
      description:
        'A suspended account keeps its data but can no longer sign in, and its API keys stop working immediately.',
      security: session,
      parameters: [pathParam('user', 'User identifier.')],
      requestBody: body('SetUserStatusInput'),
      responses: {
        '200': ok('New status.', ref('UserSummary')),
        ...errs('400', '401', '403', '404'),
      },
    }),
  },
  '/users/{user}/role': {
    patch: op({
      tag: 'Users',
      operationId: 'setGlobalRole',
      summary: 'Change the platform role',
      description:
        'USER or GLOBAL_ADMIN. This is the only dimension of role that lives outside an organization.',
      security: session,
      parameters: [pathParam('user', 'User identifier.')],
      requestBody: body('SetGlobalRoleInput'),
      responses: {
        '200': ok('New role.', ref('UserSummary')),
        ...errs('400', '401', '403', '404'),
      },
    }),
  },
};
