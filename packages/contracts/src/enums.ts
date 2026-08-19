import { z } from 'zod';

/**
 * Domain enumerations shared by the API and the web client.
 */
export const globalRoleSchema = z.enum(['USER', 'GLOBAL_ADMIN']);
export const orgRoleSchema = z.enum(['MEMBER', 'AGENT', 'ORG_ADMIN']);
export const ticketStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
export const ticketPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const friendshipStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED']);
export const localeSchema = z.enum(['EN', 'ES', 'AR']);
export const notificationEntitySchema = z.enum([
  'TICKET',
  'COMMENT',
  'ATTACHMENT',
  'ORGANIZATION',
  'MEMBERSHIP',
  'CATEGORY',
  'FRIENDSHIP',
  'MESSAGE',
  'ACCOUNT',
]);
export const notificationActionSchema = z.enum(['CREATED', 'UPDATED', 'DELETED']);
export const gdprRequestTypeSchema = z.enum(['EXPORT', 'DELETE']);
export const apiScopeSchema = z.enum([
  'tickets:read',
  'tickets:write',
  'comments:read',
  'comments:write',
  'categories:read',
  'categories:write',
  'stats:read',
]);

export type GlobalRole = z.infer<typeof globalRoleSchema>;
export type OrgRole = z.infer<typeof orgRoleSchema>;
export type TicketStatus = z.infer<typeof ticketStatusSchema>;
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;
export type FriendshipStatus = z.infer<typeof friendshipStatusSchema>;
export type Locale = z.infer<typeof localeSchema>;
export type NotificationEntity = z.infer<typeof notificationEntitySchema>;
export type NotificationAction = z.infer<typeof notificationActionSchema>;
export type GdprRequestType = z.infer<typeof gdprRequestTypeSchema>;
export type ApiScope = z.infer<typeof apiScopeSchema>;

/**
 * The only legal ticket state transitions. Anything outside this graph must
 * fail with 409 TICKET_INVALID_TRANSITION, both through the web app and
 * through the public API.
 */
export const TICKET_TRANSITIONS: Readonly<Record<TicketStatus, readonly TicketStatus[]>> =
  Object.freeze({
    OPEN: ['IN_PROGRESS', 'CLOSED'],
    IN_PROGRESS: ['RESOLVED'],
    RESOLVED: ['CLOSED', 'IN_PROGRESS'],
    CLOSED: ['IN_PROGRESS'],
  });

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return TICKET_TRANSITIONS[from].includes(to);
}
