import { apiDownload, request } from '../core/api/client';

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

/** Every request this account has made, newest first. */
export function listRequests(signal?: AbortSignal): Promise<GdprRequest[]> {
  return request<GdprRequest[]>('/gdpr/requests', { signal });
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
    body: { token },
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
    body: { token, confirmUsername },
  });
}

/** Downloads the archive. The shared client handles the authenticated blob. */
export function downloadExport(id: string): Promise<void> {
  return apiDownload(`/gdpr/export/${id}/download`, 'helpdesk-lite-export.zip');
}
