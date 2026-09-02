import { Router } from 'express';
import {
  createApiKeySchema,
  createCategorySchema,
  createCommentSchema,
  createTicketSchema,
  searchTicketsQuerySchema,
  updateCategorySchema,
  updateTicketSchema,
} from 'contracts';
import * as tickets from '../tickets/tickets.service.ts';
import * as orgs from '../organizations/organizations.service.ts';
import * as search from '../search/search.service.ts';
import * as apiKeys from './api-keys.service.ts';
import * as audit from '../audit/audit.service.ts';
import { membershipOf } from '../../rbac/rbac.ts';
import { apiKeyRoute } from '../../common/middleware/chains.ts';
import { requireScope } from '../../common/middleware/api-key.ts';
import { authed } from '../../common/middleware/chains.ts';
import { orgScope } from '../../common/middleware/org-scope.ts';
import { validate } from '../../common/middleware/validate.ts';
import { Errors } from '../../common/errors/domain-error.ts';
import type { RequestActor, RequestMembership } from '../../common/types.ts';
import { param } from '../../common/utils/http.ts';

function orgIdOf(actor: RequestActor): string {
  if (!actor.organizationId) throw Errors.apiKeyInvalid();
  return actor.organizationId;
}

function membershipOfActor(
  actor: RequestActor,
): Promise<RequestMembership | undefined> {
  return membershipOf(actor.id, orgIdOf(actor));
}

/**
 * ==============================================================================
 *  PUBLIC API
 *
 *  Everything under /api/v1/public is authenticated with an API key instead of
 *  a session, scoped by the key, and rate limited to 60/min and 1000/hour.
 *
 *  Crucially these routes call the SAME domain services as the web app, so
 *  business rules - including the ticket state machine and the RBAC matrix -
 *  cannot be bypassed through this door; only the auth mechanism differs.
 * ==============================================================================
 */
export const publicApiRouter: Router = Router();

publicApiRouter.get('/me', ...apiKeyRoute, (req, res) => {
  const actor = req.actor!;
  res.json({
    organizationId: actor.organizationId,
    scopes: actor.scopes ?? [],
    owner: { id: actor.id, username: actor.username },
  });
});

// ---- tickets --------------------------------------------------------------------
publicApiRouter.get(
  '/tickets',
  ...apiKeyRoute,
  requireScope('tickets:read'),
  validate(searchTicketsQuerySchema, 'query'),
  async (req, res) => {
    const actor = req.actor!;
    res.json(
      await search.searchTickets(actor, [orgIdOf(actor)], {
        ...(req.query as unknown as Parameters<typeof search.searchTickets>[2]),
        organizationId: orgIdOf(actor),
      }),
    );
  },
);

publicApiRouter.get(
  '/tickets/:id',
  ...apiKeyRoute,
  requireScope('tickets:read'),
  async (req, res) => {
    const actor = req.actor!;
    res.json(
      await tickets.findOne(
        actor,
        await membershipOfActor(actor),
        param(req.params.id),
      ),
    );
  },
);

publicApiRouter.post(
  '/tickets',
  ...apiKeyRoute,
  requireScope('tickets:write'),
  async (req, res) => {
    const actor = req.actor!;
    const input = createTicketSchema.parse({
      ...req.body,
      organizationId: orgIdOf(actor),
    });
    res
      .status(201)
      .json(await tickets.create(actor, await membershipOfActor(actor), input));
  },
);

publicApiRouter.put(
  '/tickets/:id',
  ...apiKeyRoute,
  requireScope('tickets:write'),
  validate(updateTicketSchema),
  async (req, res) => {
    const actor = req.actor!;
    res.json(
      await tickets.update(
        actor,
        await membershipOfActor(actor),
        param(req.params.id),
        req.body,
      ),
    );
  },
);

publicApiRouter.patch(
  '/tickets/:id',
  ...apiKeyRoute,
  requireScope('tickets:write'),
  validate(updateTicketSchema),
  async (req, res) => {
    const actor = req.actor!;
    res.json(
      await tickets.update(
        actor,
        await membershipOfActor(actor),
        param(req.params.id),
        req.body,
      ),
    );
  },
);

publicApiRouter.delete(
  '/tickets/:id',
  ...apiKeyRoute,
  requireScope('tickets:write'),
  async (req, res) => {
    const actor = req.actor!;
    await tickets.remove(
      actor,
      await membershipOfActor(actor),
      param(req.params.id),
    );
    res.status(204).end();
  },
);

