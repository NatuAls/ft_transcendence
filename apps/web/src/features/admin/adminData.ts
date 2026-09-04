export type AdminDialogKind = 'create' | 'edit' | 'delete' | null;
export type AdminUser = [string, string, string, string, string, string];

export const initialUsers: AdminUser[] = [
  [
    'AR',
    'Ana Ruiz',
    'ana@northstar.test',
    'Northstar Studio',
    'User',
    'Active',
  ],
  [
    'MC',
    'Mia Chen',
    'mia@northstar.test',
    'Northstar Studio',
    'User',
    'Active',
  ],
  [
    'SO',
    'Sam Okafor',
    'sam@helio.test',
    'Helio Labs',
    'Global admin',
    'Active',
  ],
  [
    'CV',
    'Carlos Vega',
    'carlos@northstar.test',
    'Northstar Studio',
    'User',
    'Suspended',
  ],
  ['NK', 'Noah Kim', 'noah@orbit.test', 'Orbit Finance', 'User', 'Active'],
  [
    'LP',
    'Lena Patel',
    'lena@northstar.test',
    'Northstar Studio',
    'User',
    'Active',
  ],
];
