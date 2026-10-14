import { request } from '../core/api/client';

export interface ChatUser {
  id: string;
  username: string;
  profile?: {
    displayName?: string | null;
    avatarUrl?: string | null;
    isOnline?: boolean;
    lastSeenAt?: string | null;
  } | null;
}

export interface ApiConversation {
  id: string;
  lastMessageAt: string | null;
  participant: ChatUser | null;
  lastMessage: {
    body: string;
    createdAt: string;
    senderId: string;
  } | null;
  unreadCount: number;
}

export interface ApiMessage {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  conversationId?: string;
  sender: ChatUser;
}

export interface PaginatedMessages {
  data: ApiMessage[];
  meta: { page: number; pages: number };
}

export function listConversations(
  signal?: AbortSignal,
): Promise<ApiConversation[]> {
  return request<ApiConversation[]>('/conversations', { signal });
}

export function listMessages(
  conversationId: string,
  page = 1,
): Promise<PaginatedMessages> {
  return request<PaginatedMessages>(
    `/conversations/${encodeURIComponent(conversationId)}/messages?page=${page}&take=100`,
  );
}

export function searchUsers(query: string): Promise<ChatUser[]> {
  return request<ChatUser[]>(`/users/search?q=${encodeURIComponent(query)}`);
}

export function openConversation(userId: string): Promise<{ id: string }> {
  return request<{ id: string }>('/conversations', {
    method: 'POST',
    body: { userId },
  });
}

export function sendMessage(
  conversationId: string,
  body: string,
): Promise<ApiMessage> {
  return request<ApiMessage>(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    { method: 'POST', body: { body } },
  );
}

export function markConversationRead(conversationId: string): Promise<unknown> {
  return request(`/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: 'PATCH',
    body: {},
  });
}
