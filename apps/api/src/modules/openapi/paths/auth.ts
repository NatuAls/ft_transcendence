import {
  op,
  ok,
  created,
  noContent,
  errs,
  body,
  session,
  cookie,
  open,
  pathParam,
  type Paths,
} from './_helpers.ts';
import { ref } from '../schemas.ts';

const sessionResponse = {
  type: 'object',
  properties: {
    accessToken: {
      type: 'string',
      description:
        'JWT for `Authorization: Bearer`. Lives 15 minutes and is kept in memory by the web client, never in localStorage.',
    },
    user: ref('CurrentUser'),
  },
} as const;

export const authPaths: Paths = {
  '/auth/register': {
    post: op({
      tag: 'Auth',
      operationId: 'register',
      summary: 'Create an account',
      description:
        'Creates the user, opens a session and sends the verification e-mail. The username cannot be changed afterwards: it is the stable handle other users mention. Behind the tightest rate limit bucket of the API.',
      security: open,
      requestBody: body('RegisterInput'),
      responses: {
        '201': created('Account created and session opened.', sessionResponse),
        ...errs('400', '409', '429'),
      },
    }),
  },
  '/auth/login': {
    post: op({
      tag: 'Auth',
      operationId: 'login',
      summary: 'Sign in',
      description:
        'Returns the access token and sets the `hd_refresh` cookie (HttpOnly, SameSite=Strict, scoped to `/api/v1/auth`) plus a readable `hd_session` hint the client uses to know whether refreshing is worth trying. Repeated failures back off progressively.',
      security: open,
      requestBody: body('LoginInput'),
      responses: {
        '200': ok('Session opened.', sessionResponse),
        ...errs('400', '401', '429'),
      },
    }),
  },
  '/auth/refresh': {
    post: op({
      tag: 'Auth',
      operationId: 'refresh',
      summary: 'Renew the session',
      description:
        'Rotates the refresh token: the old one is invalidated and **reuse is detected**, so replaying a stolen cookie kills the whole family of tokens instead of handing over a session. Uses the cookie, not a body.',
      security: cookie,
      responses: {
        '200': ok('New access token.', sessionResponse),
        ...errs('401', '429'),
      },
    }),
  },
  '/auth/logout': {
    post: op({
      tag: 'Auth',
      operationId: 'logout',
      summary: 'Sign out',
      description:
        'Revokes the current refresh row **and** the access token in use, so a token copied before signing out stops working immediately. Works even when the access token has already expired.',
      security: session,
      responses: { '204': noContent('Signed out.'), ...errs('401') },
    }),
  },
  '/auth/logout-all': {
    post: op({
      tag: 'Auth',
      operationId: 'logoutAll',
      summary: 'Sign out everywhere',
      description:
        'Revokes every session and every live access token of the account. This is the button to press after losing a device.',
      security: session,
      responses: { '204': noContent('All sessions revoked.'), ...errs('401') },
    }),
  },
  '/auth/me': {
    get: op({
      tag: 'Auth',
      operationId: 'me',
      summary: 'Who am I',
      description:
        'The caller identity as the server sees it: id, username, profile, global role, the organizations the user belongs to with their role in each, and `pendingRoles` - the roles an administrator reserved for this address that will arrive when it is verified. The web client calls it on boot to rebuild the session.',
      security: session,
      responses: {
        '200': ok('Caller identity.', ref('CurrentUser')),
        ...errs('401'),
      },
    }),
  },
  '/auth/verify-email': {
    post: op({
      tag: 'Auth',
      operationId: 'verifyEmail',
      summary: 'Confirm the e-mail address',
      description:
        'Consumes the single-use token sent at sign-up (the e-mail links to `/#verify-email?token=…`). It is also the moment every role an administrator reserved for this address reaches the account: platform role and organization memberships, in one transaction, recorded as `role.reservation.claimed`. An unknown, used or expired token is a 401.',
      security: open,
      requestBody: body('VerifyEmailInput'),
      responses: {
        '204': noContent('Address verified.'),
        ...errs('400', '401', '429'),
      },
    }),
  },
  '/auth/resend-verification': {
    post: op({
      tag: 'Auth',
      operationId: 'resendVerification',
      summary: 'Send the verification e-mail again',
      description:
        'Answers the same whether or not the address exists, so it cannot be used to find out who is registered.',
      security: open,
      requestBody: body('ForgotPasswordInput'),
      responses: {
        '204': noContent('If the address exists, the message was sent.'),
        ...errs('400', '429'),
      },
    }),
  },
  '/auth/forgot-password': {
    post: op({
      tag: 'Auth',
      operationId: 'forgotPassword',
      summary: 'Start password recovery',
      description:
        'Sends a single-use link. Same neutral answer for known and unknown addresses.',
      security: open,
      requestBody: body('ForgotPasswordInput'),
      responses: {
        '204': noContent('If the address exists, the message was sent.'),
        ...errs('400', '429'),
      },
    }),
  },
  '/auth/reset-password': {
    post: op({
      tag: 'Auth',
      operationId: 'resetPassword',
      summary: 'Set a new password with the token',
      description:
        'Applies the same password policy as sign-up and revokes every open session, because a reset usually means the old one is compromised.',
      security: open,
      requestBody: body('ResetPasswordInput'),
      responses: {
        '204': noContent('Password changed.'),
        ...errs('400', '401', '429'),
      },
    }),
  },
  '/auth/change-password': {
    post: op({
      tag: 'Auth',
      operationId: 'changePassword',
      summary: 'Change the password from the account',
      description:
        'Requires the current password. Hashing is Argon2id with a server-side pepper, so a database dump alone cannot be cracked offline.',
      security: session,
      requestBody: body('ChangePasswordInput'),
      responses: {
        '204': noContent('Password changed.'),
        ...errs('400', '401'),
      },
    }),
  },
  '/auth/sessions': {
    get: op({
      tag: 'Auth',
      operationId: 'listSessions',
      summary: 'Active sessions',
      description:
        'Devices with a live refresh token, most recently used first: sign-in, last use, user agent and address. One row per device even though the token rotates on every refresh. The material for the "Sessions & devices" screen.',
      security: session,
      responses: {
        '200': ok('Open sessions.', {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              createdAt: {
                type: 'string',
                format: 'date-time',
                description: 'When the device signed in.',
              },
              lastUsedAt: {
                type: 'string',
                format: 'date-time',
                description: 'Last time the device renewed its session.',
              },
              expiresAt: { type: 'string', format: 'date-time' },
              userAgent: { type: 'string', nullable: true },
              ip: { type: 'string', nullable: true },
              current: {
                type: 'boolean',
                description:
                  'True for the session making this call, recognised by the refresh cookie that travels to every `/auth` route.',
              },
            },
          },
        }),
        ...errs('401'),
      },
    }),
  },
  '/auth/sessions/{id}': {
    delete: op({
      tag: 'Auth',
      operationId: 'revokeSession',
      summary: 'Revoke one session',
      description:
        'Signs that device out without touching the others: its next `POST /auth/refresh` is refused, so it is out within the 15 minutes its access token still lives. A session of another user and one already revoked answer the same 404, so the route cannot be used to probe identifiers. To close every device, this one included, use `POST /auth/logout-all`.',
      security: session,
      parameters: [
        pathParam('id', 'Session identifier (the `id` of a listed session).'),
      ],
      responses: {
        '204': noContent('Session revoked.'),
        ...errs('401', '404'),
      },
    }),
  },
};
