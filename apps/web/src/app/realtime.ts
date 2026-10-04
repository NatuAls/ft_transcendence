import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '../api/auth';
import { socketOrigin } from '../features/messages/messagesApi';

/**
 * One realtime connection for as long as somebody is signed in.
 *
 * Presence is kept by the server per open socket: a person is "online" while
 * at least one of their sockets is connected. The only socket used to be the
 * one the Messages screen opens, so anybody on any other screen showed as
 * offline to everybody else. This connection exists for that: it makes the
 * person present, and it lets screens follow other people's presence live.
 * (Messages keeps its own socket for the chat; two sockets count as one
 * presence on the server.)
 */
export interface PresenceChange {
  isOnline: boolean;
  lastSeenAt?: string;
  userId: string;
}

let socket: Socket | null = null;
const listeners = new Set<(change: PresenceChange) => void>();

function notify(change: PresenceChange) {
  for (const listener of listeners) listener(change);
}

export function connectRealtime(): void {
  if (socket) return;
  socket = io(`${socketOrigin() ?? window.location.origin}/rt`, {
    path: '/socket.io',
    // A function, not a value: every reconnection reads the current access
    // token, which is renewed every fifteen minutes.
    auth: (callback) => callback({ token: getAccessToken() }),
    transports: ['websocket', 'polling'],
  });
  socket.on('presence.changed', notify);
}

export function disconnectRealtime(): void {
  socket?.off('presence.changed', notify);
  socket?.disconnect();
  socket = null;
}

/** Follows other people's presence. Returns the unsubscribe function. */
export function onPresenceChange(
  listener: (change: PresenceChange) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
