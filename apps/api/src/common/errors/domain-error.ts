/**
 * Every deliberate failure in the system is one of these. The global error
 * handler middleware turns it into the uniform error envelope described by
 * `ApiErrorBody` (packages/contracts). `messageKey` is what the frontend
 * translates; `message` is English and only ever seen in logs and curl output.
 */
export class DomainError extends Error {
  readonly code: string;
  readonly messageKey: string;
  readonly status: number;
  readonly details?: Array<{ path: string; code: string; messageKey: string }>;

  constructor(
    code: string,
    messageKey: string,
    message: string,
    status: number,
    details?: Array<{ path: string; code: string; messageKey: string }>,
  ) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.messageKey = messageKey;
    this.status = status;
    this.details = details;
  }
}

const HttpStatus = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
} as const;

const err =
  (status: number) =>
  (
    code: string,
    messageKey: string,
    message: string,
    details?: DomainError['details'],
  ) =>
    new DomainError(code, messageKey, message, status, details);

export const badRequest = err(HttpStatus.BAD_REQUEST);
export const unauthorized = err(HttpStatus.UNAUTHORIZED);
export const forbidden = err(HttpStatus.FORBIDDEN);
export const notFound = err(HttpStatus.NOT_FOUND);
export const conflict = err(HttpStatus.CONFLICT);
export const payloadTooLarge = err(HttpStatus.PAYLOAD_TOO_LARGE);
export const unsupportedMedia = err(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
export const unprocessable = err(HttpStatus.UNPROCESSABLE_ENTITY);
export const tooManyRequests = err(HttpStatus.TOO_MANY_REQUESTS);

/** Catalogue of the errors the domain can raise. Keeps codes consistent. */
export const Errors = {
  // auth
  invalidCredentials: () =>
    unauthorized(
      'AUTH_INVALID_CREDENTIALS',
      'errors.auth.invalidCredentials',
      'Invalid email or password.',
    ),
  accountLocked: (until: Date) =>
    tooManyRequests(
      'AUTH_ACCOUNT_LOCKED',
      'errors.auth.accountLocked',
      `Account locked until ${until.toISOString()}.`,
    ),
  accountDisabled: () =>
    forbidden(
      'AUTH_ACCOUNT_DISABLED',
      'errors.auth.accountDisabled',
      'This account has been disabled.',
    ),
  tokenInvalid: () =>
    unauthorized(
      'AUTH_TOKEN_INVALID',
      'errors.auth.tokenInvalid',
      'Token is invalid or expired.',
    ),
  refreshReused: () =>
    unauthorized(
      'AUTH_REFRESH_REUSED',
      'errors.auth.refreshReused',
      'Refresh token reuse detected; all sessions revoked.',
    ),
  emailTaken: () =>
    conflict(
      'AUTH_EMAIL_TAKEN',
      'errors.auth.emailTaken',
      'That email is already registered.',
    ),
  usernameTaken: () =>
    conflict(
      'AUTH_USERNAME_TAKEN',
      'errors.auth.usernameTaken',
      'That username is already taken.',
    ),
  wrongPassword: () =>
    badRequest(
      'AUTH_WRONG_PASSWORD',
      'errors.auth.wrongPassword',
      'Current password is incorrect.',
    ),

  // authorisation
  forbiddenAction: (action: string) =>
    forbidden(
      'RBAC_FORBIDDEN',
      'errors.rbac.forbidden',
      `Your role is not allowed to ${action}.`,
    ),
  notAMember: () =>
    notFound(
      'ORG_NOT_A_MEMBER',
      'errors.org.notFound',
      'Organization not found.',
    ),

  // generic
  resourceNotFound: (what: string) =>
    notFound(
      `${what.toUpperCase()}_NOT_FOUND`,
      `errors.${what}.notFound`,
      `${what} not found.`,
    ),

  // tickets
  invalidTransition: (from: string, to: string) =>
    conflict(
      'TICKET_INVALID_TRANSITION',
      'errors.ticket.invalidTransition',
      `Cannot move a ${from} ticket to ${to}.`,
    ),
  assigneeNotAgent: () =>
    unprocessable(
      'TICKET_ASSIGNEE_NOT_AGENT',
      'errors.ticket.assigneeNotAgent',
      'Assignee must be an agent of this organization.',
    ),
  ticketLocked: () =>
    conflict(
      'TICKET_LOCKED',
      'errors.ticket.locked',
      'This ticket can no longer be edited by its author.',
    ),

  // organizations
  slugTaken: () =>
    conflict(
      'ORG_SLUG_TAKEN',
      'errors.org.slugTaken',
      'That organization slug is already in use.',
    ),
  alreadyMember: () =>
    conflict(
      'ORG_ALREADY_MEMBER',
      'errors.org.alreadyMember',
      'User is already a member.',
    ),
  lastAdmin: () =>
    conflict(
      'ORG_LAST_ADMIN',
      'errors.org.lastAdmin',
      'An organization must keep at least one administrator.',
    ),
  categoryNameTaken: () =>
    conflict(
      'CATEGORY_NAME_TAKEN',
      'errors.category.nameTaken',
      'A category with that name already exists.',
    ),

  // files
  fileTooLarge: (max: number) =>
    payloadTooLarge(
      'FILE_TOO_LARGE',
      'errors.file.tooLarge',
      `File exceeds the ${max} byte limit.`,
    ),
  fileTypeNotAllowed: (detected: string) =>
    unsupportedMedia(
      'FILE_TYPE_NOT_ALLOWED',
      'errors.file.typeNotAllowed',
      `File type ${detected} is not allowed.`,
    ),
  tooManyAttachments: (max: number) =>
    conflict(
      'FILE_TOO_MANY',
      'errors.file.tooMany',
      `A ticket can hold at most ${max} attachments.`,
    ),

  // social
  cannotFriendSelf: () =>
    badRequest(
      'FRIEND_SELF',
      'errors.friend.self',
      'You cannot add yourself as a friend.',
    ),
  friendshipExists: () =>
    conflict(
      'FRIEND_EXISTS',
      'errors.friend.exists',
      'A friendship or request already exists.',
    ),

  // api keys / rate limit
  apiKeyInvalid: () =>
    unauthorized(
      'API_KEY_INVALID',
      'errors.apiKey.invalid',
      'API key is missing, invalid or revoked.',
    ),
  apiKeyMissingScope: (scope: string) =>
    forbidden(
      'API_KEY_MISSING_SCOPE',
      'errors.apiKey.missingScope',
      `API key lacks the "${scope}" scope.`,
    ),
  rateLimited: (retryAfter: number) =>
    tooManyRequests(
      'RATE_LIMITED',
      'errors.common.rateLimited',
      `Too many requests. Retry in ${retryAfter}s.`,
    ),

  // gdpr
  gdprPending: () =>
    conflict(
      'GDPR_PENDING',
      'errors.gdpr.pending',
      'You already have a pending request of this type.',
    ),
  gdprTokenInvalid: () =>
    badRequest(
      'GDPR_TOKEN_INVALID',
      'errors.gdpr.tokenInvalid',
      'Confirmation token is invalid or expired.',
    ),
  gdprUsernameMismatch: () =>
    badRequest(
      'GDPR_USERNAME_MISMATCH',
      'errors.gdpr.usernameMismatch',
      'The username you typed does not match your account.',
    ),
};
