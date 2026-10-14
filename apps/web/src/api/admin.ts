import {
  adminUpdateUserSchema,
  type GlobalRole,
  type Paginated,
} from 'contracts';
import { request } from '../core/api/client';

/** One account as `GET /users` returns it to a platform administrator. */
export interface PlatformUser {
  _count: { memberships: number; ticketsCreated: number };
  createdAt: string;
  /** When an administrator closed it; listed only with `includeClosed`. */
  deletedAt: string | null;
  email: string;
  emailVerifiedAt: string | null;
  /** When the personal data of a closed account will be erased. */
  erasureDueAt: string | null;
  globalRole: GlobalRole;
  id: string;
  isActive: boolean;
  isPrimary: boolean;
  lastLoginAt: string | null;
  profile: {
    avatarUrl: string | null;
    displayName: string;
    isOnline: boolean;
  } | null;
  username: string;
}

export function listUsers(filters: {
  globalRole?: GlobalRole;
  /** Also the accounts closed and still waiting for their erasure. */
  includeClosed?: boolean;
  isActive?: boolean;
  q?: string;
}): Promise<Paginated<PlatformUser>> {
  const search = new URLSearchParams({
    order: 'asc',
    sort: 'createdAt',
    take: '100',
  });
  if (filters.q) search.set('q', filters.q);
  if (filters.globalRole) search.set('globalRole', filters.globalRole);
  if (filters.isActive !== undefined)
    search.set('isActive', String(filters.isActive));
  if (filters.includeClosed) search.set('includeClosed', 'true');
  return request(`/users?${search.toString()}`);
}

export async function updateUserName(
  id: string,
  fullName: string,
): Promise<void> {
  const [firstName = '', ...rest] = fullName.trim().split(/\s+/);
  const lastName = rest.join(' ');
  await request(`/users/${id}`, {
    method: 'PATCH',
    body: adminUpdateUserSchema.parse({
      firstName,
      ...(lastName ? { lastName } : {}),
    }),
  });
}

export async function setUserStatus(
  id: string,
  isActive: boolean,
): Promise<void> {
  await request(`/users/${id}/status`, {
    method: 'PATCH',
    body: { isActive },
  });
}

export async function setGlobalRole(
  id: string,
  globalRole: GlobalRole,
): Promise<void> {
  await request(`/users/${id}/role`, {
    method: 'PATCH',
    body: { globalRole },
  });
}

/**
 * Closes the account: sessions revoked, sign-in refused at once, and its
 * personal data erased `ACCOUNT_ERASURE_GRACE_DAYS` later unless restored.
 */
export async function deleteUser(id: string): Promise<void> {
  await request(`/users/${id}`, { method: 'DELETE' });
}

/** Undoes the closure of an account whose data is still there. */
export async function restoreUser(id: string): Promise<void> {
  await request(`/users/${id}/restore`, { method: 'POST' });
}

/** Erases a closed account now, when the person asks for it. */
export async function eraseUser(id: string): Promise<void> {
  await request(`/users/${id}/erase`, { method: 'POST' });
}

/** Platform-wide counters: deleted accounts and organizations do not count. */
export interface PlatformStats {
  activeUsers: number;
  attachments: number;
  messages: number;
  /** OPEN or IN_PROGRESS: «open» in the broad sense, not the status alone. */
  openTickets: number;
  organizations: number;
  tickets: number;
  users: number;
}

export function getPlatformStats(): Promise<PlatformStats> {
  return request('/admin/stats');
}

/** One entry of the audit trail, as the list returns it. */
export interface AuditEntry {
  action: string;
  /** Null for the system, or for an account deleted since. */
  actor: { id: string; username: string } | null;
  createdAt: string;
  entity: string;
  entityId: string | null;
  id: string;
  ip: string | null;
}

/** The whole entry: what the list leaves out, read when it is opened. */
export interface AuditEntryDetail extends AuditEntry {
  after: Record<string, unknown> | null;
  apiKeyId: string | null;
  before: Record<string, unknown> | null;
  userAgent: string | null;
}

/** The filters as the screen and its address keep them. */
export interface AuditFilters {
  action?: string;
  actorId?: string;
  entity?: string;
  /** A day, `YYYY-MM-DD`, as a date field gives it. */
  from?: string;
  page?: number;
  to?: string;
}

export const AUDIT_PAGE_SIZE = 25;

/**
 * A day of the person looking, as a moment the API understands. «To the 14th»
 * means the whole 14th where they are: sent as a bare date, the API would
 * stop at midnight UTC and leave the 14th out.
 */
function dayEdge(day: string | undefined, end: boolean): string | undefined {
  const match = day ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(day) : null;
  if (!match) return undefined;
  const [, year, month, date] = match.map(Number) as [
    number,
    number,
    number,
    number,
  ];
  return (
    end
      ? new Date(year, month - 1, date, 23, 59, 59, 999)
      : new Date(year, month - 1, date)
  ).toISOString();
}

export function listAuditLogs(
  filters: AuditFilters,
): Promise<Paginated<AuditEntry>> {
  const search = new URLSearchParams({
    page: String(filters.page ?? 1),
    take: String(AUDIT_PAGE_SIZE),
  });
  if (filters.entity) search.set('entity', filters.entity);
  if (filters.action) search.set('action', filters.action);
  if (filters.actorId) search.set('actorId', filters.actorId);
  const from = dayEdge(filters.from, false);
  const to = dayEdge(filters.to, true);
  if (from) search.set('from', from);
  if (to) search.set('to', to);
  return request(`/admin/audit-logs?${search.toString()}`);
}

export function getAuditLog(id: string): Promise<AuditEntryDetail> {
  return request(`/admin/audit-logs/${id}`);
}
