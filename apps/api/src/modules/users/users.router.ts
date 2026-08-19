import { Router } from 'express';
import multer from 'multer';
import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  adminUpdateUserSchema,
  listUsersQuerySchema,
  setGlobalRoleSchema,
  setUserStatusSchema,
  updatePreferencesSchema,
  updateProfileSchema,
} from 'contracts';
import * as users from './users.service.ts';
import { authed } from '../../common/middleware/chains.ts';
import { requireGlobalAdmin } from '../../common/middleware/policy.ts';
import { validate } from '../../common/middleware/validate.ts';
import { loadConfiguration } from '../../config/env.ts';
import { Errors } from '../../common/errors/domain-error.ts';
import { param } from '../../common/utils/http.ts';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const usersRouter: Router = Router();

usersRouter.get('/search', ...authed, async (req, res) => {
  res.json(
    await users.autocomplete(
      typeof req.query.q === 'string' ? req.query.q : '',
    ),
  );
});

usersRouter.get(
  '/',
  ...authed,
  requireGlobalAdmin(),
  validate(listUsersQuerySchema, 'query'),
  async (req, res) => {
    res.json(
      await users.listAll(
        req.query as unknown as Parameters<typeof users.listAll>[0],
      ),
    );
  },
);

usersRouter.patch(
  '/me',
  ...authed,
  validate(updateProfileSchema),
  async (req, res) => {
    res.json(await users.updateProfile(req.actor!.id, req.body));
  },
);

usersRouter.patch(
  '/me/preferences',
  ...authed,
  validate(updatePreferencesSchema),
  async (req, res) => {
    res.json(await users.updatePreferences(req.actor!.id, req.body));
  },
);

usersRouter.put(
  '/me/avatar',
  ...authed,
  upload.single('file'),
  async (req, res) => {
    if (!req.file) throw Errors.resourceNotFound('file');
    res.json(await users.setAvatar(req.actor!.id, req.file));
  },
);

usersRouter.delete('/me/avatar', ...authed, async (req, res) => {
  res.json(await users.clearAvatar(req.actor!.id));
});

/** Avatars are public by design (they appear next to usernames everywhere). */
usersRouter.get('/avatars/:key', (req, res) => {
  const config = loadConfiguration();
  const key = param(req.params.key);
  if (!/^[0-9a-f-]{36}\.webp$/.test(key))
    throw Errors.resourceNotFound('avatar');
  const path = join(config.UPLOAD_DIR, 'avatars', key);
  if (!existsSync(path)) throw Errors.resourceNotFound('avatar');
  res.setHeader('Content-Type', 'image/webp');
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  createReadStream(path).pipe(res);
});

usersRouter.get('/:username', ...authed, async (req, res) => {
  res.json(await users.publicProfile(param(req.params.username)));
});

usersRouter.patch(
  '/:id',
  ...authed,
  requireGlobalAdmin(),
  validate(adminUpdateUserSchema),
  async (req, res) => {
    res.json(await users.updateProfile(param(req.params.id), req.body));
  },
);

usersRouter.patch(
  '/:id/status',
  ...authed,
  requireGlobalAdmin(),
  validate(setUserStatusSchema),
  async (req, res) => {
    res.json(
      await users.setStatus(
        req.actor!,
        param(req.params.id),
        req.body.isActive,
      ),
    );
  },
);

usersRouter.patch(
  '/:id/role',
  ...authed,
  requireGlobalAdmin(),
  validate(setGlobalRoleSchema),
  async (req, res) => {
    res.json(
      await users.setGlobalRole(
        req.actor!,
        param(req.params.id),
        req.body.globalRole,
      ),
    );
  },
);

usersRouter.delete(
  '/:id',
  ...authed,
  requireGlobalAdmin(),
  async (req, res) => {
    await users.softDelete(req.actor!, param(req.params.id));
    res.status(204).end();
  },
);
