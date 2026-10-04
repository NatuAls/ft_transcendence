/**
 * ==============================================================================
 *  OpenAPI · schemas
 *
 *  Request bodies and query strings are NOT described by hand: they are the very
 *  Zod contracts the API validates with (`packages/contracts`), converted with
 *  Zod 4's native `toJSONSchema`. That is the whole point - documentation that
 *  cannot drift from validation, because both read the same object.
 *
 *  Response shapes have no Zod schema (they come from Prisma selects), so those
 *  ARE written here, mirroring what each service selects.
 * ==============================================================================
 */
import { z, type ZodType } from 'zod';
import * as contracts from 'contracts';

export type JsonSchema = Record<string, unknown>;

/**
 * A contract as an OpenAPI 3.0 schema.
 *
 * - `io: 'input'` because we document what the CLIENT sends: a field with a
 *   default is optional on the way in, required on the way out.
 * - `unrepresentable: 'any'` keeps a `z.custom()` or a transform from throwing
 *   at boot; it degrades to `{}` instead of taking the whole document down.
 * - The `override` collapses our uuid union (uuid v7 or any uuid) into a plain
 *   `string/uuid`: the regex pair is accurate but unreadable in the browser.
 */
export function fromContract(schema: ZodType): JsonSchema {
  return z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io: 'input',
    unrepresentable: 'any',
    override: (ctx) => {
      const node = ctx.jsonSchema as JsonSchema & {
        anyOf?: Array<{ format?: string; type?: string }>;
      };
      if (
        Array.isArray(node.anyOf) &&
        node.anyOf.length > 0 &&
        node.anyOf.every((v) => v.type === 'string' && v.format === 'uuid')
      ) {
        delete node.anyOf;
        node.type = 'string';
        node.format = 'uuid';
      }
    },
  }) as JsonSchema;
}

/** `$ref` to a component, so the browser shows the schema by name. */
export function ref(name: string): JsonSchema {
  return { $ref: `#/components/schemas/${name}` };
}

/**
 * A nullable reference. In OpenAPI 3.0 `nullable` cannot sit next to `$ref`
 * (the sibling is ignored by most tools), so it goes through `allOf`.
 */
export function nullableRef(name: string): JsonSchema {
  // `type` is redundant for a reference to an object, but OpenAPI 3.0 linters
  // require it next to `nullable`, and a document that a validator rejects is
  // a document half the tooling will refuse to read.
  return { type: 'object', nullable: true, allOf: [ref(name)] };
}

const str = (description: string, extra: JsonSchema = {}): JsonSchema => ({
  type: 'string',
  description,
  ...extra,
});
const uuid = (description: string): JsonSchema =>
  str(description, { format: 'uuid' });
const date = (description: string): JsonSchema =>
  str(description, { format: 'date-time' });
const int = (description: string, extra: JsonSchema = {}): JsonSchema => ({
  type: 'integer',
  description,
  ...extra,
});

function object(
  description: string,
  properties: Record<string, JsonSchema>,
  required: string[] = [],
): JsonSchema {
  return {
    type: 'object',
    description,
    properties,
    ...(required.length ? { required } : {}),
  };
}

// ---------------------------------------------------------------------------
// Envelopes shared by every response
// ---------------------------------------------------------------------------
const apiError = object(
  'Uniform error envelope. Every failure of this API - including the ones raised by the body parser or the rate limiter - comes back in this shape.',
  {
    statusCode: int(
      'HTTP status, repeated in the body for clients that only log the payload.',
      { example: 400 },
    ),
    code: str(
      'Stable machine-readable code. Switch on this, never on `message`.',
      { example: 'VALIDATION_FAILED' },
    ),
    messageKey: str(
      'Translation key. The frontend feeds it to i18next; it always starts with `errors.`.',
      { example: 'errors.common.validationFailed' },
    ),
    message: str(
      'English text, for logs and for clients without translations.',
    ),
    details: {
      type: 'array',
      description:
        'Only on 400 VALIDATION_FAILED: one entry per field that failed.',
      items: object('One invalid field.', {
        path: str(
          'Dotted path of the field, `(root)` for object-level rules.',
          { example: 'title' },
        ),
        code: str('Zod issue code.', { example: 'too_small' }),
        messageKey: str('Translation key for this field.', {
          example: 'errors.ticket.titleTooShort',
        }),
      }),
    },
    requestId: str(
      'Correlation id. It is also in the `X-Request-Id` header and in every log line of the request: quote it when reporting a problem.',
    ),
    timestamp: date('When the error was produced.'),
    path: str('Path that produced it.'),
  },
  [
    'statusCode',
    'code',
    'messageKey',
    'message',
    'requestId',
    'timestamp',
    'path',
  ],
);

