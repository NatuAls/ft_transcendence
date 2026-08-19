import { Router } from 'express';
import { listNotificationsQuerySchema } from 'contracts';
import * as notifications from './notifications.service.ts';
import { authed } from '../../common/middleware/chains.ts';
import { validate } from '../../common/middleware/validate.ts';
import { param } from '../../common/utils/http.ts';

export const notificationsRouter: Router = Router();

notificationsRouter.get('/', ...authed, validate(listNotificationsQuerySchema, 'query'), async (req, res) => {
  res.json(await notifications.list(req.actor!.id, req.query as unknown as Parameters<typeof notifications.list>[1]));
});

notificationsRouter.get('/unread-count', ...authed, async (req, res) => {
  res.json({ count: await notifications.unreadCount(req.actor!.id) });
});

notificationsRouter.patch('/read-all', ...authed, async (req, res) => {
  await notifications.markAllRead(req.actor!.id);
  res.status(204).end();
});

notificationsRouter.patch('/:id/read', ...authed, async (req, res) => {
  await notifications.markRead(req.actor!.id, param(req.params.id));
  res.status(204).end();
});

notificationsRouter.delete('/:id', ...authed, async (req, res) => {
  await notifications.remove(req.actor!.id, param(req.params.id));
  res.status(204).end();
});
