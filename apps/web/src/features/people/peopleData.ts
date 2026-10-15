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
    role: 'people.roles.supportAgent',
    team: 'Account & access',
    status: 'Online',
  },
  {
    initials: 'JL',
    name: 'John Lee',
    role: 'people.roles.productDesigner',
    team: 'Product',
    status: 'Online',
  },
  {
    initials: 'MC',
    name: 'Mia Chen',
    role: 'people.roles.organizationAdmin',
    team: 'Operations',
    status: 'Away',
  },
  {
    initials: 'CV',
    name: 'Carlos Vega',
    role: 'people.roles.supportAgent',
    team: 'Billing',
    status: 'Offline',
  },
  {
    initials: 'LP',
    name: 'Lena Patel',
    role: 'people.roles.engineeringLead',
    team: 'Engineering',
    status: 'Online',
  },
  {
    initials: 'NK',
    name: 'Noah Kim',
    role: 'people.roles.standardUser',
    team: 'Finance',
    status: 'Offline',
  },
];
