import {
  changePasswordSchema,
  type ChangePasswordInput,
  type LoginInput,
  type PendingRole,
  type RegisterInput,
} from 'contracts';
import { request } from '../core/api/client';

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

/**
 * Renueva la sesión a partir de la cookie de refresco.
 *
 * `null` significa UNA cosa: el servidor ha contestado que no hay sesión que
 * renovar. Si no contesta, lanza `SessionUnreachable`.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  if (refreshPromise) return refreshPromise;

  const hasSessionHint = document.cookie
    .split('; ')
    .some((cookie) => cookie.startsWith('hd_session='));
  if (!hasSessionHint) return Promise.resolve(null);

  refreshPromise = fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const body = (await response.json()) as AuthResponse;
      saveAccessToken(body.accessToken);
      return body;
    })
    .catch((cause: unknown) => {
      throw new SessionUnreachable(cause);
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
    // Leemos el JSON de error que enviaste
    const errorBody = (await response.json()) as ApiErrorResponse;
    // Lanzamos el mensaje exacto ("Invalid email or password.")
    throw new Error(errorBody.message);
  }

  const body = await response.json();
  saveAccessToken(body.accessToken);
  return body as AuthResponse;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorBody = (await response.json()) as ApiErrorResponse;
    // Lanzamos el mensaje exacto (ej. "Email already in use.")
    throw new Error(errorBody.message);
  }

  const body = await response.json();
  saveAccessToken(body.accessToken);
  return body as AuthResponse;
}

/** Change the signed-in user's password; the API revokes every session. */
export function changePassword(input: ChangePasswordInput): Promise<void> {
  return request<void>('/auth/change-password', {
    method: 'POST',
    body: changePasswordSchema.parse(input),
  });
}
