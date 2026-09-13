export type OrganizationSummary = [string, string, string, string, string];

export const initialOrganizations: OrganizationSummary[] = [
  [
    'NS',
    'Northstar Studio',
    'Organization admin',
    '28 members · 24 open tickets',
    '12 minutes ago',
  ],
  ['HL', 'Helio Labs', 'Member', '14 members · 9 open tickets', 'Yesterday'],
  [
    'OF',
    'Orbit Finance',
    'Support agent',
    '36 members · 17 open tickets',
    '3 days ago',
  ],
];

export function normalizeWorkspaceSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