const paginationMeta = object(
  'Pagination block returned by every list endpoint.',
  {
    total: int('Rows matching the filter, ignoring pagination.'),
    page: int('Current page, 1-based.'),
    take: int('Page size actually applied (never above 100).'),
    pages: int('Number of pages for the current `take`.'),
    nextCursor: {
      ...str(
        'Opaque cursor for the next page, when the endpoint supports cursor pagination.',
      ),
      nullable: true,
    },
  },
);

// ---------------------------------------------------------------------------
// Domain entities, mirroring what the services select
// ---------------------------------------------------------------------------
const userSummary = object(
  'Minimal user, embedded wherever an author, an actor or an assignee appears.',
  {
    id: uuid('User id.'),
    username: str('Unique handle. Immutable after sign-up.'),
    profile: object('Public profile.', {
      displayName: { ...str('Name shown in the interface.'), nullable: true },
      avatarUrl: {
        ...str('Avatar URL, or null when the user never uploaded one.'),
        nullable: true,
      },
    }),
  },
);

/** The same person with live presence, wherever the interface draws the dot. */
const userWithPresence = object(
  'A user with live presence: friends, friend requests and conversations.',
  {
    id: uuid('User id.'),
    username: str('Unique handle.'),
    profile: object('Public profile.', {
      displayName: { ...str('Name shown in the interface.'), nullable: true },
      avatarUrl: {
        ...str('Avatar URL, or null when the user never uploaded one.'),
        nullable: true,
      },
      isOnline: {
        type: 'boolean',
        description:
          'Connected right now. Kept by the realtime layer, which waits a few seconds after the last tab closes so a reload does not make the dot blink; the change is pushed live as `presence.changed`.',
      },
      lastSeenAt: {
        ...date('Last time the user was connected.'),
        nullable: true,
      },
    }),
  },
);

/** `GET /users/{username}`: flat, and only what a profile page shows. */
const publicProfile = object(
  'Public profile of a user, as any signed-in user may read it.',
  {
    id: uuid('User id.'),
    username: str('Handle.'),
    displayName: str('Name shown in the interface; the username when none.'),
    avatarUrl: {
      ...str('Avatar URL. Null: the interface draws the initials instead.'),
      nullable: true,
    },
    bio: { ...str('Free text of the profile.'), nullable: true },
    jobTitle: { ...str('Job title.'), nullable: true },
    isOnline: { type: 'boolean', description: 'Live presence.' },
    lastSeenAt: { ...date('Last time connected.'), nullable: true },
    createdAt: date('Sign-up date.'),
    organizations: {
      type: 'array',
      description: 'Organizations the user belongs to, with the role in each.',
      items: object('Organization.', {
        id: uuid('Organization id.'),
        name: str('Name.'),
        slug: str('Slug.'),
        role: str('Role there.', { enum: ['MEMBER', 'AGENT', 'ORG_ADMIN'] }),
      }),
    },
    stats: object('Activity counters.', {
      ticketsCreated: int('Tickets reported.'),
      ticketsAssigned: int('Tickets assigned to the user.'),
      comments: int('Comments written.'),
    }),
  },
);

