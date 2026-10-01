export type OrgTab = 'members' | 'roles' | 'categories';
export type OrganizationDialogKind =
  'add-member' | 'edit-member' | 'settings' | 'category' | 'delete' | null;
export type DeleteContext = 'edit-member' | 'settings' | null;
export type OrganizationRow = [string, string, string, string, string];

export interface OrganizationFixture {
  categories: OrganizationRow[];
  description: string;
  members: OrganizationRow[];
  openTickets: number;
}

const northstarMembers: OrganizationRow[] = [
  ['MS', 'Maya Singh', 'maya.singh@northstar.test', 'Agent', 'Active'],
  ['JL', 'John Lee', 'john.lee@northstar.test', 'Member', 'Active'],
  ['MC', 'Mia Chen', 'mia.chen@northstar.test', 'Organization admin', 'Active'],
  ['CV', 'Carlos Vega', 'carlos.vega@northstar.test', 'Agent', 'Invited'],
  ['LP', 'Lena Patel', 'lena.patel@northstar.test', 'Member', 'Active'],
];

const northstarCategories: OrganizationRow[] = [
  [
    'AA',
    'Account access',
    'Login, identity and access requests',
    '18 tickets',
    '',
  ],
  ['BI', 'Billing', 'Payments, invoices and refunds', '7 tickets', ''],
  [
    'OR',
    'Organization',
    'Membership and organization settings',
    '11 tickets',
    '',
  ],
  [
    'TI',
    'Technical issue',
    'Application errors and incidents',
    '9 tickets',
    '',
  ],
  ['OT', 'Other', 'Requests that need manual routing', '4 tickets', ''],
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
      [
        'LA',
        'Lab access',
        'Laboratory access and credentials',
        '4 tickets',
        '',
      ],
      ['EQ', 'Equipment', 'Research equipment support', '3 tickets', ''],
      ['OT', 'Other', 'Requests needing manual routing', '2 tickets', ''],
    ],
    description: 'Research operations and internal support for Helio Labs.',
    members: [
      ['JL', 'John Lee', 'john.lee@northstar.test', 'Member', 'Active'],
      ['AR', 'Ana Ruiz', 'ana@helio.test', 'Organization admin', 'Active'],
      ['SO', 'Sofia Ortega', 'sofia@helio.test', 'Agent', 'Active'],
    ],
    openTickets: 9,
  },
  'org-orbit': {
    categories: [
      ['BI', 'Billing', 'Payments, invoices and refunds', '8 tickets', ''],
      [
        'RP',
        'Reporting',
        'Financial reporting and dashboards',
        '5 tickets',
        '',
      ],
      ['AC', 'Access', 'Finance system access requests', '4 tickets', ''],
    ],
    description: 'Finance systems, reporting and employee service requests.',
    members: [
      ['MS', 'Maya Singh', 'maya.singh@northstar.test', 'Member', 'Active'],
      ['NK', 'Noah Kim', 'noah@orbit.test', 'Organization admin', 'Active'],
      ['LP', 'Lena Patel', 'lena@orbit.test', 'Agent', 'Active'],
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
    description:
      fallbackDescription || 'Organization support and service requests.',
    members: northstarMembers,
    openTickets: 0,
  };
  return {
    ...fixture,
    categories: fixture.categories.map((row) => [...row]),
    members: fixture.members.map((row) => [...row]),
  };
}

export function roleRowsForMembers(
  members: OrganizationRow[],
): OrganizationRow[] {
  const active = members.filter((row) => row[4] === 'Active');
  const count = (role: string) =>
    active.filter((row) => row[3] === role).length;
  return [
    [
      'OA',
      'Organization admin',
      'Full organization access',
      `${count('Organization admin')} members`,
      'All permissions',
    ],
    [
      'AG',
      'Agent',
      'Creates tickets and handles organization requests',
      `${count('Agent')} members`,
      'Handle tickets',
    ],
    [
      'ME',
      'Member',
      'Creates and follows own tickets',
      `${count('Member')} members`,
      'Own tickets',
    ],
  ];
}

export function labelFromEmail(email: string) {
  return email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
