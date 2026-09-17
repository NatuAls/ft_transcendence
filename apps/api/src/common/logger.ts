// =============================================================================
//  Logger v2 — JSON estructurado con redacción en origen
//
//  SUSTITUYE a apps/api/src/common/logger.ts.
//
//  Por qué cambia: la v1 emitía texto libre
//      [2026-09-10T11:00:00.000Z] INFO [bootstrap] API listening on ...
//  que Loki puede almacenar pero no puede consultar por campos. Con una línea
//  JSON por evento, `{service="api"} | json | level="error" | requestId="..."`
//  pasa a ser una consulta de un segundo, y el requestId que ya viaja en la
//  cabecera X-Request-Id enlaza el log del servidor con el error del navegador.
//
//  Y sobre todo: REDACTA. La tarea DevOps 9 pide centralizar logs "evitando
//  secretos, tokens, correos completos o adjuntos". Promtail vuelve a filtrar
//  aguas abajo, pero la defensa buena es no escribirlo nunca: los logs también
//  se leen con `docker logs`, donde Promtail no interviene.
//
//  Compatible hacia atrás: createLogger(scope) devuelve los mismos cinco
//  métodos, así que ningún fichero que ya lo use necesita cambiar. Lo nuevo es
//  el segundo argumento opcional con campos estructurados.
// =============================================================================
import { loadConfiguration } from '../config/env.ts';

const LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'verbose'] as const;
type Level = (typeof LEVELS)[number];

export type LogFields = Record<string, unknown>;

function enabled(level: Level): boolean {
  const configured = loadConfiguration().LOG_LEVEL;
  return LEVELS.indexOf(level) <= LEVELS.indexOf(configured);
}

/**
 * Claves cuyo VALOR nunca se escribe, se mire donde se mire dentro del objeto.
 * La comparación es por nombre normalizado (sin guiones ni mayúsculas), para
 * que `X-API-Key`, `x_api_key` y `apiKey` caigan las tres.
 */
const SECRET_KEYS = new Set([
  'password',
  'newpassword',
  'confirmpassword',
  'currentpassword',
  'passwordhash',
  'pepper',
  'secret',
  'token',
  'accesstoken',
  'refreshtoken',
  'refreshtokenhash',
  'authorization',
  'cookie',
  'setcookie',
  'apikey',
  'xapikey',
  'keyhash',
  'confirmationtokenhash',
  'sessionid',
  'privatekey',
]);

const JWT = /eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const API_KEY = /hdl_live_[A-Za-z0-9]{4}[A-Za-z0-9._-]+/g;
const EMAIL = /([A-Za-z0-9])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const BEARER = /(?<=[Bb]earer\s)[A-Za-z0-9._~+/=-]{8,}/g;

/** Enmascara un texto libre: mensajes, `message` de errores, valores string. */
function scrubText(value: string): string {
  return (
    value
      .replace(BEARER, '[REDACTADO]')
      .replace(JWT, '[JWT-REDACTADO]')
      .replace(API_KEY, '[API-KEY-REDACTADA]')
      // Del correo se conserva inicial y dominio: suficiente para depurar
      // ("el fallo es de los usuarios de @empresa.com") sin identificar a nadie.
      .replace(EMAIL, '$1***$2')
  );
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z]/g, '');
}

/** Recorre el objeto de campos y devuelve una copia segura de serializar. */
function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[demasiado-profundo]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return scrubText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubText(value.message),
      // La traza sólo fuera de producción: revela rutas del sistema de
      // ficheros y estructura interna a quien pueda leer los logs.
      ...(loadConfiguration().NODE_ENV === 'production'
        ? {}
        : { stack: value.stack }),
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => scrub(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as object)) {
      out[key] = SECRET_KEYS.has(normalizeKey(key))
        ? '[REDACTADO]'
        : scrub(item, depth + 1);
    }
    return out;
  }
  return String(value);
}

function emit(
  level: Level,
  scope: string,
  message: string,
  fields?: LogFields,
  error?: unknown,
): void {
  if (!enabled(level)) return;

  const record: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    scope,
    msg: scrubText(message),
  };

  if (fields) Object.assign(record, scrub(fields) as object);
  if (error !== undefined) record['err'] = scrub(error);

  // Una línea, sin saltos: es lo que hace que el driver json-file de Docker y
  // Promtail no tengan que reconstruir eventos multilinea.
  const line = JSON.stringify(record);
  if (level === 'error' || level === 'fatal' || level === 'warn') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export interface Logger {
  fatal(message: string, error?: unknown, fields?: LogFields): void;
  error(message: string, error?: unknown, fields?: LogFields): void;
  warn(message: string, error?: unknown, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  debug(message: string, fields?: LogFields): void;
  /** Deriva un logger que añade campos fijos a cada línea (p. ej. requestId). */
  child(fields: LogFields): Logger;
}

function build(scope: string, base: LogFields = {}): Logger {
  const merge = (fields?: LogFields) =>
    Object.keys(base).length === 0 ? fields : { ...base, ...fields };

  return {
    fatal: (message, error, fields) =>
      emit('fatal', scope, message, merge(fields), error),
    error: (message, error, fields) =>
      emit('error', scope, message, merge(fields), error),
    warn: (message, error, fields) =>
      emit('warn', scope, message, merge(fields), error),
    info: (message, fields) => emit('info', scope, message, merge(fields)),
    debug: (message, fields) => emit('debug', scope, message, merge(fields)),
    child: (fields) => build(scope, { ...base, ...fields }),
  };
}

export function createLogger(scope: string): Logger {
  return build(scope);
}
