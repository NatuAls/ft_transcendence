import {
  changePasswordSchema,
  type ChangePasswordInput,
  type LoginInput,
  type PendingRole,
  type RegisterInput,
} from 'contracts';
import { request } from '../core/api/client';
import { ApiError } from '../core/api/errors';

// =============================================================================
//  ÚNICA EXCEPCIÓN al cliente compartido de core/api/client.ts.
//
//  Este fichero habla con la API por `fetch` directo a propósito, y es la
//  única parte del front que lo hace. El cliente compartido llama a
//  `refreshSession()` cuando recibe un 401; si `refreshSession()` fuese por el
//  cliente, un 401 del propio refresco dispararía otro refresco, y así.
//
//  Las cuatro rutas que viven aquí son justo las que no necesitan lo que da el
//  cliente: entrar, registrarse, renovar y salir no tienen sesión que renovar.
//
//  Todo lo demás —sin excepciones— pasa por `request` de core/api/client.
// =============================================================================

// --- 1. GESTIÓN DEL TOKEN EN MEMORIA ---
let inMemoryAccessToken: string | null = null;
let refreshPromise: Promise<AuthResponse | null> | null = null;

export function saveAccessToken(token: string): void {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function clearAccessToken(): void {
  inMemoryAccessToken = null;
}

const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    jobTitle: string | null;
    isOnline: boolean;
    lastSeenAt: string | null;
    createdAt: string;
    globalRole: string;
    locale: string;
    timezone: string;
    emailVerified: boolean;
    memberships: Array<{
      organizationId: string;
      organizationName: string;
      organizationSlug: string;
      role: 'MEMBER' | 'AGENT' | 'ORG_ADMIN';
    }>;
    permissions: string[];
    /** Roles reserved for this address that wait for its confirmation. */
    pendingRoles?: PendingRole[];
  };
}

export async function logout(): Promise<void> {
  const accessToken = getAccessToken();

  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      ...(accessToken
        ? { headers: { Authorization: `Bearer ${accessToken}` } }
        : {}),
      credentials: 'include',
    });
  } finally {
    clearAccessToken();
  }
}

/**
 * No se pudo hablar con el servidor para renovar la sesión.
 *
 * No es lo mismo que no tener sesión, y confundirlo era un fallo visible: al
 * parar y volver a arrancar la API, el `fetch` se rechazaba, el rechazo se
 * quedaba sin capturar y la aplicación caía a la pantalla de inicio de sesión
 * con la sesión todavía viva en la cookie. Quedaba ahí plantada hasta que se
 * pulsaba F5, que repetía la llamada y la recuperaba. Quien recibe esto tiene
 * que reintentar, no cerrar la sesión.
 */
export class SessionUnreachable extends Error {
  constructor(cause: unknown) {
    super('The session could not be refreshed: the server did not answer.', {
      cause,
    });
    this.name = 'SessionUnreachable';
  }
}

/** El cerrojo con el que las pestañas del navegador se turnan para renovar. */
const REFRESH_LOCK = 'helpdesk-session-refresh';
/** Lo más que una renovación puede tener esperando a las demás pestañas. */
const REFRESH_TIMEOUT_MS = 15_000;

/**
 * Ejecuta `work` cuando ninguna otra pestaña esté renovando la sesión.
 *
 * Cada renovación gasta la cookie de refresco y deja otra nueva, y la API toma
 * la reutilización de una ya gastada por un token robado: revoca la familia y
 * la sesión se cierra en todas las pestañas. Dos pestañas que renovaban a la vez
 * —al restaurar el navegador, o con sus tokens caducando juntos— mandaban la
 * misma cookie y provocaban justo eso. Con el cerrojo, la segunda espera a que
 * la primera termine y sale ya con la cookie nueva. Sin Web Locks (un navegador
 * antiguo, las pruebas) se renueva sin turno, como antes.
 */
function inTurn<T>(work: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  return locks ? locks.request(REFRESH_LOCK, work) : work();
}

/**
 * Corta la renovación si el servidor no contesta: con el cerrojo, una que se
 * quedase colgada dejaría esperando a todas las demás pestañas.
 */
function timeoutSignal(ms: number): AbortSignal | undefined {
  return typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(ms)
    : undefined;
}

/**
 * Renueva la sesión a partir de la cookie de refresco.
 *
 * `null` significa UNA cosa: la API ha contestado que no hay sesión que renovar
 * (401 o 403). Cualquier otra respuesta no dice nada de la sesión y lanza
 * `SessionUnreachable`: ni la red caída, ni el 5xx con el que contesta el proxy
 * de delante —Vite en desarrollo, nginx en producción— cuando la API está
 * parada, ni un 429 del limitador. Confundirlos echaba al inicio de sesión a
 * quien recargaba durante un reinicio de la API, con la sesión todavía viva.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  if (refreshPromise) return refreshPromise;

  const hasSessionHint = document.cookie
    .split('; ')
    .some((cookie) => cookie.startsWith('hd_session='));
  if (!hasSessionHint) return Promise.resolve(null);

  refreshPromise = inTurn(() =>
    fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      signal: timeoutSignal(REFRESH_TIMEOUT_MS),
    }),
  )
    .then(async (response) => {
      if (response.status === 401 || response.status === 403) return null;
      if (!response.ok) throw new SessionUnreachable(`HTTP ${response.status}`);
      const body = await readJson<AuthResponse>(response);
      if (!body?.accessToken)
        throw new SessionUnreachable('The refresh response was empty.');
      saveAccessToken(body.accessToken);
      return body;
    })
    .catch((cause: unknown) => {
      throw cause instanceof SessionUnreachable
        ? cause
        : new SessionUnreachable(cause);
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export interface ApiErrorResponse {
  requestId: string;
  timestamp: string;
  path: string;
  statusCode: number;
  code: string;
  messageKey: string;
  message: string;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorBody = await readJson<ApiErrorResponse>(response);
    throw new ApiError(
      errorBody ?? {
        code: response.status === 429 ? 'RATE_LIMITED' : 'UNKNOWN',
        messageKey:
          response.status === 429
            ? 'errors.common.rateLimited'
            : response.status >= 500
              ? 'errors.auth.serverUnavailable'
              : 'errors.auth.requestFailed',
        message: 'errors.auth.requestFailed',
        statusCode: response.status,
      },
      response.status,
    );
  }

  const body = await readJson<AuthResponse>(response);
  if (!body?.accessToken) {
    throw new Error('errors.auth.emptyLoginResponse');
  }
  saveAccessToken(body.accessToken);
  return body;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorBody = await readJson<ApiErrorResponse>(response);
    throw new ApiError(
      errorBody ?? {
        code: response.status === 429 ? 'RATE_LIMITED' : 'UNKNOWN',
        messageKey:
          response.status === 429
            ? 'errors.common.rateLimited'
            : response.status >= 500
              ? 'errors.auth.serverUnavailable'
              : 'errors.auth.requestFailed',
        message: 'errors.auth.requestFailed',
        statusCode: response.status,
      },
      response.status,
    );
  }

  const body = await readJson<AuthResponse>(response);
  if (!body?.accessToken) {
    throw new Error('errors.auth.emptyRegistrationResponse');
  }
  saveAccessToken(body.accessToken);
  return body;
}

/** Change the signed-in user's password; the API revokes every session. */
export function changePassword(input: ChangePasswordInput): Promise<void> {
  return request<void>('/auth/change-password', {
    method: 'POST',
    body: changePasswordSchema.parse(input),
  });
}
