import type { StatusBadgeTone } from 'ui';

export interface Ticket {
  assignee: string;
  category: string;
  description?: string;
  id: string;
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
    priority: 'High',
    status: 'Open',
    statusTone: 'open',
    time: '28 min',
    title: 'Payment page unavailable',
  },
  {
    assignee: 'Ana Ruiz',
    category: 'Organization',
    id: 'HD-0243',
    priority: 'Medium',
    status: 'In progress',
    statusTone: 'progress',
    time: '1 h',
    title: 'Update organization details',
  },
  {
    assignee: 'Maya Singh',
    category: 'Account',
    id: 'HD-0241',
    priority: 'Medium',
    status: 'In progress',
    statusTone: 'progress',
    time: '2 h',
    title: 'Cannot access account',
  },
  {
    assignee: 'Mia Chen',
    category: 'Account',
    id: 'HD-0239',
    priority: 'Low',
    status: 'Resolved',
    statusTone: 'resolved',
    time: 'Yesterday',
    title: 'New member cannot join',
  },
  {
    assignee: 'Carlos Vega',
    category: 'Account',
    id: 'HD-0238',
    priority: 'Low',
    status: 'Closed',
    statusTone: 'closed',
    time: '2 days',
    title: 'Password reset request',
  },
];
