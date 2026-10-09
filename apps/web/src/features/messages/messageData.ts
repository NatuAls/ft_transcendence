export interface Conversation {
  id?: string;
  userId?: string;
  username?: string;
  initials: string;
  name: string;
  online?: boolean;
  preview: string;
  role: string;
  time: string;
}

/**
 * La identidad de una conversación.
 *
 * NO su nombre: el nombre es `displayName ?? username` de la otra persona, y
 * dos cuentas distintas pueden llamarse igual. Cuando eso pasaba, la lista las
 * fundía en una —al abrir la segunda se descartaba la primera—, al pulsar una
 * se resolvía la otra, y el mensaje salía por la conversación equivocada.
 * Se vio el 09/10 con tres cuentas «Felipe Cela».
 *
 * El id de la conversación es lo más preciso y lo traen tanto la API como los
 * datos de muestra. `userId` cubre el hueco de una conversación recién abierta
 * que todavía no lo tenga, y el nombre queda sólo como último recurso.
 */
export function conversationKey(conversation: Conversation): string {
  return conversation.id ?? conversation.userId ?? conversation.name;
}

// Deterministic preview fixtures. Production mode still loads the API data.
export const initialConversations: Conversation[] = [
  {
    id: 'preview-conversation-maya',
    initials: 'MS',
    name: 'Maya Singh',
    online: true,
    preview: 'I can reproduce the issue…',
    role: 'Support agent',
    time: '2 min',
  },
  {
    id: 'preview-conversation-john',
    initials: 'JL',
    name: 'John Lee',
    preview: 'Thank you for the update.',
    role: 'Member',
    time: '1 h',
  },
  {
    id: 'preview-conversation-lena',
    initials: 'LP',
    name: 'Lena Patel',
    online: true,
    preview: 'Can we review this tomorrow?',
    role: 'Product designer',
    time: 'Yesterday',
  },
  {
    id: 'preview-conversation-mia',
    initials: 'MC',
    name: 'Mia Chen',
    preview: 'The new member is active.',
    role: 'Organization admin',
    time: 'Mon',
  },
  {
    id: 'preview-conversation-carlos',
    initials: 'CV',
    name: 'Carlos Vega',
    preview: 'I closed the billing request.',
    role: 'Support agent',
    time: 'Fri',
  },
];

// Candidatos del mockup original conservados como referencia. La UI real usa
// el buscador autenticado de /users/search.
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
