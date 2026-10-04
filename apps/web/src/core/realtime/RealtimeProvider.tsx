import { useEffect, useState, type ReactNode } from 'react';
import { RealtimeContext } from './context';
import {
  connectRealtime,
  disconnectRealtime,
  getRealtimeStatus,
  onRealtimeStatus,
  type RealtimeStatus,
} from './socket';

/** Envuelve la app autenticada: abre el socket al montar y lo cierra al salir. */
export function RealtimeProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<RealtimeStatus>(getRealtimeStatus());

  useEffect(() => {
    if (!enabled) {
      disconnectRealtime();
      return;
    }
    const off = onRealtimeStatus(setStatus);
    connectRealtime();
    return () => {
      off();
      disconnectRealtime();
    };
  }, [enabled]);

  return (
    <RealtimeContext.Provider value={{ status }}>
      {children}
    </RealtimeContext.Provider>
  );
}
