import { Router, type Request, type Response } from 'express';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from 'contracts';
import * as auth from './auth.service.ts';
import { authed } from '../../common/middleware/chains.ts';
import { rateLimitDefault } from '../../common/middleware/rate-limit.ts';
import { validate } from '../../common/middleware/validate.ts';
import { Errors } from '../../common/errors/domain-error.ts';
import { param } from '../../common/utils/http.ts';
import { loadConfiguration } from '../../config/env.ts';

const REFRESH_COOKIE = 'hd_refresh';
const SESSION_HINT_COOKIE = 'hd_session';

function contextOf(req: Request): auth.RequestContext {
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https';
  const host =
    (req.headers['x-forwarded-host'] as string | undefined) ??
    req.headers.host ??
    'localhost';
  return {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    origin: `${proto}://${host}`,
  };
}

/**
 * Refresh token lives in an HttpOnly cookie so JavaScript - and therefore any
 * XSS payload - cannot read it. SameSite=Strict plus a path restricted to the
 * refresh endpoint is what removes the need for a CSRF token here.
 */
function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  // HTTPS is mandatory in production, while disabling Secure in local HTTP
  // development lets browsers actually persist the refresh cookie.
  const secure = loadConfiguration().NODE_ENV === 'production';
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/api/v1/auth',
    expires: expiresAt,
  });
  // Readable hint only - never carries the token itself. The frontend checks
  // for its presence before calling /auth/refresh on boot, so an anonymous
  // visit to a public page doesn't fire (and log to the console) a request
  // that can only ever 401 for lack of the real, HttpOnly cookie.
  res.cookie(SESSION_HINT_COOKIE, '1', {
    httpOnly: false,
    secure,
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  res.clearCookie(SESSION_HINT_COOKIE, { path: '/' });
}

export const authRouter: Router = Router();

authRouter.post(
  '/register',
  rateLimitDefault,
  validate(registerSchema),
  async (req, res) => {
    const result = await auth.register(req.body, contextOf(req));
    setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
    res
      .status(201)
      .json({ user: result.user, accessToken: result.accessToken });
  },
);

authRouter.post(
  '/login',
  rateLimitDefault,
  validate(loginSchema),
  async (req, res) => {
    const result = await auth.login(req.body, contextOf(req));
    setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
    res
      .status(200)
      .json({ user: result.user, accessToken: result.accessToken });
  },
);

authRouter.post('/refresh', rateLimitDefault, async (req, res) => {
  const token = (req.cookies as Record<string, string> | undefined)?.[
    REFRESH_COOKIE
  ];
  if (!token) throw Errors.tokenInvalid();
  const result = await auth.refresh(token, contextOf(req));
  setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
  res.status(200).json({ user: result.user, accessToken: result.accessToken });
});

authRouter.post('/logout', ...authed, async (req, res) => {
  const token = (req.cookies as Record<string, string> | undefined)?.[
    REFRESH_COOKIE
  ];
  await auth.logout(token);
  clearAuthCookies(res);
  res.status(204).end();
});

authRouter.post('/logout-all', ...authed, async (req, res) => {
  await auth.logoutAll(req.actor!.id);
  clearAuthCookies(res);
  res.status(204).end();
});

authRouter.get('/me', ...authed, async (req, res) => {
  res.json(await auth.sessionUser(req.actor!.id));
});

authRouter.post(
  '/verify-email',
  rateLimitDefault,
  validate(verifyEmailSchema),
  async (req, res) => {
    await auth.verifyEmail(req.body.token);
    res.status(204).end();
  },
);

authRouter.post(
  '/forgot-password',
  rateLimitDefault,
  validate(forgotPasswordSchema),
  async (req, res) => {
    await auth.forgotPassword(req.body.email, contextOf(req));
    res.status(202).json({ accepted: true });
  },
);

authRouter.post(
  '/reset-password',
  rateLimitDefault,
  validate(resetPasswordSchema),
  async (req, res) => {
    await auth.resetPassword(req.body);
    res.status(204).end();
  },
);

authRouter.post(
  '/change-password',
  ...authed,
  validate(changePasswordSchema),
  async (req, res) => {
    await auth.changePassword(req.actor!.id, req.body);
    res.status(204).end();
  },
);

authRouter.get('/sessions', ...authed, async (req, res) => {
  res.json(await auth.listSessions(req.actor!.id));
});

authRouter.delete('/sessions/:id', ...authed, async (req, res) => {
  await auth.revokeSession(req.actor!.id, param(req.params.id));
  res.status(204).end();
});
