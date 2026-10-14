// Refrescar cada cierto tiempo (R14), para datos agregados que no tienen
// evento en tiempo real: estadísticas, auditoría. Sólo con la pestaña a la
// vista —una pestaña oculta no lo va a leer— y nunca por debajo de 30 s,
// porque la API limita las peticiones (429).
import { useEffect, useEffectEvent } from 'react';

const MINIMUM_MS = 30_000;

export function useVisibleInterval(
  refresh: () => void,
  everyMs = 60_000,
  enabled = true,
) {
  const run = useEffectEvent(refresh);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(
      () => {
        if (document.visibilityState === 'visible') run();
      },
      Math.max(everyMs, MINIMUM_MS),
    );
    return () => window.clearInterval(id);
  }, [enabled, everyMs]);
}
