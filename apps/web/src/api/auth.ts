// Añadido: cliente mínimo del frontend para consumir los endpoints de autenticación.
// La URL puede cambiarse con VITE_API_URL; por defecto se usa el mismo origen
// para que el navegador pase por el proxy de Vite tanto en Docker como local.

// Añadido: contrato de entrada que coincide con packages/contracts/src/auth.ts.
export interface LoginInput {
  email: string;
  password: string;
}

// Añadido: respuesta que devuelve POST /api/v1/auth/login.
export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    username: string;
    [key: string]: unknown;
  };
}

// La ruta relativa evita acoplar el navegador al puerto interno del backend.
const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

// Añadido: almacena el access token para que las siguientes peticiones puedan
// autenticarse. Se usa sessionStorage cuando el usuario no quiere persistencia.
export function saveAccessToken(token: string, keepSignedIn: boolean): void {
  sessionStorage.removeItem('helpdesk_access_token');
  localStorage.removeItem('helpdesk_access_token');
  (keepSignedIn ? localStorage : sessionStorage).setItem(
    'helpdesk_access_token',
    token,
  );
}

// Añadido: función reutilizable para llamadas autenticadas posteriores al login.
export function getAccessToken(): string | null {
  return (
    localStorage.getItem('helpdesk_access_token') ??
    sessionStorage.getItem('helpdesk_access_token')
  );
}

// Añadido: conexión con POST /api/v1/auth/login.
export async function login(input: LoginInput): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Necesario para que el navegador acepte la cookie HttpOnly de refresh.
    credentials: 'include',
    body: JSON.stringify(input),
  });

  const body = (await response.json().catch(() => null)) as
    | LoginResponse
    | { message?: string };

  if (!response.ok) {
    throw new Error(
      'message' in body && body.message
        ? body.message
        : 'No se pudo iniciar sesión.',
    );
  }

  return body as LoginResponse;
}
