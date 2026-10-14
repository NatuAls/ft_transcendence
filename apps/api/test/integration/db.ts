/**
 * ============================================================================
 *  Los atajos de base de datos de las pruebas: los dos de las de roles, y al
 *  final los del borrado de cuentas.
 *
 *  El resto de la suite habla sólo por HTTP, y estas pruebas también, salvo en
 *  dos puntos que por diseño NO tienen camino HTTP:
 *
 *    · El primer GLOBAL_ADMIN. Sólo otro GLOBAL_ADMIN puede crearlo, y la
 *      cuenta de rescate del despliegue no existe en la base de pruebas.
 *    · El token de verificación del correo. El de verdad viaja únicamente por
 *      correo, y en la base sólo queda su hash. Aquí se inserta un token que
 *      la prueba conoce y luego se consume por el endpoint REAL
 *      (POST /auth/verify-email): lo que se prueba es ese camino, entero, con
 *      la reclamación de los roles incluida.
 *
 *  Usa DATABASE_URL, la misma base que la API levantada. Sin ella, las pruebas
 *  que dependen de esto se saltan con un mensaje en lugar de fallar.
 * ============================================================================
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { api } from './helpers.ts';

export const DB_SKIP_MESSAGE =
  'DATABASE_URL no está definida: hace falta para crear el primer ' +
  'GLOBAL_ADMIN y un token de verificación conocido';

let pool: pg.Pool | undefined;

function db(): pg.Pool {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error(DB_SKIP_MESSAGE);
  // Prisma admite `?schema=public` en la URL; node-postgres no lo entiende y
  // lo pasaría como parámetro de arranque desconocido.
  const connectionString = url.replace(/[?&]schema=[^&]*/, '');
  pool ??= new pg.Pool({ connectionString, max: 2 });
  return pool;
}

export function dbAvailable(): boolean {
  return Boolean(process.env['DATABASE_URL']);
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

export async function promoteToGlobalAdmin(userId: string): Promise<void> {
  await db().query(
    `UPDATE users SET "globalRole" = 'GLOBAL_ADMIN' WHERE id = $1`,
    [userId],
  );
}

/**
 * Verifica el correo de una cuenta por el camino real: inserta un token
 * conocido (su hash, como hace el registro) y lo consume con
 * POST /auth/verify-email.
 */
export async function verifyEmailOf(userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  await db().query(
    `INSERT INTO verification_tokens (id, "userId", purpose, "tokenHash", "expiresAt")
     VALUES ($1, $2, 'EMAIL_VERIFY', $3, now() + interval '1 hour')`,
    [randomUUID(), userId, hash],
  );
  const response = await api('POST', '/auth/verify-email', {
    body: { token },
  });
  if (response.status !== 204) {
    throw new Error(
      `la verificación devolvió ${response.status}: ${response.text.slice(0, 200)}`,
    );
  }
}

// -----------------------------------------------------------------------------
//  Borrado de cuentas. Tampoco tienen camino HTTP, también por diseño: el
//  paso del tiempo (los 30 días de una cuenta cerrada, el año del registro de
//  auditoría) y el token del autoborrado, que sólo viaja por correo.
// -----------------------------------------------------------------------------

/** Hace como si un administrador hubiera cerrado la cuenta hace `days` días. */
export async function backdateClosure(
  userId: string,
  days: number,
): Promise<void> {
  await db().query(
    `UPDATE users SET "deletedAt" = now() - make_interval(days => $2::int)
     WHERE id = $1`,
    [userId, days],
  );
}

/** Cuándo se borraron los datos personales de una cuenta, si se borraron. */
export async function erasedAtOf(userId: string): Promise<Date | null> {
  const { rows } = await db().query<{ erasedAt: Date | null }>(
    `SELECT "erasedAt" FROM users WHERE id = $1`,
    [userId],
  );
  return rows[0]?.erasedAt ?? null;
}

/**
 * Una solicitud RGPD esperando confirmación, con un token que la prueba
 * conoce (su hash, como hace la API). Devuelve el token.
 */
export async function pendingGdprRequest(
  userId: string,
  type: 'EXPORT' | 'DELETE',
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  await db().query(
    `INSERT INTO gdpr_requests (id, "userId", type, "confirmationTokenHash", "expiresAt")
     VALUES ($1, $2, $3::"GdprRequestType", $4, now() + interval '30 minutes')`,
    [randomUUID(), userId, type, hash],
  );
  return token;
}

/**
 * Una exportación terminada cuyo archivo es `artifactPath`, con la ventana de
 * descarga abierta o ya cerrada. Devuelve el id de la solicitud.
 */
export async function finishedExport(
  userId: string,
  artifactPath: string,
  expired: boolean,
): Promise<string> {
  const id = randomUUID();
  await db().query(
    `INSERT INTO gdpr_requests (id, "userId", type, status, "completedAt", "artifactPath", "expiresAt")
     VALUES ($1, $2, 'EXPORT', 'COMPLETED', now(), $3,
             now() + CASE WHEN $4::boolean THEN interval '-1 hour' ELSE interval '1 day' END)`,
    [id, userId, artifactPath, expired],
  );
  return id;
}

/** El archivo que conserva una solicitud de exportación, o null. */
export async function artifactOf(requestId: string): Promise<string | null> {
  const { rows } = await db().query<{ artifactPath: string | null }>(
    `SELECT "artifactPath" FROM gdpr_requests WHERE id = $1`,
    [requestId],
  );
  return rows[0]?.artifactPath ?? null;
}

/** Una entrada de auditoría de hace `days` días. Devuelve su id. */
export async function oldAuditEntry(days: number): Promise<string> {
  const id = randomUUID();
  await db().query(
    `INSERT INTO audit_logs (id, action, entity, "createdAt")
     VALUES ($1, 'user.created', 'User', now() - make_interval(days => $2::int))`,
    [id, days],
  );
  return id;
}

export async function auditEntryExists(id: string): Promise<boolean> {
  const { rowCount } = await db().query(
    `SELECT 1 FROM audit_logs WHERE id = $1`,
    [id],
  );
  return (rowCount ?? 0) > 0;
}
