import { request } from '../core/api/client';

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

export function listSessions(signal?: AbortSignal): Promise<DeviceSession[]> {
  return request('/auth/sessions', { signal });
}

/** Signs that device out: its next renewal is refused. */
export async function revokeSession(id: string): Promise<void> {
  await request(`/auth/sessions/${id}`, { method: 'DELETE' });
}

/** Every device, this one included; tokens already issued stop working too. */
export async function signOutEverywhere(): Promise<void> {
  await request('/auth/logout-all', { method: 'POST' });
}
