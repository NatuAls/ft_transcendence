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

/**
 * Errores por campo, listos para pintar bajo cada input.
 *
 * Pasa por `describeFieldCode` para que el rechazo de la API y el del esquema
 * compartido validado en el navegador (`fieldErrorsFromIssues`) produzcan el
 * MISMO texto bajo el MISMO campo. Si hiciera falta la clave en crudo para
 * traducirla, está en `error.details`.
 */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!isApiError(error)) return {};
  return Object.fromEntries(
    error.details.map((d) => [
      d.path,
      describeFieldCode(d.messageKey ?? d.message ?? d.code),
    ]),
  );
}

/** Clave de traducción para un error cualquiera (API, red o desconocido). */
export function errorKey(error: unknown): string {
  if (isApiError(error)) return error.messageKey;
  if (error instanceof NetworkError) return 'errors.common.network';
  return 'errors.common.unexpected';
}

/**
 * Lo mismo que `fieldErrors`, para los fallos que detecta el navegador con el
 * esquema compartido de `packages/contracts`: validar antes de enviar y que lo
 * rechace la API producen así exactamente la misma pantalla.
 */
export function fieldErrorsFromIssues(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.map(String).join('.') || '(root)';
    if (!(path in campos)) campos[path] = describeFieldCode(issue.message);
  }
  return campos;
}

/**
 * Una frase para las claves que de verdad se repiten. Mientras las pantallas
 * no estén traducidas, esto es lo que ve el usuario; cuando lo estén, se
 * sustituye por `t(errorKey(error))` y ninguna pantalla se entera, porque
 * todas pasan por aquí.
 */
function describeFieldCode(code: string): string {
  const frases: Record<string, string> = {
    'errors.email.invalid': 'Enter a valid e-mail address.',
    'errors.field.required': 'This field is required.',
    'errors.password.tooShort': 'Use at least 10 characters.',
    'errors.password.tooLong': 'Use at most 128 characters.',
    'errors.password.needsLowercase': 'Add a lowercase letter.',
    'errors.password.needsUppercase': 'Add an uppercase letter.',
    'errors.password.needsDigit': 'Add a digit.',
    'errors.password.needsSymbol': 'Add a symbol, such as ! or -.',
    'errors.password.mismatch': 'The two passwords do not match.',
    'errors.terms.required': 'You have to accept the terms to continue.',
    invalid_type: 'This field is required.',
    too_small: 'This value is too short.',
    too_big: 'This value is too long.',
  };
  if (frases[code]) return frases[code];
  // Un mensaje que no es una clave ya viene escrito para leerse.
  return code.startsWith('errors.') ? 'Check this field.' : code;
}

/**
 * El texto que se enseña cuando algo falla y no hay nada más específico. Nunca
 * devuelve `undefined`: una pantalla no puede quedarse sin explicación.
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
