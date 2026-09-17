// =============================================================================
//  Primer administrador (auditoría §6.3 / hallazgo G3)
//
//  Problema: PATCH /users/:id/role exige ser GLOBAL_ADMIN, así que en una base
//  recién desplegada no había forma de crear el primer administrador sin
//  entrar por psql. Un `UPDATE users SET ...` a mano delante del evaluador es
//  frágil y da mala imagen.
//
//  Solución: la variable BOOTSTRAP_ADMIN_EMAIL. Si está definida y todavía no
//  existe NINGÚN GLOBAL_ADMIN, el arranque promociona al usuario con ese
//  correo. Es idempotente y se autodesactiva: en cuanto hay un administrador
//  (el promocionado o cualquier otro) no vuelve a tocar nada, aunque la
//  variable siga definida. Si el correo todavía no se ha registrado, sólo
//  avisa: el usuario se registra, reinicia la API (o espera al siguiente
//  despliegue) y queda promocionado.
//
//  Nunca crea usuarios ni contraseñas: sólo cambia el rol de una cuenta que ya
//  existe, y lo deja en audit_logs como cualquier otro cambio de rol.
// =============================================================================
import { prisma } from '../../database/prisma.ts';
import { loadConfiguration } from '../../config/env.ts';
import { createLogger } from '../../common/logger.ts';
import { record } from '../audit/audit.service.ts';

const logger = createLogger('bootstrap-admin');

export async function bootstrapFirstAdmin(): Promise<void> {
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
    entity: 'user',
    entityId: user.id,
    before: { globalRole: user.globalRole },
    after: { globalRole: 'GLOBAL_ADMIN', via: 'BOOTSTRAP_ADMIN_EMAIL' },
  });
  logger.info(`primer GLOBAL_ADMIN promocionado: ${user.username}`);
}
