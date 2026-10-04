// =============================================================================
//  Errores de la API, con la forma que la API garantiza.
//
//  `error-handler.ts` responde SIEMPRE con el mismo sobre:
//
//      { requestId, timestamp, path, statusCode, code, messageKey, message,
//        details?: [{ path, code, messageKey|message }] }
//
//  Las tres piezas que importan a una pantalla:
//
//    · `code`       identificador estable del rechazo (`ORG_LAST_ADMIN`,
//                   `GDPR_USERNAME_MISMATCH`): se puede comparar sin leer
//                   inglés y sin romperse si cambia el texto.
//    · `details`    un error por campo, para pintarlo bajo su input.
//    · `requestId`  el mismo identificador que quedó en los logs del
//                   servidor: es lo que se pide en un informe de fallo.
// =============================================================================

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
    super(body.message ?? `The request failed (HTTP ${status}).`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code ?? 'UNKNOWN';
    this.messageKey = body.messageKey ?? 'errors.common.unexpected';
    this.details = body.details ?? [];
    this.requestId = body.requestId;
  }
}

/** No hubo respuesta del servidor: red caída, CORS, petición abortada. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('The server did not answer.');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Errores por campo listos para el formulario: `{ email: 'Not a valid …' }`.
 *
 * Mientras no haya i18n en el front se usa el texto que ya manda la API; el
 * día que lo haya, basta con cambiar esta función por `messageKey` y ninguna
 * pantalla se entera.
 */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!isApiError(error)) return {};
  const campos: Record<string, string> = {};
  for (const detail of error.details) {
    if (!(detail.path in campos)) {
      campos[detail.path] = detail.message ?? describeFieldCode(detail.code);
    }
  }
  return campos;
}

/**
 * Lo mismo para los fallos que detecta el navegador con el esquema compartido
 * de `packages/contracts`, para que validar antes de enviar y que lo rechace
 * la API produzcan exactamente la misma pantalla.
 */
export function fieldErrorsFromIssues(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.map(String).join('.') || '(root)';
    if (!(path in campos)) {
      // Los esquemas del proyecto devuelven claves (`errors.email.invalid`)
      // en vez de frases: no se enseña una clave a un usuario.
      campos[path] = issue.message.startsWith('errors.')
        ? describeFieldCode(issue.message)
        : issue.message;
    }
  }
  return campos;
}

/** Una frase para el puñado de claves que se repiten; si no, algo genérico. */
function describeFieldCode(code: string): string {
  const frases: Record<string, string> = {
    'errors.email.invalid': 'Enter a valid e-mail address.',
    'errors.field.required': 'This field is required.',
    invalid_type: 'This field is required.',
    too_small: 'This value is too short.',
    too_big: 'This value is too long.',
  };
  return frases[code] ?? 'Check this field.';
}

/**
 * El texto que se enseña cuando algo falla y no hay nada más específico que
 * decir. Nunca devuelve `undefined`: una pantalla no puede quedarse sin
 * explicación.
 */
export function errorMessage(
  error: unknown,
  fallback = 'Something went wrong. Try again.',
): string {
  if (isApiError(error)) return error.message;
  if (error instanceof NetworkError)
    return 'The server did not answer. Check your connection and try again.';
  return error instanceof Error && error.message ? error.message : fallback;
}
