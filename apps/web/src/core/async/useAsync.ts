// =============================================================================
//  Patrón único para «cargar algo de la API».
//
//  Sin esto, cada pantalla se escribe su propio `useState(loading)` +
//  `useState(error)` + un efecto con su bandera `active`, y en el camino se
//  olvida alguno de los cuatro estados — casi siempre el de lista vacía, y a
//  veces el de error, que se queda en una pantalla en blanco.
//
//  La petición se identifica por sus dependencias más un contador de
//  recargas: mientras lo último que ha resuelto no sea ESTA petición, el
//  estado es «cargando». Así una recarga no enseña datos viejos como si
//  fueran nuevos, y una respuesta que llega tarde no pisa a la actual.
// =============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';

export type AsyncStatus = 'loading' | 'error' | 'success';

export interface AsyncState<T> {
  status: AsyncStatus;
  data: T | undefined;
  error: unknown;
  /** Vuelve a pedirlo. Aborta la petición anterior si seguía en vuelo. */
  reload: () => void;
  /** Cambia los datos en local, sin ida y vuelta (tras crear o borrar algo). */
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
  const key = `${JSON.stringify(deps)}#${tick}`;

  // El cargador se guarda en una referencia: cambia de identidad en cada
  // render (es una función anónima dentro de la pantalla) y no debe disparar
  // el efecto, que sólo depende de `key`. La referencia se actualiza en un
  // efecto propio y no durante el render, que el compilador de React no
  // permite; va declarado ANTES que el de la carga, y los efectos corren en
  // ese orden, así que el segundo siempre ve el cargador de este render.
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    const controller = new AbortController();
    loaderRef
      .current(controller.signal)
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
      setSettled((previous) =>
        previous ? { ...previous, data: updater(previous.data) } : previous,
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
    // Durante una recarga se conservan los datos anteriores: evita que la
    // pantalla parpadee a vacío cada vez que se refresca una lista.
    data: current?.data ?? settled?.data,
    error: current?.error,
    reload,
    setData,
  };
}
