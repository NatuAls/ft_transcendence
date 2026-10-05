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

/** What a profile edit answers: the profile row as it is now. */
const profileFields = {
  type: 'object',
  properties: {
    displayName: {
      type: 'string',
      description: 'Rebuilt from first and last name when either changes.',
    },
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    bio: { type: 'string', nullable: true },
    jobTitle: { type: 'string', nullable: true },
    avatarUrl: { type: 'string', nullable: true },
  },
} as const;

const userId = pathParam('user', 'User identifier.');

export const usersPaths: Paths = {
  '/users': {
    get: op({
      tag: 'Users',
      operationId: 'listUsers',
      summary: 'List users (platform administration)',
      description:
        'Only for GLOBAL_ADMIN. Paginated and filterable; it is the backing list of the administration panel and of the platform roles screen (`globalRole=GLOBAL_ADMIN` lists the administrators). Accounts deleted by their owner are not listed. Each row carries `isPrimary`: the recovery administrator created at deployment, which the API refuses to suspend, demote or delete.',
      security: session,
      parameters: [
        { $ref: '#/components/parameters/Page' },
        { $ref: '#/components/parameters/Take' },
        query('q', 'Free text over username and e-mail.', {
          type: 'string',
          maxLength: 120,
        }),
        query('globalRole', 'Only users with this platform role.', {
          type: 'string',
          enum: ['USER', 'GLOBAL_ADMIN'],
        }),
        query('isActive', 'Only active or only suspended accounts.', {
          type: 'boolean',
        }),
        query('sort', 'Column to order by.', {
          type: 'string',
          enum: ['createdAt', 'username', 'email', 'lastLoginAt'],
          default: 'createdAt',
        }),
        query('order', 'Direction.', {
          type: 'string',
          enum: ['asc', 'desc'],
          default: 'desc',
        }),
      ],
      responses: {
        '200': listOf('AdminUser', 'Users.'),
        ...errs('400', '401', '403'),
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
        '200': ok('Updated profile.', profileFields),
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
        'Multipart upload, at most 5 MB. The type is detected from the magic bytes, and the image is re-encoded to WebP 512×512 and **stripped of EXIF**, so the picture cannot leak the GPS coordinates of where it was taken. The previous file, if any, is deleted.',
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
          properties: {
            avatarUrl: {
              type: 'string',
              example: '/api/v1/users/avatars/01a106fe-9dff.webp',
            },
          },
        }),
        // 413 `FILE_TOO_LARGE`: over 5 MB. 415 `FILE_TYPE_NOT_ALLOWED`: not a
        // PNG, JPEG, GIF or WebP. 422 `FILE_IMAGE_UNREADABLE`: the header says
        // image but the pixels cannot be decoded.
        ...errs('400', '401', '413', '415', '422'),
      },
    }),
    delete: op({
      tag: 'Users',
      operationId: 'deleteAvatar',
      summary: 'Remove my avatar',
      description:
        'Deletes the file - its old URL answers 404 from then on - and leaves `avatarUrl` null, which every client draws as the default avatar: the initials of the name.',
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
        'The segment here is the **username**, not the id: it is the URL a person can type. Returns only public fields - never the e-mail address - plus the organizations the user belongs to and activity counters.',
      security: session,
      parameters: [
        pathParam('user', 'Handle of the user.', { type: 'string' }),
      ],
      responses: {
        '200': ok('Public profile.', ref('PublicProfile')),
        ...errs('401', '404'),
      },
    }),
    patch: op({
      tag: 'Users',
      operationId: 'adminUpdateUser',
      summary: 'Edit a user (administration)',
      description:
        'GLOBAL_ADMIN only. The segment here is the user **id**. Corrects the first and last name; suspension and the platform role have their own routes below, with their own safeguards.',
      security: session,
      parameters: [userId],
      requestBody: body('AdminUpdateUserInput'),
      responses: {
        '200': ok('Updated profile.', profileFields),
        ...errs('400', '401', '403', '404'),
      },
    }),
    delete: op({
      tag: 'Users',
      operationId: 'adminDeleteUser',
      summary: 'Delete a user (administration)',
      description:
        'GLOBAL_ADMIN only, by user **id**. Soft delete: the account is disabled, its sessions revoked and it disappears from lists. Refused (403) on your own account and on the primary administrator. For the user-initiated path with e-mail confirmation, see the GDPR endpoints.',
      security: session,
      parameters: [userId],
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
        'GLOBAL_ADMIN only. A suspended account keeps its data but can no longer sign in, and its API keys stop working immediately. Refused (403) on your own account and, for a suspension, on the primary administrator. Written to the audit trail.',
      security: session,
      parameters: [userId],
      requestBody: body('SetUserStatusInput'),
      responses: {
        '200': ok('New status.', {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string' },
            isActive: { type: 'boolean' },
          },
        }),
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
        'GLOBAL_ADMIN only. USER or GLOBAL_ADMIN: the only dimension of role that lives outside an organization. Nobody changes their own platform role, and the primary administrator cannot be demoted (403). This is how the role is **taken back**; to give it by e-mail address - also to somebody who has no account yet - use `POST /admin/role-grants`. Written to the audit trail.',
      security: session,
      parameters: [userId],
      requestBody: body('SetGlobalRoleInput'),
      responses: {
        '200': ok('New role.', {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string' },
            globalRole: { type: 'string', enum: ['USER', 'GLOBAL_ADMIN'] },
          },
        }),
        ...errs('400', '401', '403', '404'),
      },
    }),
  },
};
