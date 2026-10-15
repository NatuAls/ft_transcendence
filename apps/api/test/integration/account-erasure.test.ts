import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  api,
  apiIsUp,
  BASE_URL,
  createOrganization,
  createTicket,
  eventually,
  multipart,
  PASSWORD,
  PNG_1X1,
  registerUser,
  SKIP_MESSAGE,
  type TestUser,
} from './helpers.ts';
import {
  artifactOf,
  auditEntryExists,
  backdateClosure,
  closeDb,
  dbAvailable,
  DB_SKIP_MESSAGE,
  erasedAtOf,
  finishedExport,
  oldAuditEntry,
  pendingGdprRequest,
  promoteToGlobalAdmin,
} from './db.ts';

/**
 * El borrado de una cuenta, por los tres caminos.
 *
 *   · La persona borra la suya: datos fuera al momento, tras confirmar con el
 *     código del correo y su nombre de usuario.
 *   · Un administrador la cierra: deja de entrar al momento y sus datos se
 *     borran a los 30 días; hasta entonces se puede restaurar, o borrar ya si
 *     la persona lo pide.
 *   · La tarea horaria, cuando se cumplen esos 30 días.
 *
 * Antes, el cierre del administrador no borraba nada, nunca, y la persona,
 * que ya no podía entrar, no tenía cómo pedirlo. Y el autoborrado dejaba en
 * disco la foto —servida a quien guardara su dirección— y los ZIP de
 * exportación, con todos los datos dentro.
 */

interface Row {
  id: string;
  deletedAt: string | null;
  erasureDueAt: string | null;
}
interface Page {
  data: Row[];
}
interface Comment {
  body: string;
  author: { id: string; username: string } | null;
}

const DAY_MS = 86_400_000;

