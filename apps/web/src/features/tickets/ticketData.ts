import type { StatusBadgeTone } from 'ui';

export interface Ticket {
  assignee: string;
  category: string;
  description?: string;
  id: string;
  organizationId: string;
  priority: 'High' | 'Low' | 'Medium';
  requester?: string;
  status: string;
  statusTone: StatusBadgeTone;
  time: string;
  title: string;
}

export const initialTickets: Ticket[] = [
  {
    assignee: 'Unassigned',
    category: 'Billing',
    id: 'HD-0242',
    organizationId: 'org-northstar',
    priority: 'High',
    requester: 'John Lee',
    status: 'Open',
    statusTone: 'open',
    time: '28 min',
    title: 'Payment page unavailable',
  },
  {
    assignee: 'Ana Ruiz',
    category: 'Organization',
    id: 'HD-0243',
    organizationId: 'org-northstar',
    priority: 'Medium',
    requester: 'Lena Patel',
    status: 'In progress',
    statusTone: 'progress',
    time: '1 h',
    title: 'Update organization details',
  },
  {
    assignee: 'Maya Singh',
    category: 'Account',
    id: 'HD-0241',
    organizationId: 'org-northstar',
    priority: 'Medium',
    requester: 'Ana Ruiz',
    status: 'In progress',
    statusTone: 'progress',
    time: '2 h',
    title: 'Cannot access account',
  },
  {
    assignee: 'Mia Chen',
    category: 'Account',
    id: 'HD-0239',
    organizationId: 'org-northstar',
    priority: 'Low',
    requester: 'John Lee',
    status: 'Resolved',
    statusTone: 'resolved',
    time: 'Yesterday',
    title: 'New member cannot join',
  },
  {
    assignee: 'Carlos Vega',
    category: 'Account',
    id: 'HD-0238',
    organizationId: 'org-northstar',
    priority: 'Low',
    requester: 'Lena Patel',
    status: 'Closed',
    statusTone: 'closed',
    time: '2 days',
    title: 'Password reset request',
  },
  {
    assignee: 'Sofia Ortega',
    category: 'Lab access',
    description: 'The research workspace badge no longer unlocks Lab 3.',
    id: 'HD-0311',
    organizationId: 'org-helio',
    priority: 'High',
    requester: 'John Lee',
    status: 'In progress',
    statusTone: 'progress',
    time: '35 min',
    title: 'Lab access badge rejected',
  },
  {
    assignee: 'Unassigned',
    category: 'Equipment',
    description: 'A shared microscope workstation cannot connect to storage.',
    id: 'HD-0310',
    organizationId: 'org-helio',
    priority: 'Medium',
    requester: 'Ana Ruiz',
    status: 'Open',
    statusTone: 'open',
    time: '2 h',
    title: 'Microscope workstation offline',
  },
  {
    assignee: 'Lena Patel',
    category: 'Reporting',
    description: 'The monthly close report is missing the latest ledger data.',
    id: 'HD-0417',
    organizationId: 'org-orbit',
    priority: 'High',
    requester: 'Maya Singh',
    status: 'In progress',
    statusTone: 'progress',
    time: '18 min',
    title: 'Monthly report data is stale',
  },
  {
    assignee: 'Unassigned',
    category: 'Access',
    description: 'A finance analyst needs access to the reconciliation tool.',
    id: 'HD-0416',
    organizationId: 'org-orbit',
    priority: 'Medium',
    requester: 'Noah Kim',
    status: 'Open',
    statusTone: 'open',
    time: '3 h',
    title: 'Reconciliation tool access',
  },
];
