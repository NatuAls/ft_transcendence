import { apiRequest } from './http';

/** One signed-in device, as `GET /auth/sessions` returns it. */
export interface DeviceSession {
  /** When the device signed in. */
  createdAt: string;
  /** The device making this call, recognised by its refresh cookie. */
  current: boolean;
  expiresAt: string;
  id: string;
  ip: string | null;
  /** Last time the device renewed its session. */
  lastUsedAt: string;
  userAgent: string | null;
}

export function listSessions(): Promise<DeviceSession[]> {
  return apiRequest('/auth/sessions');
}

/** Signs that device out: its next renewal is refused. */
export async function revokeSession(id: string): Promise<void> {
  await apiRequest(`/auth/sessions/${id}`, { method: 'DELETE' });
}

/** Every device, this one included; tokens already issued stop working too. */
export async function signOutEverywhere(): Promise<void> {
  await apiRequest('/auth/logout-all', { method: 'POST' });
}
