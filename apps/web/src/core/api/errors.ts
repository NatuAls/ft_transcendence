// Errores de la API con forma conocida. La API responde SIEMPRE con
// { requestId, timestamp, path, statusCode, code, messageKey, message,
//   details?: [{ path, code, messageKey|message }] }  (error-handler.ts).
// messageKey empieza por "errors." y coincide con las claves de i18n, así
// que la pantalla puede hacer t(error.messageKey) sin mapas intermedios.

export interface ApiFieldError {
  path: string;
  code: string;
  messageKey?: string;
  message?: string;
}

export interface ApiErrorBody {
  requestId?: string;
  timestamp?: string;
  path?: string;
  statusCode: number;
  code: string;
  messageKey: string;
  message: string;
  details?: ApiFieldError[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly messageKey: string;
  readonly details: ApiFieldError[];
  readonly requestId: string | undefined;

  constructor(body: Partial<ApiErrorBody>, status: number) {
    super(body.message ?? `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code ?? 'UNKNOWN';
    this.messageKey = body.messageKey ?? 'errors.common.unexpected';
    this.details = body.details ?? [];
    this.requestId = body.requestId;
  }
}

/** Sin respuesta del servidor (red caída, CORS, timeout). */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('network');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Errores por campo, listos para pintar bajo cada input: { email: 'errors.email.invalid' }. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!isApiError(error)) return {};
  return Object.fromEntries(
    error.details.map((d) => [d.path, d.messageKey ?? d.message ?? d.code]),
  );
}

/** Clave de traducción para un error cualquiera (API, red o desconocido). */
export function errorKey(error: unknown): string {
  if (isApiError(error)) return error.messageKey;
  if (error instanceof NetworkError) return 'errors.common.network';
  return 'errors.common.unexpected';
}
