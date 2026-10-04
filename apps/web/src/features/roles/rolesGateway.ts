import type {
  AssignOrganizationRoleInput,
  AssignPlatformRoleInput,
  OrgRole,
  PendingRole,
  OrganizationRoleAssignment,
  OrganizationRoleReservation,
  PlatformRoleAssignment,
  PlatformRoleReservation,
  ReservationWaitingFor,
} from 'contracts';
import * as api from '../../api/roles';
import type {
  OrganizationMemberRow,
  PlatformAdministrator,
} from '../../api/roles';
import { previewMode, type Permission } from '../../app/session';
import { organizationFixture } from '../organization/organizationData';

export type { OrganizationMemberRow, PlatformAdministrator };

/**
 * What the two role screens need, whichever side answers. Against the API in
 * the real application; in memory in the frontend preview, so the screens can
 * be reviewed without a backend and the markup never knows the difference.
 */
export interface RolesGateway {
  assignOrganizationRole(
    organizationId: string,
    input: AssignOrganizationRoleInput,
  ): Promise<OrganizationRoleAssignment>;
  assignPlatformRole(
    input: AssignPlatformRoleInput,
  ): Promise<PlatformRoleAssignment>;
  cancelOrganizationReservation(
    organizationId: string,
    id: string,
  ): Promise<void>;
  cancelPlatformReservation(id: string): Promise<void>;
  changeMemberRole(
    organizationId: string,
    userId: string,
    role: OrgRole,
  ): Promise<void>;
  listMembers(organizationId: string): Promise<OrganizationMemberRow[]>;
  listOrganizationReservations(
    organizationId: string,
  ): Promise<OrganizationRoleReservation[]>;
  listPlatformAdministrators(): Promise<PlatformAdministrator[]>;
  listPlatformReservations(): Promise<PlatformRoleReservation[]>;
  removeMember(organizationId: string, userId: string): Promise<void>;
  withdrawPlatformRole(userId: string): Promise<void>;
}

// -------------------------------------------------------------- vocabulary --

export const organizationRoles: Array<{
  description: string;
  label: string;
  value: OrgRole;
}> = [
  {
    description: 'Opens tickets and follows their own requests.',
    label: 'Member',
    value: 'MEMBER',
  },
  {
    description:
      'Works every ticket of the organization: status, self-assignment and internal notes.',
    label: 'Support agent',
    value: 'AGENT',
  },
  {
    description:
      'Everything an agent does, plus members, roles, categories, API keys and the organization itself.',
    label: 'Organization admin',
    value: 'ORG_ADMIN',
  },
];

export function organizationRoleLabel(role: OrgRole) {
  return organizationRoles.find((item) => item.value === role)?.label ?? role;
}

