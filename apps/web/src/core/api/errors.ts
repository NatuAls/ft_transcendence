// Errores de la API con forma conocida. La API responde SIEMPRE con
// { requestId, timestamp, path, statusCode, code, messageKey, message,
//   details?: [{ path, code, messageKey|message }] }  (error-handler.ts).
// messageKey empieza por "errors." y coincide con las claves de i18n, así
// que la pantalla puede hacer t(error.messageKey) sin mapas intermedios.

import i18next from 'i18next';

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
  issues: ReadonlyArray<{
    code?: string;
    message: string;
    minimum?: unknown;
    origin?: string;
    path: ReadonlyArray<PropertyKey>;
  }>,
): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.map(String).join('.') || '(root)';
    if (!(path in campos))
      campos[path] = describeFieldCode(
        // El mensaje propio de un esquema compartido es una clave `errors.*`.
        // Cuando el esquema no trae uno —`min(3)` a secas—, Zod deja una
        // frase técnica en inglés («Too small: expected string to have >=3
        // characters») y lo que de verdad dice está en el código.
        issue.message.startsWith('errors.')
          ? issue.message
          : requiredWhenEmpty(issue),
      );
  }
  return campos;
}

/**
 * `min(1)` es «obligatorio»: un campo vacío no es «demasiado corto». El dato
 * está en el propio aviso de Zod —su mínimo—, así que vale en cualquier
 * idioma, sin mirar la frase en inglés que trae.
 */
function requiredWhenEmpty(issue: {
  code?: string;
  message: string;
  minimum?: unknown;
  origin?: string;
}): string {
  if (
    issue.code === 'too_small' &&
    Number(issue.minimum) === 1 &&
    issue.origin !== 'number'
  )
    return 'invalid_type';
  return issue.code ?? issue.message;
}

/**
 * La clave de un error de campo, para las pantallas que traducen ellas mismas
 * con `t(fieldErrorKey(…))`.
 *
 * Acepta las tres formas en que puede llegar: una clave `errors.*`, una de
 * las frases en inglés que devolvía `fieldErrorsFromIssues` hasta el 13/10, o
 * —lo que devuelve ahora— el texto ya traducido al idioma activo, que se
 * busca entre las traducciones de errores de ese idioma. Así esas pantallas
 * enseñan el mensaje concreto, y no el genérico, en los tres idiomas.
 */
export function fieldErrorKey(message: string): string {
  const keys: Record<string, string> = {
    'Enter a valid e-mail address.': 'errors.email.invalid',
    'This field is required.': 'errors.field.required',
    'Use at least 10 characters.': 'errors.password.tooShort',
    'Use at most 128 characters.': 'errors.password.tooLong',
    'Add a lowercase letter.': 'errors.password.needsLowercase',
    'Add an uppercase letter.': 'errors.password.needsUppercase',
    'Add a digit.': 'errors.password.needsDigit',
    'Add a symbol, such as ! or -.': 'errors.password.needsSymbol',
    'The two passwords do not match.': 'errors.password.mismatch',
    'You have to accept the terms to continue.': 'errors.terms.required',
  };
  const codes: Record<string, string> = {
    invalid_type: 'errors.field.required',
    too_small: 'errors.password.tooShort',
    too_big: 'errors.password.tooLong',
  };
  if (codes[message]) return codes[message];
  if (message.startsWith('errors.')) return message;
  return keys[message] ?? errorKeyOfText(message) ?? 'errors.field.invalid';
}

/** La clave `errors.*` cuyo texto, en el idioma activo, es exactamente éste. */
function errorKeyOfText(text: string): string | undefined {
  const bundle = i18next.getResourceBundle(i18next.language, 'translation') as
    { errors?: Record<string, Record<string, unknown>> } | undefined;
  for (const [group, entries] of Object.entries(bundle?.errors ?? {}))
    for (const [name, value] of Object.entries(entries))
      if (value === text) return `errors.${group}.${name}`;
  return undefined;
}

/**
 * El texto de un error de campo, en el idioma de la persona.
 *
 * Hasta el 13/10 esto era un diccionario fijo en inglés, y su comentario ya
 * avisaba: «cuando las pantallas estén traducidas, se sustituye por la
 * traducción y ninguna pantalla se entera, porque todas pasan por aquí». Es
 * lo que hace ahora. El cambio de contraseña, que no podía esperar, se había
 * hecho su propio apaño retraduciendo cada error; ya no hace falta.
 *
 * Tres orígenes posibles, en este orden:
 *   · una clave `errors.*` del esquema compartido o de la API → su traducción;
 *   · un código de Zod sin mensaje propio (`too_small`…) → su equivalente;
 *   · un texto que ya viene escrito para leerse → tal cual.
 * Una clave que no esté traducida da «Check this field.» en su idioma, nunca
 * la clave en crudo; `api-error-keys.test.ts` vigila que no haga falta.
 */
const CODIGOS_DE_ZOD: Record<string, string> = {
  invalid_type: 'errors.field.required',
  too_small: 'errors.field.tooShort',
  too_big: 'errors.field.tooLong',
  // Los demás códigos de Zod no tienen una frase mejor que la genérica, pero
  // tienen que estar: un código que no está aquí se enseñaría tal cual.
  custom: 'errors.field.invalid',
  invalid_element: 'errors.field.invalid',
  invalid_format: 'errors.field.invalid',
  invalid_key: 'errors.field.invalid',
  invalid_union: 'errors.field.invalid',
  invalid_value: 'errors.field.invalid',
  not_multiple_of: 'errors.field.invalid',
  unrecognized_keys: 'errors.field.invalid',
};

function describeFieldCode(code: string): string {
  const clave = CODIGOS_DE_ZOD[code] ?? code;
  if (!clave.startsWith('errors.')) return code;
  return i18next.t(clave, { defaultValue: i18next.t('errors.field.invalid') });
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
