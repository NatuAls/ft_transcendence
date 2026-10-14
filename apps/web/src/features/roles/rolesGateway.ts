import type {
  AssignOrganizationRoleInput,
  AssignPlatformRoleInput,
  OrgRole,
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
import i18next from 'i18next';
import { ApiError } from '../../core/api/errors';
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

/** The three organization roles, from the least access to the most. */
export const organizationRoles: Array<{ value: OrgRole }> = [
  { value: 'MEMBER' },
  { value: 'AGENT' },
  { value: 'ORG_ADMIN' },
];

/*
 * Los textos se traducen al LLAMAR, no al importar el módulo: el idioma puede
 * cambiar con la aplicación abierta, y una constante calculada al cargar se
 * quedaría para siempre en el primero.
 */

export function organizationRoleLabel(role: OrgRole) {
  return i18next.t(`organization.role.${role}`);
}

export function organizationRoleDescription(role: OrgRole) {
  return i18next.t(`organization.roleDescription.${role}`);
}

/** A date in the language of the interface, not in the browser's. */
export function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(i18next.language, {
        dateStyle: 'medium',
      }).format(new Date(value))
    : i18next.t('organization.access.never');
}

/**
 * What each organization role can do, read from the same permission lists
 * the interface uses to show or hide controls (`app/session.ts`). `key` names
 * the text in `organization.access.capabilities`.
 */
export const organizationCapabilities: Array<{
  key: string;
  permission: Permission;
}> = [
  { key: 'createTickets', permission: 'ticket:create' },
  { key: 'readAllTickets', permission: 'ticket:read' },
  { key: 'changeStatus', permission: 'ticket:changeStatus' },
  { key: 'internalNotes', permission: 'comment:createInternal' },
  { key: 'readStats', permission: 'stats:read' },
  { key: 'assignOthers', permission: 'ticket:assignOther' },
  { key: 'manageCategories', permission: 'category:write' },
  { key: 'manageMembers', permission: 'member:invite' },
  { key: 'manageOrganization', permission: 'organization:update' },
  { key: 'manageApiKeys', permission: 'apiKey:manage' },
];

// ---------------------------------------------------------------- preview --

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

/** Lo que respondería la API: con su clave, para que se traduzca igual. */
const lastAdministrator = () =>
  new ApiError(
    {
      code: 'ORG_LAST_ADMIN',
      message: 'An organization must keep at least one administrator.',
      messageKey: 'errors.org.lastAdmin',
    },
    409,
  );

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
      .filter((row) => row.waitingFor === null)
      .map((row) => ({
        avatarUrl: null,
        displayName: row.name,
        email: row.email,
        isOnline: row.name !== 'Lena Patel',
        joinedAt: '2026-09-01T09:00:00.000Z',
        role: row.role,
        userId: previewSessionIds[row.email] ?? `preview-${row.email}`,
        username: row.email.split('@')[0] ?? row.email,
      })),
  );
  previewReservations.set(
    organizationId,
    rows
      .filter((row) => row.waitingFor !== null)
      .map((row) => ({
        createdAt: '2026-09-28T10:00:00.000Z',
        email: row.email,
        grantedBy: previewGrantor,
        id: nextId('preview-reservation'),
        organizationId,
        role: row.role,
        updatedAt: '2026-09-28T10:00:00.000Z',
        waitingFor: waitingFor(row.email),
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
      throw lastAdministrator();
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
      throw lastAdministrator();
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
