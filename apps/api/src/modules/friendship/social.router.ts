import { Router } from 'express';
import { openConversationSchema, respondFriendRequestSchema, sendFriendRequestSchema, sendMessageSchema } from 'contracts';
import * as social from './social.service.ts';
import { authed } from '../../common/middleware/chains.ts';
import { validate } from '../../common/middleware/validate.ts';
import { param } from '../../common/utils/http.ts';

export const socialRouter: Router = Router();

socialRouter.get('/friends', ...authed, async (req, res) => {
  res.json(await social.listFriends(req.actor!.id));
});

socialRouter.get('/friends/requests', ...authed, async (req, res) => {
  res.json(await social.listRequests(req.actor!.id));
});

socialRouter.post('/friends/requests', ...authed, validate(sendFriendRequestSchema), async (req, res) => {
  res.status(201).json(await social.requestFriend(req.actor!.id, req.body));
});

socialRouter.patch('/friends/requests/:id', ...authed, validate(respondFriendRequestSchema), async (req, res) => {
  res.json(await social.respondRequest(req.actor!.id, param(req.params.id), req.body.action));
});

socialRouter.delete('/friends/:userId', ...authed, async (req, res) => {
  await social.removeFriend(req.actor!.id, param(req.params.userId));
  res.status(204).end();
});

socialRouter.get('/conversations', ...authed, async (req, res) => {
  res.json(await social.listConversations(req.actor!.id));
});

socialRouter.post('/conversations', ...authed, validate(openConversationSchema), async (req, res) => {
  res.status(201).json(await social.openConversation(req.actor!.id, req.body.userId));
});

socialRouter.get('/conversations/:id/messages', ...authed, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const take = Math.min(100, Number(req.query.take) || 30);
  res.json(await social.listMessages(req.actor!.id, param(req.params.id), page, take));
});

socialRouter.post('/conversations/:id/messages', ...authed, validate(sendMessageSchema), async (req, res) => {
  res.status(201).json(await social.sendMessage(req.actor!.id, param(req.params.id), req.body));
});

socialRouter.patch('/conversations/:id/read', ...authed, async (req, res) => {
  await social.markRead(req.actor!.id, param(req.params.id));
  res.status(204).end();
});