/** A row of `GET /users`: what the administration table draws. */
const adminUser = object('A user as the platform administration lists it.', {
  id: uuid('User id.'),
  username: str('Handle.'),
  email: str('E-mail address.', { format: 'email' }),
  globalRole: str('Platform role.', { enum: ['USER', 'GLOBAL_ADMIN'] }),
  isActive: {
    type: 'boolean',
    description: 'False when suspended: the account cannot sign in.',
  },
  createdAt: date('Sign-up date.'),
  lastLoginAt: { ...date('Last successful sign-in.'), nullable: true },
  emailVerifiedAt: {
    ...date(
      'When the address was confirmed. Null while it is not: a role reserved for the address is still waiting for it.',
    ),
    nullable: true,
  },
  profile: object('Profile.', {
    displayName: { ...str('Name shown in the interface.'), nullable: true },
    avatarUrl: { ...str('Avatar URL.'), nullable: true },
    isOnline: { type: 'boolean', description: 'Live presence.' },
  }),
  _count: object('Counters.', {
    memberships: int('Organizations the user belongs to.'),
    ticketsCreated: int('Tickets reported.'),
  }),
  isPrimary: {
    type: 'boolean',
    description:
      'The recovery administrator created at deployment. The API refuses to suspend, demote or delete it, so the interface hides those actions.',
  },
});

/** What `GET /auth/me` answers: flat, and with everything the session needs. */
const currentUser = object('The caller, as the server sees them.', {
  id: uuid('User id.'),
  username: str('Handle.'),
  email: str('E-mail address.', { format: 'email' }),
  emailVerified: {
    type: 'boolean',
    description: 'Whether the verification link has been followed.',
  },
  displayName: str('Name shown in the interface; the username when none.'),
  firstName: str('First name. Empty string when unknown.'),
  lastName: str('Last name. Empty string when unknown.'),
  avatarUrl: {
    ...str('Avatar URL. Null: the interface draws the initials instead.'),
    nullable: true,
  },
  bio: { ...str('Free text of the profile.'), nullable: true },
  jobTitle: { ...str('Job title.'), nullable: true },
  locale: str('Interface language stored for this user.', {
    enum: ['EN', 'ES', 'CA'],
  }),
  timezone: str('IANA timezone.', { example: 'Europe/Madrid' }),
  globalRole: str('Platform role.', { enum: ['USER', 'GLOBAL_ADMIN'] }),
  isOnline: {
    type: 'boolean',
    description: 'Live presence, kept by the realtime layer.',
  },
  lastSeenAt: { ...date('Last time the user was connected.'), nullable: true },
  memberships: {
    type: 'array',
    description:
      'Organizations the user belongs to, with their role in each. This is what the interface uses to decide what to show.',
    items: object('Membership.', {
      organizationId: uuid('Organization.'),
      organizationName: str('Its name.'),
      organizationSlug: str('Its slug.'),
      role: str('Role.', { enum: ['MEMBER', 'AGENT', 'ORG_ADMIN'] }),
    }),
  },
  permissions: {
    type: 'array',
    description:
      'Flattened capabilities of the caller, so the client does not have to re-derive the RBAC matrix.',
    items: str('Capability.'),
  },
  pendingRoles: {
    type: 'array',
    description:
      'Roles an administrator reserved for this address, waiting for it to be verified. Always empty once it is.',
    items: object('Reserved role.', {
      scope: str('Level.', { enum: ['PLATFORM', 'ORGANIZATION'] }),
      role: str('Role.', {
        enum: ['GLOBAL_ADMIN', 'MEMBER', 'AGENT', 'ORG_ADMIN'],
      }),
      organizationName: {
        ...str('Organization, for an organization role.'),
        nullable: true,
      },
    }),
  },
  createdAt: date('Sign-up date.'),
});

