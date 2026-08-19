import { Router, type Request } from 'express';
import {
  createCategorySchema,
  createOrganizationSchema,
  inviteMemberSchema,
  updateCategorySchema,
  updateMemberRoleSchema,
  updateOrganizationSchema,
} from 'contracts';
import * as orgs from './organizations.service.ts';
import { authed } from '../../common/middleware/chains.ts';
import { orgScope } from '../../common/middleware/org-scope.ts';
import { validate } from '../../common/middleware/validate.ts';
import { param } from '../../common/utils/http.ts';
import { apiKeysRouter } from '../public-api/public-api.router.ts';

function originOf(req: Request): string {
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https';
  const host =
    (req.headers['x-forwarded-host'] as string | undefined) ??
    req.headers.host ??
    'localhost';
  return `${proto}://${host}`;
}

export const organizationsRouter: Router = Router();

organizationsRouter.get('/', ...authed, async (req, res) => {
  res.json(await orgs.listMine(req.actor!));
});

organizationsRouter.post(
  '/',
  ...authed,
  validate(createOrganizationSchema),
  async (req, res) => {
    res.status(201).json(await orgs.create(req.actor!, req.body));
  },
);

organizationsRouter.get(
  '/:organizationId',
  ...authed,
  orgScope(),
  async (req, res) => {
    res.json(
      await orgs.findOne(
        req.actor!,
        req.membership,
        param(req.params.organizationId),
      ),
    );
  },
);

organizationsRouter.patch(
  '/:organizationId',
  ...authed,
  orgScope({ minRoles: ['ORG_ADMIN'] }),
  validate(updateOrganizationSchema),
  async (req, res) => {
    res.json(
      await orgs.update(
        req.actor!,
        req.membership,
        param(req.params.organizationId),
        req.body,
      ),
    );
  },
);

organizationsRouter.delete(
  '/:organizationId',
  ...authed,
  orgScope({ minRoles: ['ORG_ADMIN'] }),
  async (req, res) => {
    await orgs.remove(
      req.actor!,
      req.membership,
      param(req.params.organizationId),
    );
    res.status(204).end();
  },
);

organizationsRouter.get(
  '/:organizationId/members',
  ...authed,
  orgScope(),
  async (req, res) => {
    res.json(
      await orgs.listMembers(
        req.actor!,
        req.membership,
        param(req.params.organizationId),
      ),
    );
  },
);

organizationsRouter.post(
  '/:organizationId/members',
  ...authed,
  orgScope({ minRoles: ['ORG_ADMIN'] }),
  validate(inviteMemberSchema),
  async (req, res) => {
    res
      .status(201)
      .json(
        await orgs.invite(
          req.actor!,
          req.membership,
          param(req.params.organizationId),
          req.body,
          originOf(req),
        ),
      );
  },
);

organizationsRouter.patch(
  '/:organizationId/members/:userId',
  ...authed,
  orgScope({ minRoles: ['ORG_ADMIN'] }),
  validate(updateMemberRoleSchema),
  async (req, res) => {
    res.json(
      await orgs.changeRole(
        req.actor!,
        req.membership,
        param(req.params.organizationId),
        param(req.params.userId),
        req.body.role,
      ),
    );
  },
);

organizationsRouter.delete(
  '/:organizationId/members/:userId',
  ...authed,
  orgScope({ minRoles: ['ORG_ADMIN'] }),
  async (req, res) => {
    await orgs.removeMember(
      req.actor!,
      req.membership,
      param(req.params.organizationId),
      param(req.params.userId),
    );
    res.status(204).end();
  },
);

organizationsRouter.post(
  '/:organizationId/leave',
  ...authed,
  orgScope(),
  async (req, res) => {
    await orgs.removeMember(
      req.actor!,
      req.membership,
      param(req.params.organizationId),
      req.actor!.id,
    );
    res.status(204).end();
  },
);

organizationsRouter.get(
  '/:organizationId/categories',
  ...authed,
  orgScope(),
  async (req, res) => {
    res.json(
      await orgs.listCategories(
        req.actor!,
        req.membership,
        param(req.params.organizationId),
      ),
    );
  },
);

organizationsRouter.post(
  '/:organizationId/categories',
  ...authed,
  orgScope({ minRoles: ['ORG_ADMIN'] }),
  validate(createCategorySchema),
  async (req, res) => {
    res
      .status(201)
      .json(
        await orgs.createCategory(
          req.actor!,
          req.membership,
          param(req.params.organizationId),
          req.body,
        ),
      );
  },
);

organizationsRouter.patch(
  '/:organizationId/categories/:categoryId',
  ...authed,
  orgScope({ minRoles: ['ORG_ADMIN'] }),
  validate(updateCategorySchema),
  async (req, res) => {
    res.json(
      await orgs.updateCategory(
        req.actor!,
        req.membership,
        param(req.params.organizationId),
        param(req.params.categoryId),
        req.body,
      ),
    );
  },
);

organizationsRouter.delete(
  '/:organizationId/categories/:categoryId',
  ...authed,
  orgScope({ minRoles: ['ORG_ADMIN'] }),
  async (req, res) => {
    await orgs.removeCategory(
      req.actor!,
      req.membership,
      param(req.params.organizationId),
      param(req.params.categoryId),
    );
    res.status(204).end();
  },
);

organizationsRouter.get(
  '/:organizationId/stats',
  ...authed,
  orgScope(),
  async (req, res) => {
    res.json(
      await orgs.stats(
        req.actor!,
        req.membership,
        param(req.params.organizationId),
      ),
    );
  },
);

organizationsRouter.use('/:organizationId/api-keys', apiKeysRouter);
