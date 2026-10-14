/**
 * Lo que el registro de auditoría puede contener, tal como lo escribe la API
 * (`AuditAction` en `modules/audit/audit.service.ts`), agrupado como se ofrece
 * en el filtro. `audit-log-page.test.tsx` lee la lista de la API y la compara
 * con ésta: una acción nueva allí que falte aquí —sin filtro y sin
 * traducción— la detecta el CI, no quien lee el registro.
 */
export const AUDIT_ACTION_GROUPS = {
  accounts: [
    'user.created',
    'user.role.changed',
    'user.status.changed',
    'user.password.rotated',
    'user.deleted',
  ],
  organizations: [
    'organization.created',
    'organization.updated',
    'organization.deleted',
    'member.invited',
    'member.role.changed',
    'member.removed',
  ],
  roles: [
    'role.reserved',
    'role.reservation.cancelled',
    'role.reservation.claimed',
  ],
  credentials: ['apiKey.created', 'apiKey.revoked'],
  privacy: ['gdpr.export.confirmed', 'gdpr.delete.confirmed'],
} as const;

/** The entity types the API records, as its document lists them. */
export const AUDIT_ENTITIES = [
  'User',
  'Organization',
  'OrganizationMember',
  'PlatformRoleGrant',
  'OrganizationRoleGrant',
  'ApiKey',
  'GdprRequest',
] as const;

/** `user.role.changed` → `userRoleChanged`: i18next reads dots as nesting. */
export const auditActionKey = (action: string) =>
  action.replace(/\.(\w)/g, (_, letter: string) => letter.toUpperCase());