const ticket = object(
  'A ticket, in its detail representation (create, read by id, update).',
  {
    id: uuid('Ticket id.'),
    reference: str('Human reference shown in the interface.', {
      example: 'HD-0242',
    }),
    title: str('Title.'),
    description: str('Body of the request, as written by the reporter.'),
    status: str('Current state of the ticket.', {
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'],
    }),
    priority: str('Priority.', { enum: ['LOW', 'MEDIUM', 'HIGH'] }),
    organizationId: uuid('Organization the ticket belongs to.'),
    category: {
      type: 'object',
      nullable: true,
      allOf: [ref('Category')],
      description: 'Category, when classified.',
    },
    createdBy: ref('UserSummary'),
    assignedTo: nullableRef('UserSummary'),
    resolution: {
      ...str('Resolution text, required to move a ticket to RESOLVED.'),
      nullable: true,
    },
    createdAt: date('Creation timestamp.'),
    updatedAt: date('Last modification.'),
    firstResponseAt: {
      ...date('First reply of an agent: the response-time metric.'),
      nullable: true,
    },
    resolvedAt: { ...date('When it was resolved.'), nullable: true },
    closedAt: { ...date('When it was closed.'), nullable: true },
    _count: object('Counters embedded so a list does not need N extra calls.', {
      comments: int('Comments.'),
      attachments: int('Attachments.'),
    }),
  },
);

/**
 * A row of the SEARCH result. It is flat and denormalised on purpose - the
 * query returns exactly what a table draws, with no nested object to walk - so
 * it is a different shape from the detail above, and pretending otherwise here
 * would be a lie the first `curl` would expose.
 */
const ticketListItem = object('A ticket as the search returns it.', {
  id: uuid('Ticket id.'),
  reference: str('Human reference.', { example: 'HD-0242' }),
  title: str('Title.'),
  status: str('State.', {
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'],
  }),
  priority: str('Priority.', { enum: ['LOW', 'MEDIUM', 'HIGH'] }),
  organizationId: uuid('Organization.'),
  categoryName: { ...str('Category name, already resolved.'), nullable: true },
  categoryColor: { ...str('Category colour.'), nullable: true },
  authorUsername: str('Reporter handle.'),
  authorDisplayName: { ...str('Reporter name.'), nullable: true },
  assigneeUsername: { ...str('Assignee handle.'), nullable: true },
  assigneeDisplayName: { ...str('Assignee name.'), nullable: true },
  commentCount: int('Comments.'),
  attachmentCount: int('Attachments.'),
  rank: {
    type: 'number',
    nullable: true,
    description: 'Full-text relevance, only present when `q` was used.',
  },
  createdAt: date('Creation timestamp.'),
  updatedAt: date('Last modification.'),
});

const comment = object('A comment on a ticket.', {
  id: uuid('Comment id.'),
  body: str('Comment text.'),
  isInternal: {
    type: 'boolean',
    description:
      'Internal note: only AGENT and above can read it. It is filtered out server-side for a plain MEMBER, not hidden by the interface.',
  },
  author: ref('UserSummary'),
  createdAt: date('Creation timestamp.'),
  updatedAt: date(
    'Last modification. Differs from `createdAt` when the comment was edited.',
  ),
});

const attachment = object('A file attached to a ticket.', {
  id: uuid('Attachment id.'),
  filename: str('Original file name.'),
  mimeType: str(
    'Type detected from the file MAGIC BYTES, not from the extension or the header the client sent.',
  ),
  size: int('Size in bytes.'),
  checksum: str('SHA-256 of the stored file.'),
  thumbnailUrl: { ...str('WebP thumbnail for images.'), nullable: true },
  uploadedBy: ref('UserSummary'),
  createdAt: date('Upload timestamp.'),
});

const organization = object('An organization (tenant).', {
  id: uuid('Organization id.'),
  name: str('Display name.'),
  slug: str('URL-safe identifier, unique across the platform.'),
  description: { ...str('Free text.'), nullable: true },
  createdById: { ...uuid('Who created it.'), nullable: true },
  myRole: {
    ...str(
      'Caller role inside this organization. Null for a platform admin who is not a member.',
    ),
    enum: ['MEMBER', 'AGENT', 'ORG_ADMIN'],
    nullable: true,
  },
  createdAt: date('Creation timestamp.'),
  _count: object('Counters, when the endpoint includes them.', {
    members: int('Members.'),
    tickets: int('Tickets.'),
    categories: int('Categories.'),
  }),
});

