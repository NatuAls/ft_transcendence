export type AdminDialogKind = 'create' | 'edit' | 'closed' | null;

/**
 * Una fila de la tabla de usuarios de la plataforma.
 *
 * Rol y estado van como CÓDIGOS (`GLOBAL_ADMIN`, `SUSPENDED`…) y la pantalla
 * los traduce al pintarlos. Antes eran el texto en inglés —«Global admin»,
 * «Active»— y la lógica comparaba contra ese texto, así que traducirlo habría
 * roto los filtros y el guardado.
 */
export interface AdminUser {
  /** La dirección de la cuenta: única, así que identifica la fila. */
  email: string;
  initials: string;
  name: string;
  /** Cuántas organizaciones tiene; en la vista previa, el nombre de una. */
  organizations: number | string | null;
  role: PlatformAccess;
  state: AccountState;
  /** A closed account: when its personal data will be erased. */
  erasureDueAt?: string;
}

export type PlatformAccess = 'USER' | 'GLOBAL_ADMIN';
/**
 * `CLOSED`: an administrator deleted it. It can no longer sign in, and its
 * personal data is erased when `erasureDueAt` arrives unless it is restored.
 */
export type AccountState = 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'CLOSED';

export const initialUsers: AdminUser[] = [
  {
    email: 'ana@northstar.test',
    initials: 'AR',
    name: 'Ana Ruiz',
    organizations: 'Northstar Studio',
    role: 'USER',
    state: 'ACTIVE',
  },
  {
    email: 'mia@northstar.test',
    initials: 'MC',
    name: 'Mia Chen',
    organizations: 'Northstar Studio',
    role: 'USER',
    state: 'ACTIVE',
  },
  {
    email: 'sam@helpdesk.test',
    initials: 'SO',
    name: 'Sam Okafor',
    organizations: null,
    role: 'GLOBAL_ADMIN',
    state: 'ACTIVE',
  },
  {
    email: 'carlos@northstar.test',
    initials: 'CV',
    name: 'Carlos Vega',
    organizations: 'Northstar Studio',
    role: 'USER',
    state: 'SUSPENDED',
  },
  {
    email: 'noah@orbit.test',
    initials: 'NK',
    name: 'Noah Kim',
    organizations: 'Orbit Finance',
    role: 'USER',
    state: 'ACTIVE',
  },
  {
    email: 'lena@northstar.test',
    initials: 'LP',
    name: 'Lena Patel',
    organizations: 'Northstar Studio',
    role: 'USER',
    state: 'ACTIVE',
  },
];
