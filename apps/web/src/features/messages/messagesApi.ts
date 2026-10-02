import { getAccessToken } from '../../api/auth';

const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Chat request failed (${response.status})`);
  return (await response.json()) as T;
}

export function listConversations(): Promise<ApiConversation[]> {
  return request<ApiConversation[]>('/conversations');
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
    body: JSON.stringify({ userId }),
  });
}

export function sendMessage(
  conversationId: string,
  body: string,
): Promise<ApiMessage> {
  return request<ApiMessage>(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    { method: 'POST', body: JSON.stringify({ body }) },
  );
}

export function markConversationRead(conversationId: string): Promise<unknown> {
  return request(`/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
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
