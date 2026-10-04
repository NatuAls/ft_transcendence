import { getAccessToken, refreshSession } from './auth';

const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

/**
 * A failed call, with what the API said about it. `code` is the stable
 * identifier of the error envelope (`ORG_LAST_ADMIN`, `RBAC_FORBIDDEN`, …), so
 * a screen can react to a specific refusal instead of parsing English.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const token = getAccessToken();
  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body === undefined || init.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

/**
 * JSON request against the session API.
 *
 * The access token lives 15 minutes and is only renewed at boot, so a screen
 * left open longer than that would start failing every call. On a 401 this
 * renews the session once through the refresh cookie and repeats the request;
 * a second 401 is a real one and is reported as such.
 */
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response = await send(path, init);
  if (response.status === 401 && (await refreshSession())) {
    response = await send(path, init);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;
    throw new ApiError(
      response.status,
      body?.code ?? 'NETWORK_ERROR',
      body?.message ?? 'The request could not be completed.',
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function jsonBody(value: unknown): Pick<RequestInit, 'body'> {
  return { body: JSON.stringify(value) };
}
