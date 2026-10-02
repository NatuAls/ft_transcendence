import {
  updatePreferencesSchema,
  updateProfileSchema,
  type UpdatePreferencesInput,
  type UpdateProfileInput,
} from 'contracts';
import { getAccessToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export interface UserPreferences {
  locale: string;
  timezone: string;
  theme: string;
  notifyOnTicketUpdate: boolean;
  notifyOnComment: boolean;
  notifyOnMention: boolean;
  notifyOnMessage: boolean;
  notifyOnFriendship: boolean;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Unable to update your account.');
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function updateProfile(input: UpdateProfileInput): Promise<{
  displayName: string;
  firstName: string;
  lastName: string;
  bio: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
}> {
  const parsed = updateProfileSchema.parse(input);
  return request('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(parsed),
  });
}

export async function getPreferences(): Promise<UserPreferences> {
  return request('/users/me/preferences');
}

export async function updatePreferences(
  input: UpdatePreferencesInput,
): Promise<UserPreferences> {
  const parsed = updatePreferencesSchema.parse(input);
  return request('/users/me/preferences', {
    method: 'PATCH',
    body: JSON.stringify(parsed),
  });
}

export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const form = new FormData();
  form.append('file', file);
  return request('/users/me/avatar', { method: 'PUT', body: form });
}

export async function deleteAvatar(): Promise<{ avatarUrl: null }> {
  return request('/users/me/avatar', { method: 'DELETE' });
}
