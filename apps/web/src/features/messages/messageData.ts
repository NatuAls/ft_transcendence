export interface Conversation {
  initials: string;
  name: string;
  preview: string;
  role: string;
  time: string;
}

export const initialConversations: Conversation[] = [
  {
    initials: 'MS',
    name: 'Maya Singh',
    preview: 'I can reproduce the issue…',
    role: 'Support agent',
    time: '2 min',
  },
  {
    initials: 'JL',
    name: 'John Lee',
    preview: 'Thank you for the update.',
    role: 'Member',
    time: '1 h',
  },
  {
    initials: 'LP',
    name: 'Lena Patel',
    preview: 'Can we review this tomorrow?',
    role: 'Product designer',
    time: 'Yesterday',
  },
  {
    initials: 'MC',
    name: 'Mia Chen',
    preview: 'The new member is active.',
    role: 'Organization admin',
    time: 'Mon',
  },
  {
    initials: 'CV',
    name: 'Carlos Vega',
    preview: 'I closed the billing request.',
    role: 'Support agent',
    time: 'Fri',
  },
];

export const newConversationCandidates: Conversation[] = [
  {
    initials: 'NK',
    name: 'Noah Kim',
    preview: 'Start a new conversation',
    role: 'Finance operations',
    time: 'Now',
  },
  {
    initials: 'SO',
    name: 'Sam Okafor',
    preview: 'Start a new conversation',
    role: 'Platform administrator',
    time: 'Now',
  },
];
