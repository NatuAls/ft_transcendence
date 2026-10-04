import { getAccessToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export type GdprRequestType = 'EXPORT' | 'DELETE';

export type GdprRequestStatus =
  | 'AWAITING_CONFIRMATION'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface GdprRequest {
  id: string;
  type: GdprRequestType;
  status: GdprRequestStatus;
  requestedAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  expiresAt: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'The request could not be completed.');
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Every request this account has made, newest first. */
export function listRequests(): Promise<GdprRequest[]> {
  return request<GdprRequest[]>('/gdpr/requests');
}

/** Starts an export. The API e-mails a confirmation token valid for 30 min. */
export function requestExport(): Promise<GdprRequest> {
  return request<GdprRequest>('/gdpr/export', { method: 'POST' });
}

export function confirmExport(
  token: string,
): Promise<{ id: string; status: GdprRequestStatus }> {
  return request('/gdpr/export/confirm', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

/** Starts a deletion. Same e-mail step; the account is still untouched. */
export function requestDeletion(): Promise<GdprRequest> {
  return request<GdprRequest>('/gdpr/delete', { method: 'POST' });
}

/**
 * Second factor on purpose: the token from the e-mail AND your own username
 * typed back. The API compares the username itself; sending it from here is
 * not a shortcut, it is the payload the endpoint requires.
 */
export function confirmDeletion(
  token: string,
  confirmUsername: string,
): Promise<{ id: string; status: GdprRequestStatus }> {
  return request('/gdpr/delete/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, confirmUsername }),
  });
}

/**
 * Downloads the archive.
 *
 * It cannot be a plain link: the endpoint is authenticated with a bearer
 * token and a browser does not attach headers to a navigation. So the file is
 * fetched, turned into a blob and handed to a synthetic anchor. The object URL
 * is revoked afterwards, otherwise the blob stays in memory for the life of
 * the document.
 */
export async function downloadExport(id: string): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${API_URL}/gdpr/export/${id}/download`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? 'The archive is no longer available. Request a new export.'
        : 'The archive could not be downloaded.',
    );
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filenameFrom(response) ?? 'helpdesk-lite-export.zip';
  link.click();
  URL.revokeObjectURL(url);
}

/** The API sets the real name in Content-Disposition; use it if it is there. */
function filenameFrom(response: Response): string | null {
  const header = response.headers.get('content-disposition');
  return /filename="?([^"]+)"?/.exec(header ?? '')?.[1] ?? null;
}
