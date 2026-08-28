import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import archiver from 'archiver';
import { prisma } from '../../database/prisma.ts';
import {
  sendGdprConfirmation,
  sendGdprExportReady,
} from '../mail/mail.service.ts';
import { createOneTimeToken, hashOneTimeToken } from '../auth/token.ts';
import { loadConfiguration } from '../../config/env.ts';
import { Errors } from '../../common/errors/domain-error.ts';
import { uuidv7 } from '../../common/utils/uuid.ts';
import { createLogger } from '../../common/logger.ts';

const logger = createLogger('gdpr');

const TOKEN_TTL_MS = 30 * 60 * 1000;
const DOWNLOAD_TTL_MS = 24 * 3600 * 1000;

/**
 * GDPR compliance: request your data, delete with confirmation, export in a
 * readable format, and confirmation emails - all verifiable in Mailpit.
 *
 * Deletion is a two-factor confirmation on purpose: the token from the email
 * PLUS typing your own username. Irreversible actions deserve friction.
 */
function exportDir(): string {
  return join(loadConfiguration().UPLOAD_DIR, 'gdpr');
}

export async function request(
  userId: string,
  type: 'EXPORT' | 'DELETE',
  origin: string,
) {
  const pending = await prisma.gdprRequest.findFirst({
    where: {
      userId,
      type,
      status: { in: ['AWAITING_CONFIRMATION', 'CONFIRMED', 'PROCESSING'] },
    },
    select: { id: true },
  });
  if (pending) throw Errors.gdprPending();

  const { token, hash } = createOneTimeToken();
  const gdprRequest = await prisma.gdprRequest.create({
    data: {
      userId,
      type,
      confirmationTokenHash: hash,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
    select: {
      id: true,
      type: true,
      status: true,
      requestedAt: true,
      expiresAt: true,
    },
  });

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, profile: { select: { firstName: true } } },
  });
  const path = type === 'EXPORT' ? 'export' : 'delete';
  await sendGdprConfirmation(
    user.email,
    user.profile?.firstName ?? 'there',
    type,
    `${origin}/app/settings/privacy/confirm?type=${path}&token=${token}`,
  );
  return gdprRequest;
}

export async function confirm(
  userId: string,
  type: 'EXPORT' | 'DELETE',
  token: string,
  confirmUsername?: string,
) {
  const req = await prisma.gdprRequest.findFirst({
    where: {
      userId,
      type,
      status: 'AWAITING_CONFIRMATION',
      confirmationTokenHash: hashOneTimeToken(token),
    },
    select: { id: true, expiresAt: true },
  });
  if (!req || req.expiresAt.getTime() < Date.now())
    throw Errors.gdprTokenInvalid();

  if (type === 'DELETE') {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { username: true },
    });
    if (
      !confirmUsername ||
      confirmUsername.trim().toLowerCase() !== user.username.toLowerCase()
    ) {
      throw Errors.gdprUsernameMismatch();
    }
  }

  await prisma.gdprRequest.update({
    where: { id: req.id },
    data: {
      status: 'PROCESSING',
      confirmedAt: new Date(),
      confirmationTokenHash: null,
    },
  });

  if (type === 'EXPORT') {
    // Run in the background so the HTTP request returns immediately.
    void buildExport(userId, req.id).catch((error: unknown) =>
      logger.error(`export ${req.id} failed`, error),
    );
    return { id: req.id, status: 'PROCESSING' as const };
  }

  await purge(userId);
  await prisma.gdprRequest
    .update({
      where: { id: req.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
    .catch(() => undefined);
  return { id: req.id, status: 'COMPLETED' as const };
}

/** Everything we hold about one person, in JSON plus CSV, plus their files. */
async function collect(userId: string) {
  const [
    user,
    tickets,
    comments,
    messages,
    notifications,
    attachments,
    memberships,
    friendships,
    sessions,
  ] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        globalRole: true,
        locale: true,
        timezone: true,
        createdAt: true,
        lastLoginAt: true,
        emailVerifiedAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
            displayName: true,
            bio: true,
            jobTitle: true,
            avatarUrl: true,
          },
        },
      },
    }),
    prisma.ticket.findMany({
      where: { OR: [{ createdById: userId }, { assignedToId: userId }] },
      select: {
        id: true,
        reference: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        resolution: true,
        createdAt: true,
      },
    }),
    prisma.ticketComment.findMany({
      where: { authorId: userId },
      select: { id: true, ticketId: true, body: true, createdAt: true },
    }),
    prisma.message.findMany({
      where: { senderId: userId },
      select: { id: true, conversationId: true, body: true, createdAt: true },
    }),
    prisma.notification.findMany({
      where: { userId },
      select: {
        id: true,
        entity: true,
        action: true,
        titleKey: true,
        createdAt: true,
        readAt: true,
      },
    }),
    prisma.attachment.findMany({
      where: { uploadedById: userId, deletedAt: null },
      select: {
        id: true,
        originalName: true,
        storageKey: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    }),
    prisma.organizationMember.findMany({
      where: { userId },
      select: {
        role: true,
        joinedAt: true,
        organization: { select: { name: true, slug: true } },
      },
    }),
    prisma.friendship.findMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      select: {
        id: true,
        status: true,
        requesterId: true,
        addresseeId: true,
        createdAt: true,
      },
    }),
    prisma.userSession.findMany({
      where: { userId },
      select: {
        id: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    }),
  ]);
  return {
    user,
    tickets,
    comments,
    messages,
    notifications,
    attachments,
    memberships,
    friendships,
    sessions,
  };
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0] as object);
  const escape = (value: unknown): string => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ].join('\n');
}