const member = object(
  "Membership of a user in an organization. Accounts deleted by their owner are not listed: they are nobody's colleague any more.",
  {
    id: uuid('Membership id.'),
    role: str('Role inside the organization.', {
      enum: ['MEMBER', 'AGENT', 'ORG_ADMIN'],
    }),
    joinedAt: date('When the user joined.'),
    organizationId: uuid(
      'Organization. Present in the answer to adding a member.',
    ),
    user: object('The member.', {
      id: uuid('User id: the `{userId}` of the member routes.'),
      username: str('Handle.'),
      email: str('E-mail address.', { format: 'email' }),
      profile: object('Profile.', {
        displayName: { ...str('Name shown in the interface.'), nullable: true },
        avatarUrl: { ...str('Avatar URL.'), nullable: true },
        isOnline: {
          type: 'boolean',
          description: 'Live presence. Only in the member list.',
        },
        lastSeenAt: {
          ...date('Last time connected. Only in the member list.'),
          nullable: true,
        },
      }),
    }),
  },
);

const organizationStats = object(
  'Ticket counters of one organization: the numbers behind its overview.',
  {
    total: int('Tickets in the organization.'),
    unassigned: int('OPEN or IN_PROGRESS tickets nobody is assigned to.'),
    byStatus: {
      type: 'object',
      description: 'Tickets per status. A status with no ticket is absent.',
      additionalProperties: { type: 'integer' },
      example: { OPEN: 4, IN_PROGRESS: 2, RESOLVED: 7 },
    },
    byPriority: {
      type: 'object',
      description: 'Tickets per priority. A priority with no ticket is absent.',
      additionalProperties: { type: 'integer' },
      example: { LOW: 3, MEDIUM: 6, HIGH: 4 },
    },
    avgFirstResponseSeconds: int(
      'Average time to the first agent reply, in seconds. 0 when no ticket has one yet.',
    ),
  },
);

const category = object('Ticket category, scoped to one organization.', {
  id: uuid('Category id.'),
  name: str('Name.'),
  color: str('Hex colour used by the interface.', { example: '#0d6c90' }),
  description: { ...str('Free text.'), nullable: true },
  isActive: {
    type: 'boolean',
    description:
      'An inactive category stays for old tickets but is not offered for new ones.',
  },
  _count: object('Counters.', { tickets: int('Tickets in this category.') }),
});

const notification = object('A notification for one user.', {
  id: uuid('Notification id.'),
  entity: str('Entity the event is about.', { example: 'Ticket' }),
  action: str('What happened to it.', { example: 'assigned' }),
  entityId: { ...uuid('Identifier of that entity.'), nullable: true },
  organizationId: { ...uuid('Organization it belongs to.'), nullable: true },
  titleKey: str(
    'Translation key: the TEXT is not stored, so an old notification is read in the language the user picks today.',
    { example: 'notifications.ticket.assigned' },
  ),
  payload: {
    type: 'object',
    description:
      'Interpolation values for the key (ticket reference, actor name...).',
    additionalProperties: true,
  },
  actor: nullableRef('UserSummary'),
  readAt: { ...date('When the user read it.'), nullable: true },
  createdAt: date('Creation timestamp.'),
});

const friend = object('An accepted friendship, seen from the caller.', {
  friendshipId: uuid('Friendship id.'),
  since: date('When the request was sent.'),
  user: ref('UserWithPresence'),
});

const friendRequests = object('Pending requests, in both directions.', {
  incoming: {
    type: 'array',
    description:
      'Sent to the caller: answer them with `PATCH /friends/requests/{id}`.',
    items: object('Received request.', {
      id: uuid('Request id.'),
      createdAt: date('Sent at.'),
      requester: ref('UserWithPresence'),
    }),
  },
  outgoing: {
    type: 'array',
    description: 'Sent by the caller and not answered yet.',
    items: object('Sent request.', {
      id: uuid('Request id.'),
      createdAt: date('Sent at.'),
      addressee: ref('UserWithPresence'),
    }),
  },
});