export function pendingRoleText(role: PendingRole) {
  return role.scope === 'PLATFORM'
    ? 'Platform administrator'
    : `${organizationRoleLabel(role.role as OrgRole)} in ${role.organizationName ?? 'an organization'}`;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export function formatDate(value: string | null) {
  return value ? dateFormat.format(new Date(value)) : 'Never';
}

export const waitingForLabel: Record<ReservationWaitingFor, string> = {
  ACCOUNT: 'Waiting for the account',
  VERIFICATION: 'Waiting for e-mail confirmation',
};

export const waitingForHint: Record<ReservationWaitingFor, string> = {
  ACCOUNT: 'Nobody has registered this address yet.',
  VERIFICATION: 'The account exists; its address is not confirmed yet.',
};

/**
 * What each organization role can do, read from the same permission lists
 * the interface uses to show or hide controls (`app/session.ts`).
 */
export const organizationCapabilities: Array<{
  label: string;
  permission: Permission;
}> = [
  { label: 'Open tickets and comment on them', permission: 'ticket:create' },
  { label: 'See every ticket of the organization', permission: 'ticket:read' },
  {
    label: 'Change status and take tickets',
    permission: 'ticket:changeStatus',
  },
  { label: 'Write internal notes', permission: 'comment:createInternal' },
  { label: 'Read organization statistics', permission: 'stats:read' },
  { label: 'Assign tickets to other agents', permission: 'ticket:assignOther' },
  { label: 'Manage categories', permission: 'category:write' },
  { label: 'Assign roles and manage members', permission: 'member:invite' },
  {
    label: 'Edit or delete the organization',
    permission: 'organization:update',
  },
  { label: 'Manage API keys', permission: 'apiKey:manage' },
];

// ---------------------------------------------------------------- preview --

const previewLabelToRole: Record<string, OrgRole> = {
  Agent: 'AGENT',
  Member: 'MEMBER',
  'Organization admin': 'ORG_ADMIN',
};

/** Addresses the preview treats as verified accounts. Anything else has none. */
const previewVerified = new Set([
  'ana@helio.test',
  'ana@northstar.test',
  'john.lee@northstar.test',
  'lena.patel@northstar.test',
  'lena@orbit.test',
  'maya.singh@northstar.test',
  'mia.chen@northstar.test',
  'noah@orbit.test',
  'sam@helpdesk.test',
  'sofia@helio.test',
]);
/** Registered, but the address was never confirmed. */
const previewUnverified = new Set(['carlos.vega@northstar.test']);

const previewNames: Record<string, string> = {
  'ana@helio.test': 'Ana Ruiz',
  'ana@northstar.test': 'Ana Ruiz',
  'carlos.vega@northstar.test': 'Carlos Vega',
  'john.lee@northstar.test': 'John Lee',
  'lena.patel@northstar.test': 'Lena Patel',
  'lena@orbit.test': 'Lena Patel',
  'maya.singh@northstar.test': 'Maya Singh',
  'mia.chen@northstar.test': 'Mia Chen',
  'noah@orbit.test': 'Noah Kim',
  'sam@helpdesk.test': 'Sam Okafor',
  'sofia@helio.test': 'Sofia Ortega',
};

/** The preview identities (`app/session.ts`), so "you" is recognised. */
const previewSessionIds: Record<string, string> = {
  'john.lee@northstar.test': 'preview-member',
  'maya.singh@northstar.test': 'preview-agent',
  'mia.chen@northstar.test': 'preview-organization-admin',
  'sam@helpdesk.test': 'preview-global-admin',
};

const previewGrantor = {
  displayName: 'Sam Okafor',
  id: 'preview-global-admin',
  username: 'sam',
};

let previewId = 0;
const nextId = (prefix: string) => `${prefix}-${(previewId += 1)}`;
const now = () => new Date().toISOString();
const later = <T>(value: T) =>
  new Promise<T>((resolve) => window.setTimeout(() => resolve(value), 120));

function previewAccount(email: string) {
  const displayName = previewNames[email] ?? email.split('@')[0] ?? email;
  return {
    displayName,
    id: previewSessionIds[email] ?? `preview-${email}`,
    username: email.split('@')[0] ?? email,
  };
}

function waitingFor(email: string): ReservationWaitingFor {
  return previewUnverified.has(email) ? 'VERIFICATION' : 'ACCOUNT';
}

const previewAdministrators: PlatformAdministrator[] = [
  {
    avatarUrl: null,
    displayName: 'Administración',
    email: 'recovery@helpdesk.invalid',
    emailVerified: true,
    id: 'preview-primary-admin',
    isActive: true,
    isPrimary: true,
    lastLoginAt: null,
    username: 'recovery',
  },
  {
    avatarUrl: null,
    displayName: 'Sam Okafor',
    email: 'sam@helpdesk.test',
    emailVerified: true,
    id: 'preview-global-admin',
    isActive: true,
    isPrimary: false,
    lastLoginAt: now(),
    username: 'sam',
  },
];
const previewPlatformReservations: PlatformRoleReservation[] = [];
const previewMembers = new Map<string, OrganizationMemberRow[]>();
const previewReservations = new Map<string, OrganizationRoleReservation[]>();

function seedOrganization(organizationId: string) {
  if (previewMembers.has(organizationId)) return;
  const rows = organizationFixture(organizationId).members;
  previewMembers.set(
    organizationId,
    rows
      .filter((row) => row[4] === 'Active')
      .map((row) => ({
        avatarUrl: null,
        displayName: row[1],
        email: row[2],
        isOnline: row[1] !== 'Lena Patel',
        joinedAt: '2026-09-01T09:00:00.000Z',
        role: previewLabelToRole[row[3]] ?? 'MEMBER',
        userId: previewSessionIds[row[2]] ?? `preview-${row[2]}`,
        username: row[2].split('@')[0] ?? row[2],
      })),
  );
  previewReservations.set(
    organizationId,
    rows
      .filter((row) => row[4] !== 'Active')
      .map((row) => ({
        createdAt: '2026-09-28T10:00:00.000Z',
        email: row[2],
        grantedBy: previewGrantor,
        id: nextId('preview-reservation'),
        organizationId,
        role: previewLabelToRole[row[3]] ?? 'MEMBER',
        updatedAt: '2026-09-28T10:00:00.000Z',
        waitingFor: waitingFor(row[2]),
      })),
  );
}

const previewGateway: RolesGateway = {
  async assignOrganizationRole(organizationId, input) {
    seedOrganization(organizationId);
    const members = previewMembers.get(organizationId)!;
    const reservations = previewReservations.get(organizationId)!;
    const email = input.email.trim().toLowerCase();
    const member = members.find((row) => row.email === email);
    if (member) {
      const unchanged = member.role === input.role;
      member.role = input.role;
      return later({
        email,
        outcome: unchanged ? 'UNCHANGED' : 'APPLIED',
        reservation: null,
        role: input.role,
        user: previewAccount(email),
      });
    }
    if (previewVerified.has(email)) {
      members.push({
        avatarUrl: null,
        displayName: previewAccount(email).displayName,
        email,
        isOnline: false,
        joinedAt: now(),
        role: input.role,
        userId: previewAccount(email).id,
        username: previewAccount(email).username,
      });
      return later({
        email,
        outcome: 'APPLIED',
        reservation: null,
        role: input.role,
        user: previewAccount(email),
      });
    }
    const existing = reservations.find((row) => row.email === email);
    const reservation: OrganizationRoleReservation = existing
      ? { ...existing, role: input.role, updatedAt: now() }
      : {
          createdAt: now(),
          email,
          grantedBy: previewGrantor,
          id: nextId('preview-reservation'),
          organizationId,
          role: input.role,
          updatedAt: now(),
          waitingFor: waitingFor(email),
        };
    previewReservations.set(organizationId, [
      reservation,
      ...reservations.filter((row) => row.email !== email),
    ]);
    return later({
      email,
      outcome: 'RESERVED',
      reservation,
      role: input.role,
      user: null,
    });
  },
  async assignPlatformRole(input) {
    const email = input.email.trim().toLowerCase();
    const administrator = previewAdministrators.find(
      (row) => row.email === email,
    );
    if (administrator) {
      return later({
        email,
        globalRole: input.globalRole,
        outcome: 'UNCHANGED',
        reservation: null,
        user: previewAccount(email),
      });
    }
    if (previewVerified.has(email)) {
      previewAdministrators.push({
        avatarUrl: null,
        displayName: previewAccount(email).displayName,
        email,
        emailVerified: true,
        id: previewAccount(email).id,
        isActive: true,
        isPrimary: false,
        lastLoginAt: null,
        username: previewAccount(email).username,
      });
      return later({
        email,
        globalRole: input.globalRole,
        outcome: 'APPLIED',
        reservation: null,
        user: previewAccount(email),
      });
    }
    const index = previewPlatformReservations.findIndex(
      (row) => row.email === email,
    );
    const reservation: PlatformRoleReservation = {
      createdAt:
        index >= 0 ? previewPlatformReservations[index].createdAt : now(),
      email,
      globalRole: input.globalRole,
      grantedBy: previewGrantor,
      id:
        index >= 0
          ? previewPlatformReservations[index].id
          : nextId('preview-platform-reservation'),
      updatedAt: now(),
      waitingFor: waitingFor(email),
    };
    if (index >= 0) previewPlatformReservations.splice(index, 1);
    previewPlatformReservations.unshift(reservation);
    return later({
      email,
      globalRole: input.globalRole,
      outcome: 'RESERVED',
      reservation,
      user: null,
    });
  },
  async cancelOrganizationReservation(organizationId, id) {
    seedOrganization(organizationId);
    previewReservations.set(
      organizationId,
      previewReservations.get(organizationId)!.filter((row) => row.id !== id),
    );
    return later(undefined);
  },
  async cancelPlatformReservation(id) {
    const index = previewPlatformReservations.findIndex((row) => row.id === id);
    if (index >= 0) previewPlatformReservations.splice(index, 1);
    return later(undefined);
  },
  async changeMemberRole(organizationId, userId, role) {
    seedOrganization(organizationId);
    const members = previewMembers.get(organizationId)!;
    const target = members.find((row) => row.userId === userId);
    if (
      target?.role === 'ORG_ADMIN' &&
      role !== 'ORG_ADMIN' &&
      members.filter((row) => row.role === 'ORG_ADMIN').length <= 1
    ) {
      throw new Error('An organization must keep at least one administrator.');
    }
    if (target) target.role = role;
    return later(undefined);
  },
  async listMembers(organizationId) {
    seedOrganization(organizationId);
    return later(
      previewMembers.get(organizationId)!.map((row) => ({ ...row })),
    );
  },
  async listOrganizationReservations(organizationId) {
    seedOrganization(organizationId);
    return later([...previewReservations.get(organizationId)!]);
  },
  async listPlatformAdministrators() {
    return later(previewAdministrators.map((row) => ({ ...row })));
  },
  async listPlatformReservations() {
    return later([...previewPlatformReservations]);
  },
  async removeMember(organizationId, userId) {
    seedOrganization(organizationId);
    const members = previewMembers.get(organizationId)!;
    const target = members.find((row) => row.userId === userId);
    if (
      target?.role === 'ORG_ADMIN' &&
      members.filter((row) => row.role === 'ORG_ADMIN').length <= 1
    ) {
      throw new Error('An organization must keep at least one administrator.');
    }
    previewMembers.set(
      organizationId,
      members.filter((row) => row.userId !== userId),
    );
    return later(undefined);
  },
  async withdrawPlatformRole(userId) {
    const index = previewAdministrators.findIndex((row) => row.id === userId);
    if (index >= 0) previewAdministrators.splice(index, 1);
    return later(undefined);
  },
};

export const rolesGateway: RolesGateway = previewMode ? previewGateway : api;
