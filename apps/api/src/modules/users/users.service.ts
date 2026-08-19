import { extname } from 'node:path';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import type { ListUsersQuery, UpdatePreferencesInput, UpdateProfileInput } from 'contracts';
import type { GlobalRole } from '../../generated/prisma/client.ts';
import { prisma } from '../../database/prisma.ts';
import { DomainEvents, events } from '../../database/events.ts';
import { loadConfiguration } from '../../config/env.ts';
import { Errors } from '../../common/errors/domain-error.ts';
import { paginate } from '../../common/utils/pagination.ts';
import { uuidv7 } from '../../common/utils/uuid.ts';
import type { RequestActor } from '../../common/types.ts';

export async function publicProfile(username: string) {
  const user = await prisma.user.findFirst({
    where: { username, deletedAt: null },
    select: {
      id: true,
      username: true,
      createdAt: true,
      profile: {
        select: {
          displayName: true,
          avatarUrl: true,
          bio: true,
          jobTitle: true,
          isOnline: true,
          lastSeenAt: true,
        },
      },
      memberships: {
        select: { role: true, organization: { select: { id: true, name: true, slug: true } } },
      },
      _count: { select: { ticketsCreated: true, ticketsAssigned: true, comments: true } },
    },
  });
  if (!user) throw Errors.resourceNotFound('user');
  return {
    id: user.id,
    username: user.username,
    displayName: user.profile?.displayName ?? user.username,
    avatarUrl: user.profile?.avatarUrl ?? null,
    bio: user.profile?.bio ?? null,
    jobTitle: user.profile?.jobTitle ?? null,
    isOnline: user.profile?.isOnline ?? false,
    lastSeenAt: user.profile?.lastSeenAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    organizations: user.memberships.map((m) => ({ ...m.organization, role: m.role })),
    stats: {
      ticketsCreated: user._count.ticketsCreated,
      ticketsAssigned: user._count.ticketsAssigned,
      comments: user._count.comments,
    },
  };
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const profile = await prisma.userProfile.update({
    where: { userId },
    data: {
      ...input,
      ...(input.firstName || input.lastName
        ? {
            displayName:
              input.displayName ?? (`${input.firstName ?? ''} ${input.lastName ?? ''}`.trim() || undefined),
          }
        : {}),
    },
    select: { displayName: true, firstName: true, lastName: true, bio: true, jobTitle: true, avatarUrl: true },
  });
  events.emit(DomainEvents.accountUpdated, { userId });
  return profile;
}

export async function updatePreferences(userId: string, input: UpdatePreferencesInput) {
  const { locale, timezone, theme, ...notify } = input;
  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        ...(locale ? { locale } : {}),
        ...(timezone ? { timezone } : {}),
        ...(theme ? { theme } : {}),
      },
      select: { locale: true, timezone: true, theme: true },
    }),
    prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...notify },
      update: notify,
    }),
  ]);
  return user;
}

/**
 * Avatar upload. Re-encoded through sharp to a fixed 512x512 WebP: this
 * strips EXIF, kills any polyglot payload hidden in the original container,
 * and normalises size.
 */
export async function setAvatar(
  userId: string,
  file: { buffer: Buffer; mimetype: string; size: number; originalname: string },
) {
  const config = loadConfiguration();
  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.mimetype)) throw Errors.fileTypeNotAllowed(file.mimetype);
  if (file.size > 5 * 1024 * 1024) throw Errors.fileTooLarge(5 * 1024 * 1024);

  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected || !allowed.includes(detected.mime)) {
    throw Errors.fileTypeNotAllowed(detected?.mime ?? extname(file.originalname));
  }

  const dir = join(config.UPLOAD_DIR, 'avatars');
  await mkdir(dir, { recursive: true });
  const key = `${uuidv7()}.webp`;
  const output = await sharp(file.buffer).rotate().resize(512, 512, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
  await writeFile(join(dir, key), output);

  const previous = await prisma.userProfile.findUnique({ where: { userId }, select: { avatarUrl: true } });
  const avatarUrl = `/api/v1/users/avatars/${key}`;
  await prisma.userProfile.update({ where: { userId }, data: { avatarUrl } });

  if (previous?.avatarUrl?.startsWith('/api/v1/users/avatars/')) {
    const old = previous.avatarUrl.split('/').pop();
    if (old) await unlink(join(dir, old)).catch(() => undefined);
  }
  events.emit(DomainEvents.accountUpdated, { userId });
  return { avatarUrl };
}

export async function clearAvatar(userId: string) {
  await prisma.userProfile.update({ where: { userId }, data: { avatarUrl: null } });
  return { avatarUrl: null };
}

export async function autocomplete(term: string) {
  if (term.trim().length < 2) return [];
  return prisma.user.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      OR: [
        { username: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ],
    },
    take: 10,
    select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } },
  });
}

// --------------------------------------------------------------- administration --
export async function listAll(query: ListUsersQuery) {
  const where = {
    deletedAt: null,
    ...(query.globalRole ? { globalRole: query.globalRole } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.q
      ? {
          OR: [
            { username: { contains: query.q, mode: 'insensitive' as const } },
            { email: { contains: query.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { [query.sort]: query.order },
      skip: (query.page - 1) * query.take,
      take: query.take,
      select: {
        id: true,
        username: true,
        email: true,
        globalRole: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        emailVerifiedAt: true,
        profile: { select: { displayName: true, avatarUrl: true, isOnline: true } },
        _count: { select: { memberships: true, ticketsCreated: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  return paginate(rows, total, query.page, query.take);
}

export async function setStatus(actor: RequestActor, userId: string, isActive: boolean) {
  if (userId === actor.id) throw Errors.forbiddenAction('suspend your own account');
  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
    select: { id: true, username: true, isActive: true },
  });
  events.emit(DomainEvents.accountUpdated, { userId });
  return user;
}

export async function setGlobalRole(actor: RequestActor, userId: string, globalRole: GlobalRole) {
  if (userId === actor.id) throw Errors.forbiddenAction('change your own global role');
  const user = await prisma.user.update({
    where: { id: userId },
    data: { globalRole },
    select: { id: true, username: true, globalRole: true },
  });
  events.emit(DomainEvents.accountUpdated, { userId });
  return user;
}

export async function softDelete(actor: RequestActor, userId: string): Promise<void> {
  if (userId === actor.id) throw Errors.forbiddenAction('delete your own account here');
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date(), isActive: false },
  });
  await prisma.userSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  events.emit(DomainEvents.accountDeleted, { userId });
}