describe('integración · borrado de cuentas', { concurrency: false }, () => {
  let ready = false;
  let admin: TestUser;

  before(async () => {
    ready = (await apiIsUp()) && dbAvailable();
    if (!ready) return;
    admin = await registerUser('erAdmin');
    await promoteToGlobalAdmin(admin.id);
  });

  // La tarea de mantenimiento se importa sólo si hace falta: abre su propia
  // conexión a la base, que hay que cerrar para que el proceso termine.
  let maintenance: typeof import('../../src/modules/tickets/maintenance.ts');
  async function jobs() {
    maintenance ??= await import('../../src/modules/tickets/maintenance.ts');
    return maintenance;
  }

  after(async () => {
    await closeDb();
    if (maintenance) {
      const { disconnectDatabase } =
        await import('../../src/database/prisma.ts');
      await disconnectDatabase();
    }
  });

  const skip = (t: { skip: (message: string) => void }) =>
    t.skip(dbAvailable() ? SKIP_MESSAGE : DB_SKIP_MESSAGE);

  const close = (user: TestUser) =>
    api('DELETE', `/users/${user.id}`, { token: admin.token });

  const listed = async (user: TestUser, includeClosed: boolean) =>
    (
      await api<Page>(
        'GET',
        `/users?q=${user.username}${includeClosed ? '&includeClosed=true' : ''}`,
        { token: admin.token },
      )
    ).body.data.find((row) => row.id === user.id);

  const signIn = (user: TestUser) =>
    api('POST', '/auth/login', {
      body: { email: user.email, password: PASSWORD },
    });

  const registerAgain = (user: TestUser) =>
    api('POST', '/auth/register', {
      body: {
        email: user.email,
        username: `${user.username.slice(0, 20)}x2`,
        password: PASSWORD,
        confirmPassword: PASSWORD,
        firstName: 'Back',
        lastName: 'Again',
        acceptTerms: true,
        locale: 'EN',
      },
    });

  const auditActions = async (userId: string) => {
    type Entries = {
      data: Array<{ action: string; actor: { id: string } | null }>;
    };
    return (
      await api<Entries>('GET', `/admin/audit-logs?entityId=${userId}`, {
        token: admin.token,
      })
    ).body.data;
  };

  it('cerrar: deja de entrar al momento, y sus datos esperan 30 días', async (t) => {
    if (!ready) return skip(t);
    const person = await registerUser('erClosed');
    assert.equal((await close(person)).status, 204);

    assert.equal((await signIn(person)).status, 401, 'ya no entra');
    assert.equal(
      await listed(person, false),
      undefined,
      'sale de las listas de siempre',
    );
    const row = await listed(person, true);
    assert.ok(row, 'la pantalla de usuarios la ve si la pide');
    assert.equal(
      new Date(row.erasureDueAt!).getTime() -
        new Date(row.deletedAt!).getTime(),
      30 * DAY_MS,
      'se borra 30 días después del cierre',
    );
    // Mientras espera, su dirección sigue siendo suya.
    assert.equal((await registerAgain(person)).status, 409);
    assert.equal(await erasedAtOf(person.id), null);
  });

  it('restaurar devuelve la cuenta como estaba; dos veces, no', async (t) => {
    if (!ready) return skip(t);
    const person = await registerUser('erRestore');
    await close(person);

    const restored = await api<{ isActive: boolean }>(
      'POST',
      `/users/${person.id}/restore`,
      { token: admin.token },
    );
    assert.equal(restored.status, 200);
    assert.equal(restored.body.isActive, true);
    assert.equal((await signIn(person)).status, 200, 'vuelve a entrar');
    assert.ok(await listed(person, false), 'vuelve a las listas');

    const again = await api<{ code: string }>(
      'POST',
      `/users/${person.id}/restore`,
      { token: admin.token },
    );
    assert.equal(again.status, 409);
    assert.equal(again.body.code, 'USER_NOT_CLOSED');
    const actions = await eventually(
      () => auditActions(person.id),
      (entries) => entries.some((entry) => entry.action === 'user.restored'),
    );
    assert.ok(actions.some((entry) => entry.action === 'user.restored'));
  });

  it('borrar ya: se van sus datos, su foto y sus claves; quedan sus comentarios, sin nombre', async (t) => {
    if (!ready) return skip(t);
    const person = await registerUser('erNow');
    // Una foto, una organización, un ticket con un comentario y una clave.
    const form = multipart('me.png', 'image/png', PNG_1X1);
    const avatar = await api<{ avatarUrl: string }>('PUT', '/users/me/avatar', {
      token: person.token,
      headers: form.headers,
      raw: form.raw,
    });
    assert.equal(avatar.status, 200);
    const organization = await createOrganization(person.token);
    const ticket = await createTicket(person.token, organization);
    assert.equal(
      (
        await api('POST', `/tickets/${ticket.id}/comments`, {
          token: person.token,
          body: { body: 'Sigue fallando al guardar.' },
        })
      ).status,
      201,
    );
    const key = await api<{ id: string }>(
      'POST',
      `/organizations/${organization}/api-keys`,
      {
        token: person.token,
        body: { name: 'Integración', scopes: ['tickets:read'] },
      },
    );
    assert.equal(key.status, 201);

    // Borrar ya una cuenta que nadie ha cerrado: no, primero se cierra.
    const early = await api<{ code: string }>(
      'POST',
      `/users/${person.id}/erase`,
      { token: admin.token },
    );
    assert.equal(early.status, 409);
    assert.equal(early.body.code, 'USER_NOT_CLOSED');

    await close(person);
    assert.equal(
      (
        await api('POST', `/users/${person.id}/erase`, {
          token: admin.token,
        })
      ).status,
      204,
    );

    assert.ok(await erasedAtOf(person.id), 'consta como borrada');
    const photo = await fetch(`${BASE_URL}${avatar.body.avatarUrl}`);
    assert.equal(photo.status, 404, 'la foto ya no se sirve a nadie');
    const comments = await api<Comment[]>(
      'GET',
      `/tickets/${ticket.id}/comments`,
      { token: admin.token },
    );
    const kept = comments.body.find((c) => c.author?.id === person.id);
    assert.equal(
      kept?.body,
      'Sigue fallando al guardar.',
      'el comentario se queda',
    );
    assert.match(kept!.author!.username, /^deleted_/, 'sin su nombre');
    const keys = await api<Array<{ id: string; revokedAt: string | null }>>(
      'GET',
      `/organizations/${organization}/api-keys`,
      { token: admin.token },
    );
    assert.ok(
      keys.body.find((row) => row.id === key.body.id)?.revokedAt,
      'su clave queda revocada, no «activa» sin funcionar',
    );
    assert.equal(await listed(person, true), undefined, 'ya no es de nadie');
    assert.equal(
      (await registerAgain(person)).status,
      201,
      'su dirección vuelve a estar libre',
    );
    const again = await api('POST', `/users/${person.id}/restore`, {
      token: admin.token,
    });
    assert.equal(again.status, 409, 'lo borrado no se restaura');
    const actions = await eventually(
      () => auditActions(person.id),
      (entries) => entries.some((entry) => entry.action === 'user.erased'),
    );
    assert.equal(
      actions.find((entry) => entry.action === 'user.erased')?.actor?.id,
      admin.id,
    );
  });

  it('dos cuentas creadas en el mismo minuto se borran las dos', async (t) => {
    if (!ready) return skip(t);
    // Los ids son UUIDv7: los creados casi a la vez empiezan igual. El nombre
    // anónimo salía de ese principio y la segunda cuenta chocaba con la
    // primera — un 409 que dejaba sus datos sin borrar.
    // (Casi siempre: si el registro cae justo en el cambio de minuto, no
    // empiezan igual y la prueba no lo ejercita, pero tampoco falla.)
    const first = await registerUser('erTwinA');
    const second = await registerUser('erTwinB');
    for (const person of [first, second]) {
      await close(person);
      assert.equal(
        (
          await api('POST', `/users/${person.id}/erase`, {
            token: admin.token,
          })
        ).status,
        204,
        person.username,
      );
      assert.ok(await erasedAtOf(person.id));
    }
  });

  it('la tarea horaria borra a los 30 días, y ni un día antes', async (t) => {
    if (!ready) return skip(t);
    const due = await registerUser('erDue');
    const waiting = await registerUser('erWaiting');
    await close(due);
    await close(waiting);
    await backdateClosure(due.id, 31);
    await backdateClosure(waiting.id, 29);

    const { eraseClosedAccounts } = await jobs();
    assert.ok((await eraseClosedAccounts()) >= 1);

    assert.ok(await erasedAtOf(due.id), 'la de hace 31 días, borrada');
    assert.equal(
      await erasedAtOf(waiting.id),
      null,
      'la de hace 29, esperando',
    );
    assert.equal((await registerAgain(due)).status, 201);
    // Lo hizo el sistema, no una persona.
    const entries = await auditActions(due.id);
    const erased = entries.find((entry) => entry.action === 'user.erased');
    assert.ok(erased);
    assert.equal(erased.actor, null);
  });

  it('el autoborrado es inmediato y se lleva también sus exportaciones del disco', async (t) => {
    if (!ready) return skip(t);
    const uploads = process.env['UPLOAD_DIR'];
    if (!uploads) return t.skip('UPLOAD_DIR no está definida en este entorno');
    const person = await registerUser('erSelf');
    // Un ZIP de exportación todavía descargable, en el disco de la API.
    const archive = `test-${person.id}.zip`;
    await mkdir(join(uploads, 'gdpr'), { recursive: true });
    await writeFile(join(uploads, 'gdpr', archive), 'contenido');
    const exportId = await finishedExport(person.id, archive, false);

    const token = await pendingGdprRequest(person.id, 'DELETE');
    const confirmed = await api<{ status: string }>(
      'POST',
      '/gdpr/delete/confirm',
      {
        token: person.token,
        body: { token, confirmUsername: person.username },
      },
    );
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.status, 'COMPLETED');

    assert.ok(await erasedAtOf(person.id), 'borrada al momento');
    assert.equal(existsSync(join(uploads, 'gdpr', archive)), false);
    assert.equal(await artifactOf(exportId), null);
    assert.equal((await signIn(person)).status, 401);
    assert.equal((await registerAgain(person)).status, 201);
  });

  it('cada día: fuera los ZIP caducados y la auditoría de más de un año', async (t) => {
    if (!ready) return skip(t);
    const uploads = process.env['UPLOAD_DIR'];
    if (!uploads) return t.skip('UPLOAD_DIR no está definida en este entorno');
    const person = await registerUser('erPrune');
    const stale = `stale-${person.id}.zip`;
    const fresh = `fresh-${person.id}.zip`;
    await mkdir(join(uploads, 'gdpr'), { recursive: true });
    await writeFile(join(uploads, 'gdpr', stale), 'caducado');
    await writeFile(join(uploads, 'gdpr', fresh), 'vigente');
    const staleId = await finishedExport(person.id, stale, true);
    const freshId = await finishedExport(person.id, fresh, false);
    const old = await oldAuditEntry(400);
    const recent = await oldAuditEntry(300);

    const { pruneExpired } = await jobs();
    await pruneExpired();

    assert.equal(existsSync(join(uploads, 'gdpr', stale)), false);
    assert.equal(await artifactOf(staleId), null);
    assert.equal(existsSync(join(uploads, 'gdpr', fresh)), true);
    assert.equal(await artifactOf(freshId), fresh);
    assert.equal(await auditEntryExists(old), false, 'más de un año: fuera');
    assert.equal(
      await auditEntryExists(recent),
      true,
      'menos de un año: se queda',
    );
  });
});