const friendship = object('A friendship, as it is after the change.', {
  id: uuid('Friendship id: the `{id}` of `PATCH /friends/requests/{id}`.'),
  status: str('State.', { enum: ['PENDING', 'ACCEPTED', 'DECLINED'] }),
  requesterId: uuid('Who asked.'),
  addresseeId: uuid('Who was asked.'),
});

const conversation = object('A 1-to-1 conversation.', {
  id: uuid('Conversation id.'),
  participant: ref('UserSummary'),
  lastMessage: {
    ...object('Last message, for the list view.', {
      body: str('Text.'),
      createdAt: date('When.'),
      senderId: uuid('Author.'),
    }),
    nullable: true,
  },
  lastMessageAt: { ...date('Timestamp of the last message.'), nullable: true },
  unreadCount: int('Messages the caller has not read.'),
});

const message = object('A chat message.', {
  id: uuid('Message id.'),
  conversationId: uuid('Conversation it belongs to.'),
  body: str('Text.'),
  sender: ref('UserSummary'),
  createdAt: date('Sent at.'),
  editedAt: { ...date('Edited at.'), nullable: true },
});

const scopeList = {
  type: 'array',
  description:
    'What the key may do. Every public endpoint declares the scope it needs.',
  items: str('Scope.', {
    enum: [
      'tickets:read',
      'tickets:write',
      'comments:read',
      'comments:write',
      'categories:read',
      'categories:write',
      'stats:read',
    ],
  }),
} as const;

const apiKey = object('An API key of the public API, as it is listed.', {
  id: uuid('Key id.'),
  name: str('Label chosen when creating it.'),
  prefix: str(
    'Public prefix, stored in clear so the row is found in one lookup.',
    { example: 'a1b2c3d4' },
  ),
  scopes: { ...scopeList },
  rateLimitPerMinute: int('Per-key limit applied on top of the global one.'),
  lastUsedAt: {
    ...date(
      'Last time the key was used. An integration that stops calling shows up here.',
    ),
    nullable: true,
  },
  expiresAt: { ...date('Expiry, when set.'), nullable: true },
  revokedAt: { ...date('Revocation, when revoked.'), nullable: true },
  createdAt: date('Creation timestamp.'),
  createdBy: object('Who created it.', { username: str('Handle.') }),
});

const apiKeyCreated = object(
  'Answer to key creation. The secret travels ONCE and never again: only its Argon2id hash is stored, so a database dump does not hand over working keys.',
  {
    id: uuid('Key id.'),
    name: str('Label.'),
    prefix: str('Public prefix.', { example: 'a1b2c3d4' }),
    scopes: { ...scopeList },
    expiresAt: { ...date('Expiry, when set.'), nullable: true },
    createdAt: date('Creation timestamp.'),
    secret: str(
      'The full key: `hdl_live_<prefix>.<secret>`. Copy it now - this is the value for the `X-API-Key` header and for the Authorize button of this page.',
      { example: 'hdl_live_a1b2c3d4.7Jw0ITKj2OtHOqCDosb_iIffj' },
    ),
  },
);

const auditLog = object(
  'An entry of the audit trail. The before and after states are stored with it (never with password hashes or tokens) but the list does not return them.',
  {
    id: uuid('Entry id.'),
    action: str(
      'What happened. Accounts: `user.created`, `user.role.changed`, `user.status.changed`, `user.password.rotated`, `user.deleted`. Organizations: `organization.created`, `organization.updated`, `organization.deleted`, `member.invited`, `member.role.changed`, `member.removed`. Roles given by e-mail: `role.reserved`, `role.reservation.cancelled`, `role.reservation.claimed`. Credentials: `apiKey.created`, `apiKey.revoked`. Privacy: `gdpr.export.confirmed`, `gdpr.delete.confirmed`.',
      { example: 'role.reserved' },
    ),
    entity: str(
      'Entity type: `User`, `Organization`, `OrganizationMember`, `PlatformRoleGrant`, `OrganizationRoleGrant`, `ApiKey` or `GdprRequest`.',
      { example: 'PlatformRoleGrant' },
    ),
    entityId: { ...uuid('Entity id.'), nullable: true },
    ip: { ...str('Source address.'), nullable: true },
    createdAt: date('When.'),
    actor: {
      ...object('Who did it. Null for the system or a deleted account.', {
        id: uuid('User id.'),
        username: str('Handle.'),
      }),
      nullable: true,
    },
  },
);

