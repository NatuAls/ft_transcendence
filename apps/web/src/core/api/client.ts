// =============================================================================
//  El ÚNICO sitio del front con `fetch`.
//
//  Viene de apps/web/src/api/http.ts, que ya hacía lo esencial, y recoge lo
//  que faltaba del estándar: el sobre de error completo (`details`,
//  `messageKey`, `requestId`), el fallo de red distinguido del rechazo del
//  servidor, y la descarga de ficheros autenticada.
//
//  Qué resuelve, para que ninguna pantalla lo repita:
//
//    · la URL base y la cookie de sesión,
//    · el `Authorization` con el token en memoria,
//    · la renovación del token ante un 401, UNA vez, y el reintento,
//    · convertir cualquier fallo en ApiError o NetworkError.
// =============================================================================
import { getAccessToken, refreshSession } from '../../api/auth';
import { ApiError, NetworkError, type ApiErrorBody } from './errors';

const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

async function send(path: string, init: RequestInit): Promise<Response> {
  const token = getAccessToken();
  try {
    return await fetch(`${API_URL}${path}`, {
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
  } catch (cause) {
    // `fetch` sólo rechaza cuando no hubo respuesta. Un 500 NO pasa por aquí.
    throw new NetworkError(cause);
  }
}

/**
 * Hace la petición y devuelve la respuesta cruda, ya con la sesión renovada
 * si hacía falta. Lo usan `apiRequest` y la descarga de ficheros.
 *
 * El token de acceso dura 15 minutos y sólo se renovaba al arrancar, así que
 * una pantalla abierta más tiempo empezaba a fallar en cada llamada. Ante un
 * 401 se renueva por la cookie de refresco y se repite; un segundo 401 ya es
 * real y se reporta como tal.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  let response = await send(path, init);
  if (response.status === 401 && (await refreshSession())) {
    response = await send(path, init);
  }
  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => null)) as Partial<ApiErrorBody> | null;
    throw new ApiError(body ?? {}, response.status);
  }
  return response;
}

/** Petición JSON. Es la que usan todos los módulos de `src/api`. */
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await apiFetch(path, init);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function jsonBody(value: unknown): Pick<RequestInit, 'body'> {
  return { body: JSON.stringify(value) };
}

/**
 * Descarga un fichero y lo entrega al navegador.
 *
 * No puede ser un enlace: el endpoint va con token y una navegación no lleva
 * cabeceras. Se trae el cuerpo, se envuelve en un blob y se suelta por un
 * ancla sintética; el object URL se revoca después o el blob se queda en
 * memoria mientras viva el documento.
 */
export async function apiDownload(
  path: string,
  defaultFilename: string,
): Promise<void> {
  const response = await apiFetch(path);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filenameFrom(response) ?? defaultFilename;
  link.click();
  URL.revokeObjectURL(url);
}

/** La API pone el nombre real en Content-Disposition; se respeta si está. */
function filenameFrom(response: Response): string | null {
  const header = response.headers.get('content-disposition');
  return /filename="?([^"]+)"?/.exec(header ?? '')?.[1] ?? null;
}

export { ApiError, NetworkError } from './errors';
