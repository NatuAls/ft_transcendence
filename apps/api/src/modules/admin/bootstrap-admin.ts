// =============================================================================
//  Primer administrador (auditoría §6.3 / hallazgo G3)
//
//  Problema: PATCH /users/:id/role exige ser GLOBAL_ADMIN, así que en una base
//  recién desplegada no había forma de crear el primer administrador sin
//  entrar por psql. Un `UPDATE users SET ...` a mano delante del evaluador es
//  frágil y da mala imagen.
//
//  El arranque resuelve esto por dos caminos independientes, en este orden:
//
//  1. PROMOCIONAR una cuenta que ya existe (BOOTSTRAP_ADMIN_EMAIL). Si está
//     definida y todavía no existe NINGÚN GLOBAL_ADMIN, se promociona al
//     usuario con ese correo. Es idempotente y se autodesactiva: en cuanto hay
//     un administrador no vuelve a tocar nada, aunque la variable siga
//     definida. Si el correo aún no se ha registrado, sólo avisa.
//
//  2. CREAR el administrador principal (BOOTSTRAP_ADMIN_USERNAME +
//     BOOTSTRAP_ADMIN_PASSWORD). Es una cuenta de servicio: existe desde el
//     primer despliegue, sin que nadie tenga que registrarse, y es la que
//     reparte roles al resto. Dos decisiones a propósito:
//
//       · el nombre de usuario llega por SECRETO, no está en el repositorio y
//         no debe ser deducible ("admin", "soporte", "root"...). Ese nombre se
//         ve en la aplicación (buscador, comentarios, tickets), así que quien
//         no lo conozca no sabe a qué cuenta atacar.
//       · la contraseña llega por SECRETO de despliegue y nunca se escribe en
//         disco: se guarda ya hasheada (Argon2id + pepper, el mismo camino que
//         el registro normal) y no aparece en registros ni en la auditoría.
//
//     El correo de esta cuenta se DERIVA del usuario (<usuario>@<dominio
//     reservado>): es el identificador con el que se entra, no hace falta un
//     buzón de verdad y así no puede chocar nunca con el de una persona. La
//     cuenta se crea ya verificada, porque no hay a dónde enviar el correo de
//     verificación.
//
//  Ninguno de los dos caminos hace caer la API si su configuración está mal:
//  un secreto ausente o una contraseña que no cumple la política se quedan en
//  un aviso en el registro del despliegue. Un despliegue no debe caerse por
//  esto (ya pasó con BOOTSTRAP_ADMIN_EMAIL="" en el despliegue #30).
// =============================================================================
import { passwordSchema, usernameSchema } from 'contracts';
import { prisma } from '../../database/prisma.ts';
import { loadConfiguration } from '../../config/env.ts';
import { createLogger } from '../../common/logger.ts';
import { hashPassword } from '../auth/password.ts';
import { revokeAllForUser } from '../auth/token.ts';
import { record } from '../audit/audit.service.ts';

const logger = createLogger('bootstrap-admin');

/**
 * Dominio del correo del administrador principal. `.invalid` está reservado
 * por la RFC 2606 y no resuelve en ningún sitio: ni un despiste ni un futuro
 * aviso automático pueden enviar nada a una dirección de verdad.
 */
const SERVICE_EMAIL_DOMAIN = 'helpdesk.invalid';

export function primaryAdminEmail(username: string): string {
  return `${username}@${SERVICE_EMAIL_DOMAIN}`;
}

/**
 * El administrador principal está protegido frente al resto de la plataforma:
 * es la cuenta de rescate, y otro administrador no debería poder dejar el
 * sitio sin ella. Se compara por nombre de usuario (que es el secreto) para no
 * tener que añadir una columna ni una migración por esto.
 */
export function isPrimaryAdminUsername(username: string): boolean {
  const configured = loadConfiguration().BOOTSTRAP_ADMIN_USERNAME;
  if (!configured) return false;
  return configured.trim().toLowerCase() === username.trim().toLowerCase();
}

export async function bootstrapFirstAdmin(): Promise<void> {
  // El orden importa: promocionar mira "¿hay algún admin?", y crear la cuenta
  // de servicio haría que esa respuesta fuese siempre "sí".
  await promoteByEmail();
  await ensurePrimaryAdmin();
}

// --------------------------------------------------------------- promocionar --
async function promoteByEmail(): Promise<void> {
  const email = loadConfiguration().BOOTSTRAP_ADMIN_EMAIL;
  if (!email) return;

  const admins = await prisma.user.count({
    where: { globalRole: 'GLOBAL_ADMIN', deletedAt: null },
  });
  if (admins > 0) {
    logger.debug('ya existe un GLOBAL_ADMIN; BOOTSTRAP_ADMIN_EMAIL no actúa');
    return;
  }

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, username: true, globalRole: true },
  });
  if (!user) {
    logger.warn(
      'BOOTSTRAP_ADMIN_EMAIL definido pero ese correo aún no está registrado: regístralo y reinicia la API',
    );
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { globalRole: 'GLOBAL_ADMIN' },
  });
  await record({
    actor: { id: user.id },
    action: 'user.role.changed',
    entity: 'User',
    entityId: user.id,
    before: { globalRole: user.globalRole },
    after: { globalRole: 'GLOBAL_ADMIN', via: 'BOOTSTRAP_ADMIN_EMAIL' },
  });
  logger.info(`primer GLOBAL_ADMIN promocionado: ${user.username}`);
}

