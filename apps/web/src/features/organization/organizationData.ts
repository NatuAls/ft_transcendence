import type { OrgRole, ReservationWaitingFor } from 'contracts';
import type { OrganizationStats } from '../../api/organizations';

export type OrgTab = 'members' | 'roles' | 'categories' | 'apiKeys';
export type OrganizationDialogKind =
  'add-member' | 'edit-member' | 'settings' | 'category' | 'delete' | null;
export type DeleteContext = 'edit-member' | 'settings' | null;

/*
 * Las filas de las tablas de la organización. Cada una lleva su
 * IDENTIFICADOR, porque el nombre no sirve para saber de quién es: tres
 * cuentas distintas pueden llamarse igual. Cuando eso pasaba, las filas
 * compartían clave de React —aparecían repetidas o fantasma al recargarse la
 * lista— y, peor, las acciones se aplicaban a la cuenta equivocada, porque la
 * pantalla buscaba el identificador por nombre. Se vio el 09/10 con tres
 * cuentas «Felipe Cela». Los datos de muestra lo omiten: ahí los nombres no se
 * repiten.
 *
 * Rol y espera van como CÓDIGOS (`AGENT`, `ACCOUNT`…) y la pantalla los
 * traduce al pintarlos. Antes eran el texto en inglés —«Agent», «Invited»— y
 * la lógica comparaba contra ese texto, así que traducirlo la habría roto.
 */

/** Alguien en la pestaña de miembros: un miembro o una reserva de rol. */
export interface MemberRow {
  email: string;
  /** El de la cuenta si es un miembro; el de la reserva si es una reserva. */
  id?: string;
  initials: string;
  /** Su nombre visible; una reserva aún no tiene otro que su dirección. */
  name: string;
  role: OrgRole;
  /** `null` si ya es miembro; si es una reserva, qué le falta. */
  waitingFor: ReservationWaitingFor | null;
}

export interface CategoryRow {
  description: string;
  id?: string;
  initials: string;
  name: string;
  tickets: number;
}

/** Un nivel de acceso de la pestaña de roles y cuántos miembros lo tienen. */
export interface RoleRow {
  members: number;
  role: OrgRole;
}

/** La identidad de una fila: su id si lo trae, y si no el texto que la nombra. */
export function rowKey(row: MemberRow | CategoryRow): string {
  return row.id ?? row.name;
}

export interface OrganizationFixture {
  categories: CategoryRow[];
  description: string;
  members: MemberRow[];
  openTickets: number;
}

const member = (
  initials: string,
  name: string,
  email: string,
  role: OrgRole,
  waitingFor: ReservationWaitingFor | null = null,
): MemberRow => ({ email, initials, name, role, waitingFor });

const category = (
  initials: string,
  name: string,
  description: string,
  tickets: number,
): CategoryRow => ({ description, initials, name, tickets });

const northstarMembers: MemberRow[] = [
  member('MS', 'Maya Singh', 'maya.singh@northstar.test', 'AGENT'),
  member('JL', 'John Lee', 'john.lee@northstar.test', 'MEMBER'),
  member('MC', 'Mia Chen', 'mia.chen@northstar.test', 'ORG_ADMIN'),
  member(
    'CV',
    'Carlos Vega',
    'carlos.vega@northstar.test',
    'AGENT',
    'VERIFICATION',
  ),
  member('LP', 'Lena Patel', 'lena.patel@northstar.test', 'MEMBER'),
];

const northstarCategories: CategoryRow[] = [
  category('AA', 'Account access', 'Login, identity and access requests', 18),
  category('BI', 'Billing', 'Payments, invoices and refunds', 7),
  category('OR', 'Organization', 'Membership and organization settings', 11),
  category('TI', 'Technical issue', 'Application errors and incidents', 9),
  category('OT', 'Other', 'Requests that need manual routing', 4),
];

const organizationFixtures: Record<string, OrganizationFixture> = {
  'org-northstar': {
    categories: northstarCategories,
    description: 'Design and product operations for the Northstar team.',
    members: northstarMembers,
    openTickets: 24,
  },
  'org-helio': {
    categories: [
      category('LA', 'Lab access', 'Laboratory access and credentials', 4),
      category('EQ', 'Equipment', 'Research equipment support', 3),
      category('OT', 'Other', 'Requests needing manual routing', 2),
    ],
    description: 'Research operations and internal support for Helio Labs.',
    members: [
      member('JL', 'John Lee', 'john.lee@northstar.test', 'MEMBER'),
      member('AR', 'Ana Ruiz', 'ana@helio.test', 'ORG_ADMIN'),
      member('SO', 'Sofia Ortega', 'sofia@helio.test', 'AGENT'),
    ],
    openTickets: 9,
  },
  'org-orbit': {
    categories: [
      category('BI', 'Billing', 'Payments, invoices and refunds', 8),
      category('RP', 'Reporting', 'Financial reporting and dashboards', 5),
      category('AC', 'Access', 'Finance system access requests', 4),
    ],
    description: 'Finance systems, reporting and employee service requests.',
    members: [
      member('MS', 'Maya Singh', 'maya.singh@northstar.test', 'MEMBER'),
      member('NK', 'Noah Kim', 'noah@orbit.test', 'ORG_ADMIN'),
      member('LP', 'Lena Patel', 'lena@orbit.test', 'AGENT'),
    ],
    openTickets: 17,
  },
};

export const initialMembers = northstarMembers;
export const initialCategories = northstarCategories;

export function organizationFixture(
  organizationId: string,
  fallbackDescription = '',
): OrganizationFixture {
  const fixture = organizationFixtures[organizationId] ?? {
    categories: northstarCategories,
    description: fallbackDescription,
    members: northstarMembers,
    openTickets: 0,
  };
  return {
    ...fixture,
    categories: fixture.categories.map((row) => ({ ...row })),
    members: fixture.members.map((row) => ({ ...row })),
  };
}

/** The three access levels, with how many confirmed members hold each. */
export function roleRowsForMembers(members: MemberRow[]): RoleRow[] {
  const count = (role: OrgRole) =>
    members.filter((row) => row.waitingFor === null && row.role === role)
      .length;
  return (['ORG_ADMIN', 'AGENT', 'MEMBER'] as const).map((role) => ({
    members: count(role),
    role,
  }));
}

export function labelFromEmail(email: string) {
  return email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

/** Preview only: ticket figures that add up, around the sample open count. */
export function sampleStats(open: number): OrganizationStats {
  const byStatus = { OPEN: open, IN_PROGRESS: 5, RESOLVED: 8, CLOSED: 3 };
  const total = open + 5 + 8 + 3;
  const quarter = Math.floor(total / 4);
  return {
    avgFirstResponseSeconds: 8_100,
    byPriority: { HIGH: quarter, LOW: quarter, MEDIUM: total - 2 * quarter },
    byStatus,
    total,
    unassigned: Math.min(3, open),
  };
}
