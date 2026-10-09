// Cliente de tiempo real. Un único socket por sesión contra el namespace
// /rt de la API (socket-server.ts): el handshake lleva el access token en
// auth.token; el servidor mete al cliente en sus salas (user:<id>, presence,
// org:<id> por cada organización) y emite los eventos de dominio por su
// nombre (event-bridge.ts). Las salas de ticket y conversación se piden
// con ticket.subscribe / conversation.subscribe y el servidor re-comprueba
// el permiso antes de aceptar (ack { ok }).
import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '../../api/auth';

/** Nombres exactos que emite la API (apps/api/src/database/events.ts). */
export const RealtimeEvents = {
  connected: 'connected',
  unauthorized: 'unauthorized',
  systemStatus: 'system.status',
  presenceChanged: 'presence.changed',
  ticketCreated: 'ticket.created',
  ticketUpdated: 'ticket.updated',
  ticketDeleted: 'ticket.deleted',
  commentCreated: 'comment.created',
  commentUpdated: 'comment.updated',
  commentDeleted: 'comment.deleted',
  attachmentCreated: 'attachment.created',
  attachmentDeleted: 'attachment.deleted',
  organizationCreated: 'organization.created',
  organizationUpdated: 'organization.updated',
  organizationDeleted: 'organization.deleted',
  memberAdded: 'member.added',
  memberUpdated: 'member.updated',
  memberRemoved: 'member.removed',
  // Una reserva no crea pertenencia, así que no hay `member.added`: tiene sus
  // propios eventos. La pantalla de la organización pinta las reservas junto a
  // los miembros, y sin esto no aparecían hasta recargar a mano.
  roleReserved: 'role.reserved',
  roleReservationCancelled: 'role.reservation.cancelled',
  categoryCreated: 'category.created',
  categoryUpdated: 'category.updated',
  categoryDeleted: 'category.deleted',
  friendshipRequested: 'friendship.requested',
  friendshipAccepted: 'friendship.accepted',
  friendshipRemoved: 'friendship.removed',
  messageCreated: 'message.created',
  messageRead: 'message.read',
  notificationCreated: 'notification.created',
} as const;

export type RealtimeEvent =
  (typeof RealtimeEvents)[keyof typeof RealtimeEvents];
export type RealtimeHandler = (payload: unknown) => void;
export type RealtimeStatus =
  'disconnected' | 'connecting' | 'connected' | 'unauthorized';

let socket: Socket | null = null;
const statusListeners = new Set<(status: RealtimeStatus) => void>();
let status: RealtimeStatus = 'disconnected';

function setStatus(next: RealtimeStatus) {
  status = next;
  statusListeners.forEach((fn) => fn(next));
}

export function getRealtimeStatus() {
  return status;
}

export function onRealtimeStatus(listener: (status: RealtimeStatus) => void) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

/** Conecta (o reutiliza) el socket de la sesión actual. Idempotente. */
export function connectRealtime(): Socket {
  if (socket) return socket;
  setStatus('connecting');
  socket = io('/rt', {
    path: '/socket.io',
    // El token puede cambiar (refresh cada 15 min): se lee en cada (re)conexión.
    auth: (cb) => cb({ token: getAccessToken() ?? '' }),
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  socket.on(RealtimeEvents.connected, () => setStatus('connected'));
  socket.on(RealtimeEvents.unauthorized, () => setStatus('unauthorized'));
  socket.on('disconnect', () => {
    if (status !== 'unauthorized') setStatus('disconnected');
  });
  socket.io.on('reconnect_attempt', () => setStatus('connecting'));
  return socket;
}

export function disconnectRealtime() {
  socket?.disconnect();
  socket = null;
  setStatus('disconnected');
}

/** Escucha un evento; devuelve la función para dejar de escuchar. */
export function onRealtime(
  event: RealtimeEvent,
  handler: RealtimeHandler,
): () => void {
  const s = connectRealtime();
  s.on(event, handler);
  return () => {
    s.off(event, handler);
  };
}

async function subscribe(
  event:
    'ticket.subscribe' | 'conversation.subscribe' | 'organization.subscribe',
  body: Record<string, string>,
) {
  const s = connectRealtime();
  try {
    const res = (await s.timeout(5000).emitWithAck(event, body)) as {
      ok: boolean;
    };
    return res.ok;
  } catch {
    return false;
  }
}

export const rooms = {
  /**
   * La sala de la organización que se está mirando.
   *
   * Los miembros ya entran en las suyas al conectar, así que para ellos es una
   * confirmación sin efecto. Hace falta por el administrador de plataforma,
   * que no pertenece a ninguna organización y por eso no recibía ni un evento
   * mientras gestionaba una: ni miembros, ni categorías, ni reservas.
   */
  subscribeOrganization: (organizationId: string) =>
    subscribe('organization.subscribe', { organizationId }),
  unsubscribeOrganization: (organizationId: string): void => {
    connectRealtime().emit('organization.unsubscribe', { organizationId });
  },
  subscribeTicket: (ticketId: string) =>
    subscribe('ticket.subscribe', { ticketId }),
  unsubscribeTicket: (ticketId: string): void => {
    connectRealtime().emit('ticket.unsubscribe', { ticketId });
  },
  subscribeConversation: (conversationId: string) =>
    subscribe('conversation.subscribe', { conversationId }),
  unsubscribeConversation: (conversationId: string): void => {
    connectRealtime().emit('conversation.unsubscribe', { conversationId });
  },
};