const healthStatus = object(
  'Public status page payload: functional areas, never internal detail.',
  {
    overall: str('Aggregated state.', {
      enum: ['operational', 'degraded', 'down'],
    }),
    areas: {
      type: 'array',
      description:
        'One entry per user-visible area. Which component broke is deliberately not said here.',
      items: object('Area.', {
        area: str('Area name.', { example: 'tickets' }),
        status: str('State.', { example: 'operativo' }),
      }),
    },
    checkedAt: date('When the state was computed.'),
  },
);

// ---------------------------------------------------------------------------
// Role assignment by e-mail (platform and organization level)
// ---------------------------------------------------------------------------
const roleGrantor = {
  ...object('Administrator who established the link.', {
    id: uuid('User id.'),
    username: str('Handle.'),
    displayName: str('Name shown in the interface.'),
  }),
  nullable: true,
};

const waitingForField = str(
  '`ACCOUNT`: nobody has registered this address yet. `VERIFICATION`: an account has it, but the address has not been confirmed. The role reaches the account the moment it is.',
  { enum: ['ACCOUNT', 'VERIFICATION'] },
);

const platformRoleReservation = object(
  'A platform role reserved for an e-mail address that has no verified account yet.',
  {
    id: uuid('Reservation id.'),
    email: str('Address the role is reserved for.', { format: 'email' }),
    globalRole: str('Reserved platform role.', { enum: ['GLOBAL_ADMIN'] }),
    waitingFor: waitingForField,
    grantedBy: roleGrantor,
    createdAt: date('When the link was established.'),
    updatedAt: date('Last change of the reserved role.'),
  },
);

const organizationRoleReservation = object(
  'An organization role reserved for an e-mail address that has no verified account yet.',
  {
    id: uuid('Reservation id.'),
    organizationId: uuid('Organization.'),
    email: str('Address the role is reserved for.', { format: 'email' }),
    role: str('Reserved organization role.', {
      enum: ['MEMBER', 'AGENT', 'ORG_ADMIN'],
    }),
    waitingFor: waitingForField,
    grantedBy: roleGrantor,
    createdAt: date('When the link was established.'),
    updatedAt: date('Last change of the reserved role.'),
  },
);

const assignmentAccount = {
  ...object('The account the role reached. Null when it was reserved.', {
    id: uuid('User id.'),
    username: str('Handle.'),
    displayName: str('Name shown in the interface.'),
  }),
  nullable: true,
};

const outcomeField = str(
  '`APPLIED`: a verified account had the address and its role changed now. `UNCHANGED`: it already had that role. `RESERVED`: no verified account yet; the role waits for one.',
  { enum: ['APPLIED', 'UNCHANGED', 'RESERVED'] },
);

const platformRoleAssignment = object('Result of a platform role assignment.', {
  outcome: outcomeField,
  email: str('Address.', { format: 'email' }),
  globalRole: str('Assigned platform role.', { enum: ['GLOBAL_ADMIN'] }),
  user: assignmentAccount,
  reservation: nullableRef('PlatformRoleReservation'),
});

const organizationRoleAssignment = object(
  'Result of an organization role assignment.',
  {
    outcome: outcomeField,
    email: str('Address.', { format: 'email' }),
    role: str('Assigned organization role.', {
      enum: ['MEMBER', 'AGENT', 'ORG_ADMIN'],
    }),
    user: assignmentAccount,
    reservation: nullableRef('OrganizationRoleReservation'),
  },
);