// ---------------------------------------------------- administrador principal --
async function ensurePrimaryAdmin(): Promise<void> {
  const config = loadConfiguration();
  const rawUsername = config.BOOTSTRAP_ADMIN_USERNAME;
  const rawPassword = config.BOOTSTRAP_ADMIN_PASSWORD;

  if (!rawUsername && !rawPassword) return;
  if (!rawUsername || !rawPassword) {
    logger.error(
      'BOOTSTRAP_ADMIN_USERNAME y BOOTSTRAP_ADMIN_PASSWORD van juntos: falta uno de los dos, no se crea el administrador principal',
    );
    return;
  }

  // Las mismas reglas que el registro: si el secreto no las cumple, tendríamos
  // un administrador que no podría cambiarse la contraseña desde la interfaz.
  const username = usernameSchema.safeParse(rawUsername);
  if (!username.success) {
    logger.error(
      'BOOTSTRAP_ADMIN_USERNAME no es un nombre de usuario válido (3-32, letras, dígitos, guiones y _): no se crea el administrador principal',
    );
    return;
  }
  if (!passwordSchema.safeParse(rawPassword).success) {
    // El motivo exacto no se registra: describiría el secreto.
    logger.error(
      'BOOTSTRAP_ADMIN_PASSWORD no cumple la política (10+ caracteres, mayúscula, minúscula, dígito y símbolo): no se crea el administrador principal',
    );
    return;
  }

  const name = username.data;
  const email = primaryAdminEmail(name);
  const displayName = config.BOOTSTRAP_ADMIN_DISPLAY_NAME ?? 'Administración';

  const existing = await prisma.user.findFirst({
    where: { username: name },
    select: {
      id: true,
      globalRole: true,
      isActive: true,
      deletedAt: true,
    },
  });

  if (!existing) {
    await createPrimaryAdmin({
      name,
      email,
      displayName,
      password: rawPassword,
    });
    return;
  }

  await reassertPrimaryAdmin({ ...existing, name, password: rawPassword });
}

async function createPrimaryAdmin(input: {
  name: string;
  email: string;
  displayName: string;
  password: string;
}): Promise<void> {
  const passwordHash = await hashPassword(input.password);

  // Sin evento de dominio: esto corre antes de que existan Socket.IO y los
  // oyentes de notificaciones, y una cuenta de servicio no tiene a quién
  // avisar de su propia creación.
  const created = await prisma.user.create({
    data: {
      email: input.email,
      username: input.name,
      passwordHash,
      globalRole: 'GLOBAL_ADMIN',
      // No hay buzón detrás de <usuario>@helpdesk.invalid: si no se marca
      // verificada, la cuenta se quedaría esperando un correo que nadie puede
      // recibir.
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          firstName: input.displayName,
          lastName: '',
          displayName: input.displayName,
        },
      },
      preferences: { create: {} },
    },
    select: { id: true, username: true },
  });

  await record({
    actor: { id: created.id },
    action: 'user.created',
    entity: 'User',
    entityId: created.id,
    after: {
      username: created.username,
      globalRole: 'GLOBAL_ADMIN',
      via: 'BOOTSTRAP_ADMIN_USERNAME',
    },
  });
  // Sin la dirección literal: el logger tacha lo que parece un correo, así que
  // imprimirla sólo dejaría "z***@..." en el registro. Lo útil es la regla.
  logger.info(
    'administrador principal creado; se entra con <BOOTSTRAP_ADMIN_USERNAME>@' +
      `${SERVICE_EMAIL_DOMAIN} y la contraseña del secreto de despliegue`,
  );
}

async function reassertPrimaryAdmin(input: {
  id: string;
  name: string;
  password: string;
  globalRole: string;
  isActive: boolean;
  deletedAt: Date | null;
}): Promise<void> {
  const rotate = loadConfiguration().BOOTSTRAP_ADMIN_ROTATE === '1';
  const restore =
    input.globalRole !== 'GLOBAL_ADMIN' || !input.isActive || input.deletedAt;

  if (!rotate && !restore) {
    logger.debug('el administrador principal ya está en su sitio');
    return;
  }

  await prisma.user.update({
    where: { id: input.id },
    data: {
      globalRole: 'GLOBAL_ADMIN',
      isActive: true,
      deletedAt: null,
      ...(rotate
        ? {
            passwordHash: await hashPassword(input.password),
            failedLoginCount: 0,
            lockedUntil: null,
          }
        : {}),
    },
  });

  if (rotate) {
    // Una contraseña nueva no debe convivir con sesiones abiertas con la
    // anterior: si se rota porque se sospecha una fuga, hay que echar a quien
    // esté dentro. El mismo camino que usa el cambio de contraseña: revocar
    // sólo las filas de refresh dejaría válido hasta 15 minutos el JWT que ya
    // esté en un navegador.
    await revokeAllForUser(input.id);
  }

  await record({
    actor: { id: input.id },
    action: rotate ? 'user.password.rotated' : 'user.role.changed',
    entity: 'User',
    entityId: input.id,
    before: {
      globalRole: input.globalRole,
      isActive: input.isActive,
      deleted: Boolean(input.deletedAt),
    },
    after: {
      globalRole: 'GLOBAL_ADMIN',
      isActive: true,
      deleted: false,
      via: rotate ? 'BOOTSTRAP_ADMIN_ROTATE' : 'BOOTSTRAP_ADMIN_USERNAME',
    },
  });

  logger.warn(
    rotate
      ? `contraseña del administrador principal (${input.name}) rotada desde el secreto; sesiones anteriores revocadas. Vuelve a poner BOOTSTRAP_ADMIN_ROTATE=0`
      : `el administrador principal (${input.name}) estaba degradado o desactivado: restaurado`,
  );
}
