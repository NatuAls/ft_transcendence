import { getAccessToken } from '../../api/auth';
import { apiRequest, jsonBody } from '../../core/api/client';

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
  return apiRequest<ApiConversation[]>('/conversations', { signal });
}

export function listMessages(
  conversationId: string,
  page = 1,
): Promise<PaginatedMessages> {
  return apiRequest<PaginatedMessages>(
    `/conversations/${encodeURIComponent(conversationId)}/messages?page=${page}&take=100`,
  );
}

export function searchUsers(query: string): Promise<ChatUser[]> {
  return apiRequest<ChatUser[]>(`/users/search?q=${encodeURIComponent(query)}`);
}

export function openConversation(userId: string): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/conversations', {
    method: 'POST',
    ...jsonBody({ userId }),
  });
}

export function sendMessage(
  conversationId: string,
  body: string,
): Promise<ApiMessage> {
  return apiRequest<ApiMessage>(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    { method: 'POST', ...jsonBody({ body }) },
  );
}

export function markConversationRead(conversationId: string): Promise<unknown> {
  // La API contesta 204 a esta ruta. El cliente propio hacía `response.json()`
  // sobre un cuerpo vacío y reventaba; el compartido devuelve `undefined`.
  return apiRequest(
    `/conversations/${encodeURIComponent(conversationId)}/read`,
    { method: 'PATCH', ...jsonBody({}) },
  );
}

export function socketOrigin(): string | undefined {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  if (!configured || configured.startsWith('/')) return undefined;
  return new URL(configured).origin;
}

export function currentUserId(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as {
      sub?: string;
    };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
