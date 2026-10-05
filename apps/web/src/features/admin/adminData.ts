export type AdminDialogKind = 'create' | 'edit' | null;
export type AdminUser = [string, string, string, string, string, string];

export const initialUsers: AdminUser[] = [
  [
    'AR',
    'Ana Ruiz',
    'ana@northstar.test',
    'Northstar Studio',
    'Standard user',
    'Active',
  ],
  [
    'MC',
    'Mia Chen',
    'mia@northstar.test',
    'Northstar Studio',
    'Standard user',
    'Active',
  ],
  ['SO', 'Sam Okafor', 'sam@helpdesk.test', '—', 'Global admin', 'Active'],
  [
    'CV',
    'Carlos Vega',
    'carlos@northstar.test',
    'Northstar Studio',
    'Standard user',
    'Suspended',
  ],
  [
    'NK',
    'Noah Kim',
    'noah@orbit.test',
    'Orbit Finance',
    'Standard user',
    'Active',
  ],
  [
    'LP',
    'Lena Patel',
    'lena@northstar.test',
    'Northstar Studio',
    'Standard user',
    'Active',
  ],
];