/** Everything that ends up in `components.schemas`. */
export const componentSchemas: Record<string, JsonSchema> = {
  ApiError: apiError,
  PaginationMeta: paginationMeta,
  UserSummary: userSummary,
  UserWithPresence: userWithPresence,
  PublicProfile: publicProfile,
  AdminUser: adminUser,
  CurrentUser: currentUser,
  Ticket: ticket,
  TicketListItem: ticketListItem,
  TicketComment: comment,
  Attachment: attachment,
  Organization: organization,
  OrganizationMember: member,
  OrganizationStats: organizationStats,
  Category: category,
  Notification: notification,
  Friend: friend,
  FriendRequests: friendRequests,
  Friendship: friendship,
  Conversation: conversation,
  ChatMessage: message,
  ApiKey: apiKey,
  ApiKeyCreated: apiKeyCreated,
  AuditLog: auditLog,
  HealthStatus: healthStatus,
  PlatformRoleReservation: platformRoleReservation,
  OrganizationRoleReservation: organizationRoleReservation,
  PlatformRoleAssignment: platformRoleAssignment,
  OrganizationRoleAssignment: organizationRoleAssignment,

  // --- request bodies, straight from the contracts -------------------------
  RegisterInput: fromContract(contracts.registerSchema),
  LoginInput: fromContract(contracts.loginSchema),
  ChangePasswordInput: fromContract(contracts.changePasswordSchema),
  ForgotPasswordInput: fromContract(contracts.forgotPasswordSchema),
  ResetPasswordInput: fromContract(contracts.resetPasswordSchema),
  UpdateProfileInput: fromContract(contracts.updateProfileSchema),
  UpdatePreferencesInput: fromContract(contracts.updatePreferencesSchema),
  CreateOrganizationInput: fromContract(contracts.createOrganizationSchema),
  UpdateOrganizationInput: fromContract(contracts.updateOrganizationSchema),
  InviteMemberInput: fromContract(contracts.inviteMemberSchema),
  UpdateMemberRoleInput: fromContract(contracts.updateMemberRoleSchema),
  CreateCategoryInput: fromContract(contracts.createCategorySchema),
  UpdateCategoryInput: fromContract(contracts.updateCategorySchema),
  CreateTicketInput: fromContract(contracts.createTicketSchema),
  // The public API injects the organization from the key, so its body is the
  // same contract minus that field: documenting the full one would show a
  // required property that the endpoint ignores.
  CreateTicketPublicInput: fromContract(
    contracts.createTicketSchema.omit({ organizationId: true }),
  ),
  UpdateTicketInput: fromContract(contracts.updateTicketSchema),
  ChangeStatusInput: fromContract(contracts.changeStatusSchema),
  AssignTicketInput: fromContract(contracts.assignTicketSchema),
  CreateCommentInput: fromContract(contracts.createCommentSchema),
  CreateApiKeyInput: fromContract(contracts.createApiKeySchema),
  GdprRequestInput: fromContract(contracts.gdprRequestSchema),
  GdprConfirmInput: fromContract(contracts.gdprConfirmSchema),
  UpdateCommentInput: fromContract(contracts.updateCommentSchema),
  SendFriendRequestInput: fromContract(contracts.sendFriendRequestSchema),
  RespondFriendRequestInput: fromContract(contracts.respondFriendRequestSchema),
  OpenConversationInput: fromContract(contracts.openConversationSchema),
  SendMessageInput: fromContract(contracts.sendMessageSchema),
  MarkReadInput: fromContract(contracts.markReadSchema),
  VerifyEmailInput: fromContract(contracts.verifyEmailSchema),
  AdminUpdateUserInput: fromContract(contracts.adminUpdateUserSchema),
  SetGlobalRoleInput: fromContract(contracts.setGlobalRoleSchema),
  SetUserStatusInput: fromContract(contracts.setUserStatusSchema),
  AssignPlatformRoleInput: fromContract(contracts.assignPlatformRoleSchema),
  AssignOrganizationRoleInput: fromContract(
    contracts.assignOrganizationRoleSchema,
  ),
};
