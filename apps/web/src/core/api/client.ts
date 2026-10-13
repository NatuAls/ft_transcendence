// Cliente HTTP único del frontend. Todas las pantallas pasan por aquí:
//  - añade el Bearer y las credenciales (cookie de refresh),
//  - serializa JSON (o deja pasar FormData),
//  - ante un 401 renueva la sesión UNA vez (refreshSession) y reintenta,
//  - convierte cualquier fallo en ApiError / NetworkError (errors.ts),
//  - upload() sube ficheros con progreso (XHR: fetch no lo expone).
import {
  getAccessToken,
  refreshSession,
  clearAccessToken,
} from '../../api/auth';
import { ApiError, NetworkError, type ApiErrorBody } from './errors';

const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

type Query = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Interno: evita reintentar más de una vez tras renovar la sesión. */
  retried?: boolean;
}

let onUnauthorized: () => void = () => {};
/** La app registra aquí qué hacer cuando ni siquiera el refresh sirve (volver al login). */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

function buildUrl(path: string, query?: Query) {
  const url = new URL(`${API_URL}${path}`, window.location.origin);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '')
      url.searchParams.set(k, String(v));
  }
  return url.toString();
}

function authHeaders(extra: Record<string, string> = {}) {
  const token = getAccessToken();
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

async function parseError(response: Response): Promise<ApiError> {
  const body = (await response
    .json()
    .catch(() => ({}))) as Partial<ApiErrorBody>;
  return new ApiError(body, response.status);
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const isForm = options.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      credentials: 'include',
      signal: options.signal,
      headers: authHeaders({
        ...(options.body !== undefined && !isForm
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...options.headers,
      }),
      body: isForm
        ? (options.body as FormData)
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
    });
  } catch (error) {
    throw new NetworkError(error);
  }

  if (response.status === 401 && !options.retried) {
    // Si el servidor no contesta mientras se renueva, esto NO es un cierre de
    // sesión: es un corte. Se devuelve como error de red para que la pantalla
    // ofrezca reintentar, en vez de echar a nadie.
    let session: Awaited<ReturnType<typeof refreshSession>>;
    try {
      session = await refreshSession();
    } catch (error) {
      throw new NetworkError(error);
    }
    if (session) return request<T>(path, { ...options, retried: true });
    clearAccessToken();
    onUnauthorized();
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) =>
    request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body }),
  del: <T = void>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/** Subida con progreso (adjuntos, avatar). Reintenta una vez tras renovar la sesión. */
export function upload<T>(
  path: string,
  form: FormData,
  onProgress?: (percent: number) => void,
  retried = false,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', buildUrl(path));
    xhr.withCredentials = true;
    for (const [k, v] of Object.entries(authHeaders()))
      xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new NetworkError('xhr'));
    xhr.onload = () => {
      if (xhr.status === 401 && !retried) {
        void refreshSession().then((session) => {
          if (session) resolve(upload<T>(path, form, onProgress, true));
          else {
            clearAccessToken();
            onUnauthorized();
            reject(
              new ApiError(
                {
                  statusCode: 401,
                  code: 'UNAUTHORIZED',
                  messageKey: 'errors.auth.sessionExpired',
                  message: 'Unauthorized',
                },
                401,
              ),
            );
          }
        });
        return;
      }
      let body: Partial<ApiErrorBody> & Record<string, unknown> = {};
      try {
        body = JSON.parse(xhr.responseText) as typeof body;
      } catch {
        /* sin cuerpo */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as T);
      else reject(new ApiError(body, xhr.status));
    };
    xhr.send(form);
  });
}

/**
 * Descarga un fichero autenticado y lo entrega al navegador.
 *
 * El gemelo de `upload()`: no puede ser un enlace porque el endpoint va con
 * token y una navegación no lleva cabeceras. Se trae el cuerpo, se envuelve en
 * un blob y se suelta por un ancla sintética; el object URL se revoca después
 * o el blob se queda en memoria mientras viva el documento.
 *
 * Lo usa la exportación del RGPD, que es el único sitio donde la API devuelve
 * un fichero y no JSON.
 */
export async function apiDownload(
  path: string,
  defaultFilename: string,
): Promise<void> {
  const token = getAccessToken();
  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (error) {
    throw new NetworkError(error);
  }
  if (!response.ok) throw await parseError(response);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  // La API pone el nombre real en Content-Disposition; se respeta si está.
  link.download =
    /filename="?([^"]+)"?/.exec(
      response.headers.get('content-disposition') ?? '',
    )?.[1] ?? defaultFilename;
  link.click();
  URL.revokeObjectURL(url);
}
