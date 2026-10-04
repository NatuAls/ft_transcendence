import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io, type Socket } from 'socket.io-client';
import {
  addMember,
  api,
  apiIsUp,
  BASE_URL,
  createOrganization,
  registerUser,
  SKIP_MESSAGE,
  type TestUser,
} from './helpers.ts';

/**
 * Amistades y presencia en vivo: lo que la pantalla «People» promete.
 *
 * Una solicitud la contesta sólo quien la recibe; aceptada, los dos se ven
 * en su lista con la presencia de cada uno; rechazada, se puede volver a
 * pedir; y quitar a alguien deshace la amistad en ambos sentidos. La
 * presencia se comprueba con un socket de verdad contra /rt: conectarse pone
 * a la persona en línea para sus amigos, que reciben `presence.changed` sin
 * recargar nada.
 */

interface Friend {
  friendshipId: string;
  user: {
    id: string;
    username: string;
    profile: { isOnline: boolean; lastSeenAt: string | null };
  };
}

interface Requests {
  incoming: Array<{ id: string; requester: { id: string } }>;
  outgoing: Array<{ id: string; addressee: { id: string } }>;
}

function connect(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(`${BASE_URL}/rt`, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token },
      reconnection: false,
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('el socket no llegó a conectarse'));
    }, 5000);
    socket.once('connected', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('unauthorized', (body: { reason: string }) => {
      clearTimeout(timer);
      socket.close();
      reject(new Error(`socket rechazado: ${body.reason}`));
    });
  });
}

/** Espera un `presence.changed` concreto o falla a los cinco segundos. */
function nextPresence(
  socket: Socket,
  userId: string,
  isOnline: boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`no llegó presence.changed de ${userId}`)),
      5000,
    );
    const listener = (body: { userId: string; isOnline: boolean }) => {
      if (body.userId !== userId || body.isOnline !== isOnline) return;
      clearTimeout(timer);
      socket.off('presence.changed', listener);
      resolve();
    };
    socket.on('presence.changed', listener);
  });
}

async function befriend(asker: TestUser, asked: TestUser): Promise<string> {
  const sent = await api<{ id: string }>('POST', '/friends/requests', {
    token: asker.token,
    body: { username: asked.username },
  });
  assert.equal(sent.status, 201);
  const accepted = await api('PATCH', `/friends/requests/${sent.body.id}`, {
    token: asked.token,
    body: { action: 'ACCEPT' },
  });
  assert.equal(accepted.status, 200);
  return sent.body.id;
}

