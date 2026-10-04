// Patrón único para "cargar algo de la API": estado idle/loading/success/
// error + reload. Evita que cada pantalla invente su propio useState de
// loading/error y olvide el caso de error o el de lista vacía.
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useState,
  type DependencyList,
} from 'react';

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  status: AsyncStatus;
  data: T | undefined;
  error: unknown;
  reload: () => void;
  /** Reemplaza los datos en local (por ejemplo, al recibir un evento en tiempo real). */
  setData: (updater: (previous: T | undefined) => T | undefined) => void;
}

interface Settled<T> {
  key: string;
  data?: T;
  error?: unknown;
  ok: boolean;
}

export function useAsync<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
): AsyncState<T> {
  const [tick, setTick] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | undefined>(undefined);
  // La petición se identifica por sus dependencias + el contador de recargas:
  // el estado es "loading" mientras lo último resuelto no sea esta petición.
  const key = `${JSON.stringify(deps)}#${tick}`;
  const run = useEffectEvent((signal: AbortSignal) => loader(signal));

  useEffect(() => {
    const controller = new AbortController();
    run(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setSettled({ key, data, ok: true });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setSettled({ key, error, ok: false });
      });
    return () => controller.abort();
  }, [key]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const setData = useCallback(
    (updater: (previous: T | undefined) => T | undefined) => {
      setSettled((prev) =>
        prev ? { ...prev, data: updater(prev.data) } : prev,
      );
    },
    [],
  );

  const current = settled?.key === key ? settled : undefined;
  const status: AsyncStatus = !current
    ? 'loading'
    : current.ok
      ? 'success'
      : 'error';
  return {
    status,
    data: current?.data ?? settled?.data,
    error: current?.error,
    reload,
    setData,
  };
}
