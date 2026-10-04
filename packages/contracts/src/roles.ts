import { z } from 'zod';
import { emailSchema } from './common.ts';
import { orgRoleSchema, type GlobalRole, type OrgRole } from './enums.ts';

/**
 * Role assignment BY E-MAIL ADDRESS, at the two levels the platform has.
 *
 * The address does not need an account yet. When it has a verified one, the
 * role is applied at once. When it has none - or has one whose address was
 * never verified - the role is RESERVED for that address, and reaches the
 * account the moment the address is verified. The person always creates the
 * account themselves; the administrator only establishes the link.
 *
 * Verification is the condition, not registration: otherwise anybody who
 * registered someone else's address first would inherit that person's role.
 */

/**
 * Platform roles that can be given. Only the ones ABOVE the default: every
 * account already is a USER, so reserving USER would mean nothing. Taking the
 * role back from an account is `PATCH /users/:id/role`.
 */
export const grantablePlatformRoleSchema = z.enum(['GLOBAL_ADMIN']);

export const assignPlatformRoleSchema = z.object({
  email: emailSchema,
  globalRole: grantablePlatformRoleSchema,
});

export const assignOrganizationRoleSchema = z.object({
  email: emailSchema,
  role: orgRoleSchema,
});

export type AssignPlatformRoleInput = z.infer<typeof assignPlatformRoleSchema>;
export type AssignOrganizationRoleInput = z.infer<
  typeof assignOrganizationRoleSchema
>;

/**
 * What an assignment did:
 *   - APPLIED:   a verified account had the address; its role changed now.
 *   - UNCHANGED: that account already had exactly this role.
 *   - RESERVED:  no verified account yet; the role waits for it.
 */
export type RoleAssignmentOutcome = 'APPLIED' | 'RESERVED' | 'UNCHANGED';

/** Why a reservation is still waiting. */
export type ReservationWaitingFor = 'ACCOUNT' | 'VERIFICATION';

export interface RoleReservationActor {
  id: string;
  username: string;
  displayName: string;
}

export interface PlatformRoleReservation {
  id: string;
  email: string;
  globalRole: GlobalRole;
  waitingFor: ReservationWaitingFor;
  grantedBy: RoleReservationActor | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationRoleReservation {
  id: string;
  organizationId: string;
  email: string;
  role: OrgRole;
  waitingFor: ReservationWaitingFor;
  grantedBy: RoleReservationActor | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoleAssignmentAccount {
  id: string;
  username: string;
  displayName: string;
}

export interface PlatformRoleAssignment {
  outcome: RoleAssignmentOutcome;
  email: string;
  globalRole: GlobalRole;
  /** The account the role reached (APPLIED, UNCHANGED). */
  user: RoleAssignmentAccount | null;
  /** The reservation that now waits (RESERVED). */
  reservation: PlatformRoleReservation | null;
}

export interface OrganizationRoleAssignment {
  outcome: RoleAssignmentOutcome;
  email: string;
  role: OrgRole;
  user: RoleAssignmentAccount | null;
  reservation: OrganizationRoleReservation | null;
}

/**
 * A role waiting for the signed-in account, in `SessionUser.pendingRoles`.
 * Only an account whose address is not verified yet can have any: a verified
 * one receives its roles the moment they are assigned.
 */
export interface PendingRole {
  scope: 'PLATFORM' | 'ORGANIZATION';
  role: GlobalRole | OrgRole;
  organizationName: string | null;
}
