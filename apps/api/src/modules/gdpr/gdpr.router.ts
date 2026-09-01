import { Router, type Request } from 'express';
import { existsSync } from 'node:fs';
import { gdprConfirmSchema } from 'contracts';
import * as gdpr from './gdpr.service.ts';
import * as audit from '../audit/audit.service.ts';
import { authed } from '../../common/middleware/chains.ts';
import { validate } from '../../common/middleware/validate.ts';
import { Errors } from '../../common/errors/domain-error.ts';
import { param } from '../../common/utils/http.ts';

function originOf(req: Request): string {
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https';
  const host =
    (req.headers['x-forwarded-host'] as string | undefined) ??
    req.headers.host ??
    'localhost';
  return `${proto}://${host}`;
}

export const gdprRouter: Router = Router();

gdprRouter.get('/requests', ...authed, async (req, res) => {
  res.json(await gdpr.listRequests(req.actor!.id));
});

gdprRouter.post('/export', ...authed, async (req, res) => {
  res
    .status(201)
    .json(await gdpr.request(req.actor!.id, 'EXPORT', originOf(req)));
});

gdprRouter.post(
  '/export/confirm',
  ...authed,
  validate(gdprConfirmSchema),
  async (req, res) => {
    const result = await gdpr.confirm(req.actor!.id, 'EXPORT', req.body.token);
    audit.from(req)('gdpr.export.confirmed', 'GdprRequest', result.id);
    res.json(result);
  },
);

gdprRouter.get('/export/:id/download', ...authed, async (req, res) => {
  const { path, filename } = await gdpr.downloadPath(
    req.actor!.id,
    param(req.params.id),
  );
  if (!existsSync(path)) throw Errors.resourceNotFound('export');
  res.download(path, filename);
});

gdprRouter.post('/delete', ...authed, async (req, res) => {
  res
    .status(201)
    .json(await gdpr.request(req.actor!.id, 'DELETE', originOf(req)));
});

gdprRouter.post(
  '/delete/confirm',
  ...authed,
  validate(gdprConfirmSchema),
  async (req, res) => {
    // Captured before the call: the account is soft-deleted by the time it
    // returns, and an irreversible action is exactly what an audit trail is
    // for. The token itself is never recorded.
    const trail = audit.from(req);
    const result = await gdpr.confirm(
      req.actor!.id,
      'DELETE',
      req.body.token,
      req.body.confirmUsername,
    );
    trail('gdpr.delete.confirmed', 'GdprRequest', result.id);
    res.json(result);
  },
);
