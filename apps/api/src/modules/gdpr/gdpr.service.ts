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
import { removeAvatarFile } from '../users/avatar-storage.ts';

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
  // The front end is a hash router (apps/web/src/app/routes.ts), so the link
  // has to carry the route in the fragment. The previous one pointed at
  // /app/settings/privacy/confirm, a path that exists nowhere: nginx served
  // index.html, the router saw an empty hash and sent the person to the home
  // screen with the token lost on the way.
  const view =
    type === 'EXPORT' ? 'account/export-requested' : 'account/delete';
  await sendGdprConfirmation(
    user.email,
    user.profile?.firstName ?? 'there',
    type,
    `${origin}/#${view}?token=${token}`,
  );
  return gdprRequest;
}

export async function confirm(
  userId: string,
  type: 'EXPORT' | 'DELETE',
  token: string,
  /** Needed to build the link of the "your archive is ready" e-mail. */
  origin: string,
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
    void buildExport(userId, req.id, origin).catch((error: unknown) =>
      logger.error(`export ${req.id} failed`, error),
    );
    return { id: req.id, status: 'PROCESSING' as const };
  }

  await erase(userId);
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

async function buildExport(
  userId: string,
  requestId: string,
  origin: string,
): Promise<void> {
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
    `${origin}/#account/export-ready`,
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
 * Real erasure, and the only way an account is erased: the person deleting
 * their own (at once, after the two confirmations), an administrator erasing
 * a closed account early, and the maintenance job when the grace period of a
 * closed account ends.
 *
 * Content that must survive for the integrity of other people's records is
 * anonymised rather than deleted, which is what GDPR actually allows: the
 * tickets the person opened and their comments on tickets stay, under an
 * anonymous author. Everything that is only theirs goes: profile, photo,
 * private messages, notifications, friendships, memberships, sessions, files,
 * data exports, and the roles still reserved for their address. Open tickets
 * assigned to them go back to the unassigned queue, as when a member leaves,
 * and the API keys they created are revoked — they stopped working anyway,
 * and the list would say otherwise.
 *
 * Erasing an account that is already erased does nothing.
 */
export async function erase(userId: string): Promise<void> {
  const config = loadConfiguration();
  const now = new Date();
  // El id entero, no un trozo. Los ids son UUIDv7 y sus primeros caracteres
  // son la hora: con `slice(0, 8)` dos cuentas creadas en el mismo minuto
  // recibían el mismo `deleted_…`, y la segunda en borrarse chocaba con el
  // correo único de la primera — un 409 que dejaba sus datos sin borrar.
  const anon = `deleted_${userId.replace(/-/g, '')}`;
  const [user, attachments, exports] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        deletedAt: true,
        email: true,
        erasedAt: true,
        profile: { select: { avatarUrl: true } },
      },
    }),
    prisma.attachment.findMany({
      where: { uploadedById: userId },
      select: { storageKey: true },
    }),
    prisma.gdprRequest.findMany({
      where: { userId, artifactPath: { not: null } },
      select: { artifactPath: true },
    }),
  ]);
  if (!user || user.erasedAt) return;

  await prisma.$transaction([
    prisma.message.updateMany({
      where: { senderId: userId },
      data: { body: '[deleted]', deletedAt: now },
    }),
    prisma.ticket.updateMany({
      where: { assignedToId: userId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      data: { assignedToId: null },
    }),
    prisma.apiKey.updateMany({
      where: { createdById: userId, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.platformRoleGrant.deleteMany({ where: { email: user.email } }),
    prisma.organizationRoleGrant.deleteMany({ where: { email: user.email } }),
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
      data: { deletedAt: now, status: 'DELETED' },
    }),
    prisma.gdprRequest.updateMany({
      where: { userId, artifactPath: { not: null } },
      data: { artifactPath: null },
    }),
    prisma.userProfile.updateMany({
      where: { userId },
      data: {
        firstName: 'Deleted',
        lastName: 'User',
        displayName: 'Deleted user',
        bio: null,
        jobTitle: null,
        avatarUrl: null,
        isOnline: false,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        // The address is free again from here on: the person can come back
        // with it as somebody new.
        email: `${anon}@deleted.local`,
        username: anon,
        passwordHash: 'deleted',
        isActive: false,
        deletedAt: user.deletedAt ?? now,
        erasedAt: now,
      },
    }),
  ]);

  // The files after the database: if the transaction had failed, nothing
  // would be half gone. Each of them was reachable by whoever had its link or
  // its download, so none stays behind.
  for (const attachment of attachments) {
    await unlink(
      join(config.UPLOAD_DIR, 'attachments', attachment.storageKey),
    ).catch(() => undefined);
  }
  for (const { artifactPath } of exports) {
    if (artifactPath)
      await unlink(join(exportDir(), artifactPath)).catch(() => undefined);
  }
  await removeAvatarFile(user.profile?.avatarUrl);
  logger.info(`erasure completed for ${userId}`);
}

/**
 * Data exports whose download window has closed lose their file too: the
 * archive holds everything about a person, and nobody can download it any
 * more. Returns how many were removed.
 */
export async function pruneExpiredExports(): Promise<number> {
  const stale = await prisma.gdprRequest.findMany({
    where: {
      type: 'EXPORT',
      artifactPath: { not: null },
      expiresAt: { lt: new Date() },
    },
    select: { id: true, artifactPath: true },
  });
  for (const { artifactPath } of stale) {
    if (artifactPath)
      await unlink(join(exportDir(), artifactPath)).catch(() => undefined);
  }
  if (stale.length)
    await prisma.gdprRequest.updateMany({
      where: { id: { in: stale.map((row) => row.id) } },
      data: { artifactPath: null },
    });
  return stale.length;
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
