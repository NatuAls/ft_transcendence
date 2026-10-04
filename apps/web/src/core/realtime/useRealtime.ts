import { useContext, useEffect, useEffectEvent } from 'react';
import { RealtimeContext } from './context';
import {
  onRealtime,
  rooms,
  type RealtimeEvent,
  type RealtimeHandler,
} from './socket';

export function useRealtime() {
  return useContext(RealtimeContext);
}

/** Escucha un evento mientras el componente esté montado (el handler siempre es el último). */
export function useRealtimeEvent(
  event: RealtimeEvent,
  handler: RealtimeHandler,
) {
  const onEvent = useEffectEvent(handler);
  useEffect(() => onRealtime(event, (payload) => onEvent(payload)), [event]);
}

/** Se suscribe a la sala de un ticket mientras la pantalla de detalle esté abierta. */
export function useTicketRoom(ticketId: string | undefined) {
  useEffect(() => {
    if (!ticketId) return;
    void rooms.subscribeTicket(ticketId);
    return () => {
      rooms.unsubscribeTicket(ticketId);
    };
  }, [ticketId]);
}

export function useConversationRoom(conversationId: string | undefined) {
  useEffect(() => {
    if (!conversationId) return;
    void rooms.subscribeConversation(conversationId);
    return () => {
      rooms.unsubscribeConversation(conversationId);
    };
  }, [conversationId]);
}
