import { onRealtime, RealtimeEvents } from '../core/realtime/socket';

/**
 * Presencia de otras personas, sobre el socket compartido.
 *
 * Este fichero abría su PROPIO socket. Al fusionar la infraestructura
 * transversal aparecieron dos: el de aquí y el de `core/realtime/socket.ts`,
 * que gobierna `RealtimeProvider`. Dos conexiones por persona cuentan como una
 * sola presencia en el servidor, así que no se rompía nada visible — pero son
 * el doble de sockets, dos sitios donde renovar el token y dos sitios donde
 * mirar cuando algo no llega.
 *
 * Ahora esto es sólo el adaptador tipado del evento `presence.changed`: quien
 * abre y cierra la conexión es el proveedor, una vez, mientras hay sesión.
 */
export interface PresenceChange {
  isOnline: boolean;
  lastSeenAt?: string;
  userId: string;
}

/** Sigue la presencia de otras personas. Devuelve la baja. */
export function onPresenceChange(
  listener: (change: PresenceChange) => void,
): () => void {
  return onRealtime(RealtimeEvents.presenceChanged, (payload) => {
    listener(payload as PresenceChange);
  });
}