// ---- comments -------------------------------------------------------------------
publicApiRouter.get(
  '/tickets/:id/comments',
  ...apiKeyRoute,
  requireScope('comments:read'),
  async (req, res) => {
    const actor = req.actor!;
    res.json(
      await tickets.listComments(
        actor,
        await membershipOfActor(actor),
        param(req.params.id),
      ),
    );
  },
);

publicApiRouter.post(
  '/tickets/:id/comments',
  ...apiKeyRoute,
  requireScope('comments:write'),
  validate(createCommentSchema),
  async (req, res) => {
    const actor = req.actor!;
    res
      .status(201)
      .json(
        await tickets.addComment(
          actor,
          await membershipOfActor(actor),
          param(req.params.id),
          req.body,
        ),
      );
  },
);

// ---- categories -----------------------------------------------------------------
publicApiRouter.get(
  '/categories',
  ...apiKeyRoute,
  requireScope('categories:read'),
  async (req, res) => {
    const actor = req.actor!;
    res.json(
      await orgs.listCategories(
        actor,
        await membershipOfActor(actor),
        orgIdOf(actor),
      ),
    );
  },
);

publicApiRouter.post(
  '/categories',
  ...apiKeyRoute,
  requireScope('categories:write'),
  validate(createCategorySchema),
  async (req, res) => {
    const actor = req.actor!;
    res
      .status(201)
      .json(
        await orgs.createCategory(
          actor,
          await membershipOfActor(actor),
          orgIdOf(actor),
          req.body,
        ),
      );
  },
);

publicApiRouter.put(
  '/categories/:id',
  ...apiKeyRoute,
  requireScope('categories:write'),
  validate(updateCategorySchema),
  async (req, res) => {
    const actor = req.actor!;
    res.json(
      await orgs.updateCategory(
        actor,
        await membershipOfActor(actor),
        orgIdOf(actor),
        param(req.params.id),
        req.body,
      ),
    );
  },
);

publicApiRouter.delete(
  '/categories/:id',
  ...apiKeyRoute,
  requireScope('categories:write'),
  async (req, res) => {
    const actor = req.actor!;
    await orgs.removeCategory(
      actor,
      await membershipOfActor(actor),
      orgIdOf(actor),
      param(req.params.id),
    );
    res.status(204).end();
  },
);

// ---- stats ------------------------------------------------------------------------
publicApiRouter.get(
  '/organizations/:id/stats',
  ...apiKeyRoute,
  requireScope('stats:read'),
  async (req, res) => {
    const actor = req.actor!;
    const id = param(req.params.id);
    if (id !== orgIdOf(actor)) throw Errors.notAMember();
    res.json(await orgs.stats(actor, await membershipOfActor(actor), id));
  },
);

/** Session-authenticated management of the keys themselves (not part of the public surface). */
export const apiKeysRouter: Router = Router({ mergeParams: true });

apiKeysRouter.get(
  '/',
  ...authed,
  orgScope({ minRoles: ['ORG_ADMIN'] }),
  async (req, res) => {
    res.json(await apiKeys.list(param(req.params.organizationId)));
  },
);

apiKeysRouter.post(
  '/',
  ...authed,
  orgScope({ minRoles: ['ORG_ADMIN'] }),
  validate(createApiKeySchema),
  async (req, res) => {
    const created = await apiKeys.create(
      req.actor!,
      req.membership,
      param(req.params.organizationId),
      req.body,
    );
    // The plaintext key is in `created` and must never reach the audit table:
    // only the non-secret identity of the key is recorded.
    audit.from(req)('apiKey.created', 'ApiKey', created.id, {
      after: {
        name: req.body.name,
        scopes: req.body.scopes,
        organizationId: param(req.params.organizationId),
      },
    });
    res.status(201).json(created);
  },
);

apiKeysRouter.delete(
  '/:id',
  ...authed,
  orgScope({ minRoles: ['ORG_ADMIN'] }),
  async (req, res) => {
    await apiKeys.revoke(
      req.actor!,
      req.membership,
      param(req.params.organizationId),
      param(req.params.id),
    );
    audit.from(req)('apiKey.revoked', 'ApiKey', param(req.params.id), {
      after: { organizationId: param(req.params.organizationId) },
    });
    res.status(204).end();
  },
);
