import { Router } from 'express';
import { assignPlatformRoleSchema, listAuditQuerySchema } from 'contracts';
import { prisma } from '../../database/prisma.ts';
import { authed } from '../../common/middleware/chains.ts';
import { requireGlobalAdmin } from '../../common/middleware/policy.ts';
import { validate } from '../../common/middleware/validate.ts';
import { paginate } from '../../common/utils/pagination.ts';
import { originOf, param } from '../../common/utils/http.ts';
import * as audit from '../audit/audit.service.ts';
import * as roles from '../roles/role-grants.service.ts';

export const adminRouter: Router = Router();

adminRouter.use(...authed, requireGlobalAdmin());

adminRouter.get(
  '/audit-logs',
  validate(listAuditQuerySchema, 'query'),
  async (req, res) => {
    const q = req.query as unknown as {
      page: number;
      take: number;
      entity?: string;
      entityId?: string;
      actorId?: string;
      action?: string;
      from?: string;
      to?: string;
    };
    const where = {
      ...(q.entity ? { entity: q.entity } : {}),
      ...(q.entityId ? { entityId: q.entityId } : {}),
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.action ? { action: q.action } : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.take,
        take: q.take,
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          ip: true,
          createdAt: true,
          actor: { select: { id: true, username: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);
    res.json(paginate(rows, total, q.page, q.take));
  },
);

adminRouter.get('/stats', async (_req, res) => {
  const [
    users,
    activeUsers,
    organizations,
    tickets,
    openTickets,
    messages,
    attachments,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, isActive: true } }),
    prisma.organization.count({ where: { deletedAt: null } }),
    prisma.ticket.count(),
    prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.message.count({ where: { deletedAt: null } }),
    prisma.attachment.count({ where: { deletedAt: null } }),
  ]);
  res.json({
    users,
    activeUsers,
    organizations,
    tickets,
    openTickets,
    messages,
    attachments,
  });
});

// ------------------------------------------------- platform roles by e-mail --
// The system-level half of the role assignment: a GLOBAL_ADMIN gives the
// platform role to an address. Applied at once to a verified account,
// reserved otherwise until that address is verified. Taking the role back
// from an account is PATCH /users/:id/role.
adminRouter.get('/role-grants', async (_req, res) => {
  res.json(await roles.listPlatformReservations());
});

adminRouter.post(
  '/role-grants',
  validate(assignPlatformRoleSchema),
  async (req, res) => {
    const { previousRole, ...result } = await roles.assignPlatformRole(
      req.actor!,
      req.body,
      originOf(req),
    );
    const log = audit.from(req);
    if (result.outcome === 'APPLIED') {
      log('user.role.changed', 'User', result.user!.id, {
        before: { globalRole: previousRole },
        after: { globalRole: result.globalRole, via: 'role assignment' },
      });
    } else if (result.outcome === 'RESERVED') {
      log('role.reserved', 'PlatformRoleGrant', result.reservation!.id, {
        after: { email: result.email, globalRole: result.globalRole },
      });
    }
    res.status(result.outcome === 'RESERVED' ? 201 : 200).json(result);
  },
);

adminRouter.delete('/role-grants/:grantId', async (req, res) => {
  const removed = await roles.cancelPlatformReservation(
    param(req.params.grantId),
  );
  audit.from(req)(
    'role.reservation.cancelled',
    'PlatformRoleGrant',
    removed.id,
    {
      before: { email: removed.email, globalRole: removed.globalRole },
    },
  );
  res.status(204).end();
});
