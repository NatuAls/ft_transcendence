export type OrgTab = 'members' | 'roles' | 'categories';
export type OrganizationDialogKind =
  | 'add-member'
  | 'edit-member'
  | 'settings'
  | 'role'
  | 'category'
  | 'delete'
  | null;
export type DeleteContext =
  'edit-member' | 'settings' | 'role' | 'category' | null;
export type OrganizationRow = [string, string, string, string, string];

export const initialMembers: OrganizationRow[] = [
  ['MS', 'Maya Singh', 'maya.singh@northstar.test', 'Agent', 'Active'],
  ['JL', 'John Lee', 'john.lee@northstar.test', 'User', 'Active'],
  ['MC', 'Mia Chen', 'mia.chen@northstar.test', 'Org admin', 'Active'],
  ['CV', 'Carlos Vega', 'carlos.vega@northstar.test', 'Agent', 'Invited'],
  ['LP', 'Lena Patel', 'lena.patel@northstar.test', 'User', 'Active'],
];

export const initialRoles: OrganizationRow[] = [
  [
    'OA',
    'Organization admin',
    'Full organization access',
    '2 members',
    'All permissions',
  ],
  [
    'SA',
    'Support agent',
    'Works assigned support requests',
    '6 members',
    'Tickets + messages',
  ],
  [
    'SU',
    'Standard user',
    'Creates and follows own tickets',
    '18 members',
    'Own tickets',
  ],
  ['OB', 'Observer', 'Read-only operational access', '2 members', 'View only'],
  [
    'CR',
    'Custom reviewer',
    'Reviews selected categories',
    '0 members',
    'Limited',
  ],
];

export const initialCategories: OrganizationRow[] = [
  [
    'AA',
    'Account access',
    'Login, identity and access requests',
    '18 tickets',
    'Active',
  ],
  ['BI', 'Billing', 'Payments, invoices and refunds', '7 tickets', 'Active'],
  [
    'OR',
    'Organization',
    'Membership and organization settings',
    '11 tickets',
    'Active',
  ],
  [
    'TI',
    'Technical issue',
    'Application errors and incidents',
    '9 tickets',
    'Active',
  ],
  ['OT', 'Other', 'Requests that need manual routing', '4 tickets', 'Review'],
];

export function labelFromEmail(email: string) {
  return email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
