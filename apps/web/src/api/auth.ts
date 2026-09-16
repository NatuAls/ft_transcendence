// --- 1. GESTIÓN DEL TOKEN EN MEMORIA ---
let inMemoryAccessToken: string | null = null;

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

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  acceptTerms: boolean;
  locale: 'EN' | 'SP' | 'AR';
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    username: string;
    email: string;
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
    memberships: unknown[];
    permissions: unknown[];
  };
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
