import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  assignTicketSchema,
  changeStatusSchema,
  createCommentSchema,
  createTicketSchema,
  searchTicketsQuerySchema,
  updateCommentSchema,
  updateTicketSchema,
} from 'contracts';
import * as tickets from './tickets.service.ts';
import * as search from '../search/search.service.ts';
import { prisma } from '../../database/prisma.ts';
import { membershipOf } from '../../rbac/rbac.ts';
import { authed } from '../../common/middleware/chains.ts';
import { orgScope } from '../../common/middleware/org-scope.ts';
import { requirePolicy } from '../../common/middleware/policy.ts';
import { validate } from '../../common/middleware/validate.ts';
import { param } from '../../common/utils/http.ts';

/**
 * The membership is resolved by `orgScope()` when the organization is in the
 * URL or body. For ticket-id routes, the organization isn't in the URL - it
 * has to be looked up from the ticket itself.
 */
async function resolveTicketMembership(req: Request, _res: Response, next: NextFunction) {
  if (req.membership) return next();
  const ticket = await prisma.ticket.findUnique({
    where: { id: param(req.params.id) },
    select: { organizationId: true },
  });
  if (ticket && req.actor) {
    req.membership = await membershipOf(req.actor.id, ticket.organizationId);
  }
  next();
}

export const ticketsRouter: Router = Router();

ticketsRouter.get('/', ...authed, validate(searchTicketsQuerySchema, 'query'), async (req, res) => {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId: req.actor!.id },
    select: { organizationId: true },
  });
  res.json(
    await search.searchTickets(
      req.actor!,
      memberships.map((m) => m.organizationId),
      req.query as unknown as Parameters<typeof search.searchTickets>[2],
    ),
  );
});

ticketsRouter.post(
  '/',
  ...authed,
  orgScope(),
  requirePolicy('ticket:create'),
  validate(createTicketSchema),
  async (req, res) => {
    res.status(201).json(await tickets.create(req.actor!, req.membership, req.body));
  },
);

ticketsRouter.get('/:id', ...authed, resolveTicketMembership, async (req, res) => {
  res.json(await tickets.findOne(req.actor!, req.membership, param(req.params.id)));
});

ticketsRouter.patch(
  '/:id',
  ...authed,
  resolveTicketMembership,
  validate(updateTicketSchema),
  async (req, res) => {
    res.json(await tickets.update(req.actor!, req.membership, param(req.params.id), req.body));
  },
);

ticketsRouter.patch(
  '/:id/status',
  ...authed,
  resolveTicketMembership,
  validate(changeStatusSchema),
  async (req, res) => {
    res.json(await tickets.changeStatus(req.actor!, req.membership, param(req.params.id), req.body));
  },
);

ticketsRouter.patch(
  '/:id/assignee',
  ...authed,
  resolveTicketMembership,
  validate(assignTicketSchema),
  async (req, res) => {
    res.json(await tickets.assign(req.actor!, req.membership, param(req.params.id), req.body));
  },
);

ticketsRouter.delete('/:id', ...authed, resolveTicketMembership, async (req, res) => {
  await tickets.remove(req.actor!, req.membership, param(req.params.id));
  res.status(204).end();
});

ticketsRouter.get('/:id/history', ...authed, resolveTicketMembership, async (req, res) => {
  res.json(await tickets.history(req.actor!, req.membership, param(req.params.id)));
});

ticketsRouter.get('/:id/comments', ...authed, resolveTicketMembership, async (req, res) => {
  res.json(await tickets.listComments(req.actor!, req.membership, param(req.params.id)));
});

ticketsRouter.post(
  '/:id/comments',
  ...authed,
  resolveTicketMembership,
  validate(createCommentSchema),
  async (req, res) => {
    res.status(201).json(await tickets.addComment(req.actor!, req.membership, param(req.params.id), req.body));
  },
);

ticketsRouter.patch(
  '/:id/comments/:commentId',
  ...authed,
  resolveTicketMembership,
  validate(updateCommentSchema),
  async (req, res) => {
    res.json(
      await tickets.updateComment(
        req.actor!,
        req.membership,
        param(req.params.id),
        param(req.params.commentId),
        req.body.body,
      ),
    );
  },
);

ticketsRouter.delete('/:id/comments/:commentId', ...authed, resolveTicketMembership, async (req, res) => {
  await tickets.removeComment(req.actor!, req.membership, param(req.params.id), param(req.params.commentId));
  res.status(204).end();
});