describe('integración · amistades y presencia', { concurrency: false }, () => {
  let up = false;
  const sockets: Socket[] = [];

  before(async () => {
    up = await apiIsUp();
  });

  after(() => {
    for (const socket of sockets) socket.close();
  });

  it('la solicitud aparece en los dos lados y sólo la contesta quien la recibe', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const ana = await registerUser('frAna');
    const bea = await registerUser('frBea');
    const sent = await api<{ id: string; status: string }>(
      'POST',
      '/friends/requests',
      { token: ana.token, body: { userId: bea.id } },
    );
    assert.equal(sent.status, 201);
    assert.equal(sent.body.status, 'PENDING');

    const mine = await api<Requests>('GET', '/friends/requests', {
      token: ana.token,
    });
    assert.deepEqual(
      mine.body.outgoing.map((r) => r.addressee.id),
      [bea.id],
    );
    assert.equal(mine.body.incoming.length, 0);
    const theirs = await api<Requests>('GET', '/friends/requests', {
      token: bea.token,
    });
    assert.deepEqual(
      theirs.body.incoming.map((r) => [r.id, r.requester.id]),
      [[sent.body.id, ana.id]],
    );

    // Quien la envía no puede aceptarla por la otra persona.
    assert.equal(
      (
        await api('PATCH', `/friends/requests/${sent.body.id}`, {
          token: ana.token,
          body: { action: 'ACCEPT' },
        })
      ).status,
      404,
    );
    // Y la otra persona no puede abrir una segunda en sentido contrario.
    assert.equal(
      (
        await api('POST', '/friends/requests', {
          token: bea.token,
          body: { userId: ana.id },
        })
      ).status,
      409,
    );
  });

  it('aceptada, los dos se ven como amigos; quitarla la deshace para ambos', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const ana = await registerUser('frAna2');
    const bea = await registerUser('frBea2');
    const friendshipId = await befriend(ana, bea);

    const anaFriends = await api<Friend[]>('GET', '/friends', {
      token: ana.token,
    });
    const beaFriends = await api<Friend[]>('GET', '/friends', {
      token: bea.token,
    });
    assert.deepEqual(
      anaFriends.body.map((f) => [f.friendshipId, f.user.id]),
      [[friendshipId, bea.id]],
    );
    assert.deepEqual(
      beaFriends.body.map((f) => f.user.id),
      [ana.id],
    );
    assert.equal(
      (await api<Requests>('GET', '/friends/requests', { token: bea.token }))
        .body.incoming.length,
      0,
      'una solicitud aceptada deja de estar pendiente',
    );

    assert.equal(
      (await api('DELETE', `/friends/${ana.id}`, { token: bea.token })).status,
      204,
    );
    for (const user of [ana, bea])
      assert.deepEqual(
        (await api<Friend[]>('GET', '/friends', { token: user.token })).body,
        [],
      );
  });

  it('rechazada, se puede volver a pedir; y retirar una pendiente la borra', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const ana = await registerUser('frAna3');
    const bea = await registerUser('frBea3');
    const first = await api<{ id: string }>('POST', '/friends/requests', {
      token: ana.token,
      body: { username: bea.username },
    });
    const declined = await api<{ status: string }>(
      'PATCH',
      `/friends/requests/${first.body.id}`,
      { token: bea.token, body: { action: 'DECLINE' } },
    );
    assert.equal(declined.body.status, 'DECLINED');
    assert.deepEqual(
      (await api<Friend[]>('GET', '/friends', { token: ana.token })).body,
      [],
    );

    const again = await api('POST', '/friends/requests', {
      token: ana.token,
      body: { username: bea.username },
    });
    assert.equal(again.status, 201, 'tras un rechazo se puede insistir');

    // Retirar la pendiente: el mismo DELETE que quita a un amigo.
    assert.equal(
      (await api('DELETE', `/friends/${bea.id}`, { token: ana.token })).status,
      204,
    );
    assert.equal(
      (await api<Requests>('GET', '/friends/requests', { token: bea.token }))
        .body.incoming.length,
      0,
    );
  });

  it('nadie se pide amistad a sí mismo ni a quien no existe', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const ana = await registerUser('frSelf');
    assert.equal(
      (
        await api('POST', '/friends/requests', {
          token: ana.token,
          body: { userId: ana.id },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api('POST', '/friends/requests', {
          token: ana.token,
          body: {},
        })
      ).status,
      400,
      'hace falta userId o username',
    );
    assert.equal(
      (
        await api('POST', '/friends/requests', {
          token: ana.token,
          body: { userId: '01a106fe-9dff-72f9-88a4-36321c6f0cbd' },
        })
      ).status,
      404,
    );
  });

  it('conectarse pone a la persona en línea para sus amigos, en vivo', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const ana = await registerUser('frLiveA');
    const bea = await registerUser('frLiveB');
    await befriend(ana, bea);

    const before = await api<Friend[]>('GET', '/friends', { token: ana.token });
    assert.equal(before.body[0]!.user.profile.isOnline, false);

    const anaSocket = await connect(ana.token);
    sockets.push(anaSocket);
    const announced = nextPresence(anaSocket, bea.id, true);
    const beaSocket = await connect(bea.token);
    sockets.push(beaSocket);
    await announced;

    const after = await api<Friend[]>('GET', '/friends', { token: ana.token });
    assert.equal(after.body[0]!.user.profile.isOnline, true);
    assert.ok(after.body[0]!.user.profile.lastSeenAt);

    // Recargar la pestaña no la desconecta: hay un margen antes de marcarla
    // fuera de línea, así que el punto verde no parpadea.
    beaSocket.close();
    await new Promise((resolve) => setTimeout(resolve, 300));
    const reloaded = await api<Friend[]>('GET', '/friends', {
      token: ana.token,
    });
    assert.equal(reloaded.body[0]!.user.profile.isOnline, true);
  });

  it('un socket sin sesión válida no entra', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    await assert.rejects(connect('not-a-token'), /socket rechazado/);
  });

  it('el perfil público enseña organizaciones y actividad, nunca el correo', async (t) => {
    if (!up) return t.skip(SKIP_MESSAGE);
    const owner = await registerUser('frProfOwner');
    const viewer = await registerUser('frProfView');
    const organizationId = await createOrganization(owner.token);
    await addMember(owner.token, organizationId, viewer.username, 'AGENT');

    const profile = await api<{
      username: string;
      displayName: string;
      avatarUrl: string | null;
      organizations: Array<{ id: string; role: string }>;
      stats: Record<string, number>;
    }>('GET', `/users/${owner.username}`, { token: viewer.token });
    assert.equal(profile.status, 200);
    assert.equal(profile.body.username, owner.username.toLowerCase());
    assert.equal(profile.body.avatarUrl, null, 'sin foto: avatar por defecto');
    assert.deepEqual(
      profile.body.organizations.map((o) => [o.id, o.role]),
      [[organizationId, 'ORG_ADMIN']],
    );
    assert.deepEqual(Object.keys(profile.body.stats).sort(), [
      'comments',
      'ticketsAssigned',
      'ticketsCreated',
    ]);
    assert.ok(
      !profile.text.includes(owner.email),
      'el correo no sale en el perfil público',
    );
  });
});