async function buildExport(userId: string, requestId: string): Promise<void> {
  const config = loadConfiguration();
  const data = await collect(userId);
  await mkdir(exportDir(), { recursive: true });
  const filename = `${uuidv7()}.zip`;
  const path = join(exportDir(), filename);

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(path);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve());
    archive.on('error', reject);
    archive.pipe(output);

    archive.append(
      [
        'HelpDesk Lite - personal data export',
        '',
        `Account : ${data.user.username} <${data.user.email}>`,
        `Created : ${new Date().toISOString()}`,
        '',
        'Files in this archive:',
        '  data.json          everything, machine readable',
        '  csv/tickets.csv    tickets you created or were assigned',
        '  csv/comments.csv   comments you wrote',
        '  csv/messages.csv   chat messages you sent',
        '  csv/sessions.csv   login sessions (IP and user agent)',
        '  attachments/       files you uploaded',
        '',
        'Rights: you may request rectification or deletion at any time from',
        'Settings > Privacy inside the application.',
      ].join('\n'),
      { name: 'README.txt' },
    );

    archive.append(JSON.stringify(data, null, 2), { name: 'data.json' });
    archive.append(toCsv(data.tickets as never), { name: 'csv/tickets.csv' });
    archive.append(toCsv(data.comments as never), { name: 'csv/comments.csv' });
    archive.append(toCsv(data.messages as never), { name: 'csv/messages.csv' });
    archive.append(toCsv(data.sessions as never), { name: 'csv/sessions.csv' });

    for (const attachment of data.attachments) {
      const source = join(
        config.UPLOAD_DIR,
        'attachments',
        attachment.storageKey,
      );
      archive.file(source, { name: `attachments/${attachment.originalName}` });
    }
    void archive.finalize();
  });

  await prisma.gdprRequest.update({
    where: { id: requestId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      artifactPath: filename,
      expiresAt: new Date(Date.now() + DOWNLOAD_TTL_MS),
    },
  });

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, profile: { select: { firstName: true } } },
  });
  await sendGdprExportReady(
    user.email,
    user.profile?.firstName ?? 'there',
    `/app/settings/privacy`,
  );
}

export async function downloadPath(
  userId: string,
  requestId: string,
): Promise<{ path: string; filename: string }> {
  const req = await prisma.gdprRequest.findFirst({
    where: { id: requestId, userId, type: 'EXPORT', status: 'COMPLETED' },
    select: { artifactPath: true, expiresAt: true },
  });
  if (!req?.artifactPath || req.expiresAt.getTime() < Date.now())
    throw Errors.resourceNotFound('export');
  return {
    path: join(exportDir(), req.artifactPath),
    filename: `helpdesk-lite-export-${new Date().toISOString().slice(0, 10)}.zip`,
  };
}

/**
 * Real erasure. Content that must survive for the integrity of other people's
 * records (a ticket someone else is working on) is anonymised rather than
 * deleted, which is what GDPR actually allows.
 */
async function purge(userId: string): Promise<void> {
  const config = loadConfiguration();
  const anon = `deleted_${userId.slice(0, 8)}`;
  const attachments = await prisma.attachment.findMany({
    where: { uploadedById: userId },
    select: { storageKey: true },
  });

  await prisma.$transaction([
    prisma.message.updateMany({
      where: { senderId: userId },
      data: { body: '[deleted]', deletedAt: new Date() },
    }),
    prisma.ticketComment.updateMany({
      where: { authorId: userId },
      data: { body: '[deleted]', deletedAt: new Date() },
    }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.friendship.deleteMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
    }),
    prisma.conversationMember.deleteMany({ where: { userId } }),
    prisma.organizationMember.deleteMany({ where: { userId } }),
    prisma.userSession.deleteMany({ where: { userId } }),
    prisma.verificationToken.deleteMany({ where: { userId } }),
    prisma.attachment.updateMany({
      where: { uploadedById: userId },
      data: { deletedAt: new Date(), status: 'DELETED' },
    }),
    prisma.userProfile.update({
      where: { userId },
      data: {
        firstName: 'Deleted',
        lastName: 'User',
        displayName: anon,
        bio: null,
        jobTitle: null,
        avatarUrl: null,
        isOnline: false,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        email: `${anon}@deleted.local`,
        username: anon,
        passwordHash: 'deleted',
        isActive: false,
        deletedAt: new Date(),
      },
    }),
  ]);

  for (const attachment of attachments) {
    await unlink(
      join(config.UPLOAD_DIR, 'attachments', attachment.storageKey),
    ).catch(() => undefined);
  }
  logger.info(`GDPR purge completed for ${userId}`);
}

export function listRequests(userId: string) {
  return prisma.gdprRequest.findMany({
    where: { userId },
    orderBy: { requestedAt: 'desc' },
    select: {
      id: true,
      type: true,
      status: true,
      requestedAt: true,
      confirmedAt: true,
      completedAt: true,
      expiresAt: true,
    },
  });
}
