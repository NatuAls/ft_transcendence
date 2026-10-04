/**
 * ============================================================================
 *  Los dos atajos de base de datos que necesitan las pruebas de roles.
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
