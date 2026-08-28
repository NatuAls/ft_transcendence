import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common.ts';
import { notificationActionSchema, notificationEntitySchema } from './enums.ts';

/** Friendship, chat and notification contracts. */

export const sendFriendRequestSchema = z
  .object({
    userId: uuidSchema.optional(),
    username: z.string().trim().min(3).max(32).optional(),
  })
  .refine((d) => Boolean(d.userId ?? d.username), {
    message: 'errors.friend.targetRequired',
  });

export const respondFriendRequestSchema = z.object({
  action: z.enum(['ACCEPT', 'DECLINE']),
});

export const openConversationSchema = z.object({ userId: uuidSchema });

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, { message: 'errors.message.empty' }).max(2000),
});

export const markReadSchema = z.object({ messageId: uuidSchema });

export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  unread: z.stringbool().optional(),
  entity: notificationEntitySchema.optional(),
  action: notificationActionSchema.optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ListNotificationsQuery = z.infer<
  typeof listNotificationsQuerySchema
>;
