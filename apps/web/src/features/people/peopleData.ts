export interface Person {
  initials: string;
  name: string;
  role: string;
  status: 'Away' | 'Offline' | 'Online';
  team: string;
}

export const initialConnections = [
  'Maya Singh',
  'John Lee',
  'Mia Chen',
  'Lena Patel',
];

export const incomingRequestNames = ['Carlos Vega'];
export const initialSentRequests = ['Noah Kim'];

export const people: Person[] = [
  {
    initials: 'MS',
    name: 'Maya Singh',
    role: 'Support agent',
    team: 'Account & access',
    status: 'Online',
  },
  {
    initials: 'JL',
    name: 'John Lee',
    role: 'Product designer',
    team: 'Product',
    status: 'Online',
  },
  {
    initials: 'MC',
    name: 'Mia Chen',
    role: 'Organization admin',
    team: 'Operations',
    status: 'Away',
  },
  {
    initials: 'CV',
    name: 'Carlos Vega',
    role: 'Support agent',
    team: 'Billing',
    status: 'Offline',
  },
  {
    initials: 'LP',
    name: 'Lena Patel',
    role: 'Engineering lead',
    team: 'Engineering',
    status: 'Online',
  },
  {
    initials: 'NK',
    name: 'Noah Kim',
    role: 'Standard user',
    team: 'Finance',
    status: 'Offline',
  },
];
