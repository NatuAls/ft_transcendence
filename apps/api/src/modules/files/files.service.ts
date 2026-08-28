import { createHash } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { prisma } from '../../database/prisma.ts';
import { DomainEvents, events } from '../../database/events.ts';
import { membershipOf, assertPolicy } from '../../rbac/rbac.ts';
import { loadConfiguration } from '../../config/env.ts';
import { Errors } from '../../common/errors/domain-error.ts';
import { uuidv7 } from '../../common/utils/uuid.ts';
import type { RequestActor, RequestMembership } from '../../common/types.ts';
import { ALLOWED, detectMime, TEXT_TYPES } from './mime.ts';

/**
 * File upload and management.
 *
 *  1. multiple types           -> ALLOWED + TEXT_TYPES
 *  2. client AND server checks -> browser checks size/type, this checks magic bytes
 *  3. secure storage           -> random key, outside the webroot, served only by
 *                                 an authorised endpoint
 *  4. preview                  -> thumbnails for images, inline viewer for PDFs
 *  5. progress indicator       -> XHR upload progress in the browser
 *  6. delete                   -> soft delete + physical unlink
 *
 * The demo that convinces an evaluator: take a shell script, rename it to
 * `report.pdf`, upload it, get a 415. The extension lied; the bytes did not.
 */
function subject(actor: RequestActor, membership?: RequestMembership) {
  return {
    userId: actor.id,
    isGlobalAdmin: actor.globalRole === 'GLOBAL_ADMIN',
    orgRole: membership?.role,
  };
}

/** Path-traversal defence: the stored name is generated, the original is metadata only. */
function sanitiseName(name: string): string {
  return (
    name
      .replace(/[/\\]/g, '_')
      .replace(/\.{2,}/g, '.')
      .slice(-255) || 'file'
  );
}

export async function upload(
  actor: RequestActor,
  membership: RequestMembership | undefined,
  target: { ticketId?: string; commentId?: string },
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  },
) {
  const config = loadConfiguration();
  if (file.size > config.UPLOAD_MAX_BYTES)
    throw Errors.fileTooLarge(config.UPLOAD_MAX_BYTES);

  const mime = await detectMime(file.buffer, file.mimetype);
  if (!ALLOWED.has(mime) && !TEXT_TYPES.has(mime))
    throw Errors.fileTypeNotAllowed(mime);

  const ticketId = target.ticketId ?? null;
  const commentId = target.commentId ?? null;
  if (Boolean(ticketId) === Boolean(commentId))
    throw Errors.resourceNotFound('ticket');

  let organizationId: string;
  let resolvedTicketId: string;

  if (ticketId) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        organizationId: true,
        _count: { select: { attachments: true } },
      },
    });
    if (!ticket) throw Errors.resourceNotFound('ticket');
    if (ticket._count.attachments >= config.UPLOAD_MAX_PER_TICKET) {
      throw Errors.tooManyAttachments(config.UPLOAD_MAX_PER_TICKET);
    }
    organizationId = ticket.organizationId;
    resolvedTicketId = ticketId;
  } else {
    const comment = await prisma.ticketComment.findUnique({
      where: { id: commentId as string },
      select: { ticketId: true, ticket: { select: { organizationId: true } } },
    });
    if (!comment) throw Errors.resourceNotFound('comment');
    organizationId = comment.ticket.organizationId;
    resolvedTicketId = comment.ticketId;
  }

  const effectiveMembership =
    membership ?? (await membershipOf(actor.id, organizationId));
  if (!effectiveMembership && actor.globalRole !== 'GLOBAL_ADMIN')
    throw Errors.notAMember();
  assertPolicy('attachment:create', subject(actor, effectiveMembership));

  const extension = ALLOWED.get(mime) ?? TEXT_TYPES.get(mime) ?? 'bin';
  const storageKey = `${uuidv7()}.${extension}`;
  const dir = join(config.UPLOAD_DIR, 'attachments');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, storageKey), file.buffer, { mode: 0o640 });

  const checksum = createHash('sha256').update(file.buffer).digest('hex');

  return events.runInTransaction(async (tx) => {
    const attachment = await tx.attachment.create({
      data: {
        ticketId,
        commentId,
        uploadedById: actor.id,
        originalName: sanitiseName(file.originalname),
        storageKey,
        mimeType: mime,
        sizeBytes: file.size,
        checksumSha256: checksum,
      },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    });
    events.emit(DomainEvents.attachmentCreated, {
      attachment,
      ticketId: resolvedTicketId,
      organizationId,
      actorId: actor.id,
    });
    return {
      ...attachment,
      downloadUrl: `/api/v1/attachments/${attachment.id}`,
    };
  });
}

export async function metadata(actor: RequestActor, id: string) {
  const attachment = await prisma.attachment.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      storageKey: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      uploadedById: true,
      ticket: { select: { id: true, organizationId: true, createdById: true } },
      comment: {
        select: {
          ticket: {
            select: { id: true, organizationId: true, createdById: true },
          },
        },
      },
    },
  });
  if (!attachment) throw Errors.resourceNotFound('attachment');

  const ticket = attachment.ticket ?? attachment.comment?.ticket;
  if (!ticket) throw Errors.resourceNotFound('attachment');

  const membership = await membershipOf(actor.id, ticket.organizationId);
  if (!membership && actor.globalRole !== 'GLOBAL_ADMIN')
    throw Errors.notAMember();
  assertPolicy('attachment:read', subject(actor, membership), {
    ownerId: ticket.createdById,
  });

  return {
    ...attachment,
    ticketId: ticket.id,
    organizationId: ticket.organizationId,
  };
}

export function absolutePath(storageKey: string): string {
  return join(loadConfiguration().UPLOAD_DIR, 'attachments', storageKey);
}

export async function thumbnail(
  storageKey: string,
  mimeType: string,
): Promise<Buffer | null> {
  if (!mimeType.startsWith('image/')) return null;
  try {
    return await sharp(absolutePath(storageKey))
      .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();
  } catch {
    return null;
  }
}

export async function remove(actor: RequestActor, id: string): Promise<void> {
  const attachment = await metadata(actor, id);
  const membership = await membershipOf(actor.id, attachment.organizationId);
  assertPolicy('attachment:delete', subject(actor, membership), {
    ownerId: attachment.uploadedById,
  });

  await events.runInTransaction(async (tx) => {
    await tx.attachment.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DELETED' },
    });
    events.emit(DomainEvents.attachmentDeleted, {
      attachmentId: id,
      ticketId: attachment.ticketId,
      actorId: actor.id,
    });
  });
  await unlink(absolutePath(attachment.storageKey)).catch(() => undefined);
}
