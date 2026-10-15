import type { ApiMessage } from '../../api/messages';

export interface Conversation {
  id?: string;
  userId?: string;
  username?: string;
  avatarUrl?: string | null;
  initials: string;
  name: string;
  online?: boolean;
  preview: string;
  previewKey?: string;
  role: string;
  time: string;
  timeKey?: string;
  unreadCount?: number;
}

export type MessageStatus = 'sent' | 'sending' | 'error';

export interface MessageItem extends ApiMessage {
  status: MessageStatus;
  retryId?: string;
  read?: boolean;
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
    role: 'messages.roles.supportAgent',
    time: '2 min',
    timeKey: 'messages.preview.time2Min',
  },
  {
    id: 'preview-conversation-john',
    initials: 'JL',
    name: 'John Lee',
    preview: 'Thank you for the update.',
    role: 'messages.roles.member',
    time: '1 h',
    timeKey: 'messages.preview.time1Hour',
  },
  {
    id: 'preview-conversation-lena',
    initials: 'LP',
    name: 'Lena Patel',
    online: true,
    preview: 'Can we review this tomorrow?',
    role: 'messages.roles.productDesigner',
    time: 'Yesterday',
    timeKey: 'messages.preview.yesterday',
  },
  {
    id: 'preview-conversation-mia',
    initials: 'MC',
    name: 'Mia Chen',
    preview: 'The new member is active.',
    role: 'messages.roles.organizationAdmin',
    time: 'Mon',
    timeKey: 'messages.preview.monday',
  },
  {
    id: 'preview-conversation-carlos',
    initials: 'CV',
    name: 'Carlos Vega',
    preview: 'I closed the billing request.',
    role: 'messages.roles.supportAgent',
    time: 'Fri',
    timeKey: 'messages.preview.friday',
  },
];

// Candidatos del mockup original conservados como referencia. La UI real usa
// el buscador autenticado de /users/search.
export const newConversationCandidates: Conversation[] = [
  {
    initials: 'NK',
    name: 'Noah Kim',
    preview: 'Start a new conversation',
    role: 'messages.roles.financeOperations',
    time: 'Now',
  },
  {
    initials: 'SO',
    name: 'Sam Okafor',
    preview: 'Start a new conversation',
    role: 'messages.roles.platformAdministrator',
    time: 'Now',
  },
];
