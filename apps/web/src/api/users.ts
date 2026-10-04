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

export async function getPreferences(): Promise<UserPreferences> {
  return request('/users/me/preferences');
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
  return request('/users/me/avatar', { method: 'PUT', body: form });
}

export async function deleteAvatar(): Promise<{ avatarUrl: null }> {
  return request('/users/me/avatar', { method: 'DELETE' });
}
