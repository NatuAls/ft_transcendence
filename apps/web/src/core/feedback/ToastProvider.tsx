import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Toast } from 'ui';
import { ToastContext, type ToastInput, type ToastItem } from './toast-context';

/** Un único apilado de avisos para toda la app (arriba a la derecha). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback(
    (id: number) => setItems((list) => list.filter((t) => t.id !== id)),
    [],
  );
  const show = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++;
      setItems((list) => [
        ...list,
        { ...toast, id, tone: toast.tone ?? 'info' },
      ]);
      window.setTimeout(() => dismiss(id), toast.durationMs ?? 5000);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-50 grid w-[min(24rem,calc(100vw-2rem))] gap-3"
      >
        {items.map((t) => (
          <Toast
            key={t.id}
            tone={t.tone}
            title={t.title}
            description={t.description}
            onClose={() => dismiss(t.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
