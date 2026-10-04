import {
  updatePreferencesSchema,
  updateProfileSchema,
  type UpdatePreferencesInput,
  type UpdateProfileInput,
} from 'contracts';
import { request } from '../core/api/client';

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
    body: parsed,
  });
}

export async function getPreferences(
  signal?: AbortSignal,
): Promise<UserPreferences> {
  return request('/users/me/preferences', { signal });
}

export async function updatePreferences(
  input: UpdatePreferencesInput,
): Promise<UserPreferences> {
  const parsed = updatePreferencesSchema.parse(input);
  return request('/users/me/preferences', {
    method: 'PATCH',
    body: parsed,
  });
}

export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const form = new FormData();
  form.append('file', file);
  // FormData a propósito sin Content-Type: lo pone el navegador con su
  // boundary, y el cliente compartido ya lo respeta.
  return request('/users/me/avatar', { method: 'PUT', body: form });
}

export async function deleteAvatar(): Promise<{ avatarUrl: null }> {
  return request('/users/me/avatar', { method: 'DELETE' });
}
