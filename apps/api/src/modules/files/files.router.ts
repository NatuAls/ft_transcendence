import { Router } from 'express';
import multer from 'multer';
import { createReadStream, existsSync } from 'node:fs';
import * as files from './files.service.ts';
import { authed } from '../../common/middleware/chains.ts';
import { loadConfiguration } from '../../config/env.ts';
import { Errors } from '../../common/errors/domain-error.ts';
import { param } from '../../common/utils/http.ts';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

export const filesRouter: Router = Router();

filesRouter.get('/attachments/limits', ...authed, (_req, res) => {
  const config = loadConfiguration();
  res.json({
    maxBytes: config.UPLOAD_MAX_BYTES,
    maxPerTicket: config.UPLOAD_MAX_PER_TICKET,
    allowedMimeTypes: [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'application/pdf',
      'application/zip',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
    ],
  });
});

/**
 * Lists the files attached to a ticket.
 *
 * The ticket detail only reports `_count.attachments`, and comment
 * attachments travel with the comments - so without this route a file
 * uploaded straight to a ticket was reachable only from the response of its
 * own upload, and the UI could say "3 attachments" while offering no way to
 * open any of them.
 */
filesRouter.get(
  '/tickets/:ticketId/attachments',
  ...authed,
  async (req, res) => {
    res.json(
      await files.listForTicket(
        req.actor!,
        req.membership,
        param(req.params.ticketId),
      ),
    );
  },
);

filesRouter.post(
  '/tickets/:ticketId/attachments',
  ...authed,
  upload.single('file'),
  async (req, res) => {
    if (!req.file) throw Errors.resourceNotFound('file');
    res
      .status(201)
      .json(
        await files.upload(
          req.actor!,
          undefined,
          { ticketId: param(req.params.ticketId) },
          req.file,
        ),
      );
  },
);

filesRouter.post(
  '/tickets/:ticketId/comments/:commentId/attachments',
  ...authed,
  upload.single('file'),
  async (req, res) => {
    if (!req.file) throw Errors.resourceNotFound('file');
    res
      .status(201)
      .json(
        await files.upload(
          req.actor!,
          undefined,
          { commentId: param(req.params.commentId) },
          req.file,
        ),
      );
  },
);

filesRouter.get('/attachments/:id', ...authed, async (req, res) => {
  const attachment = await files.metadata(req.actor!, param(req.params.id));
  const path = files.absolutePath(attachment.storageKey);
  if (!existsSync(path)) throw Errors.resourceNotFound('attachment');

  res.setHeader('Content-Type', attachment.mimeType);
  res.setHeader('Content-Length', attachment.sizeBytes);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(attachment.originalName)}"`,
  );
  res.setHeader('Cache-Control', 'private, no-store');
  createReadStream(path).pipe(res);
});

filesRouter.get('/attachments/:id/thumbnail', ...authed, async (req, res) => {
  const attachment = await files.metadata(req.actor!, param(req.params.id));
  const buffer = await files.thumbnail(
    attachment.storageKey,
    attachment.mimeType,
  );
  if (!buffer) throw Errors.resourceNotFound('thumbnail');
  res.setHeader('Content-Type', 'image/webp');
  res.setHeader('Cache-Control', 'private, max-age=600');
  res.send(buffer);
});

filesRouter.delete('/attachments/:id', ...authed, async (req, res) => {
  await files.remove(req.actor!, param(req.params.id));
  res.status(204).end();
});
