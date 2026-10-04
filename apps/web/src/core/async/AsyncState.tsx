import type { ReactNode } from 'react';
import { EmptyState, ErrorState, Skeleton } from 'ui';
import { errorMessage } from '../api/errors';
import type { AsyncStatus } from './useAsync';

export interface AsyncStateProps {
  children: ReactNode;
  /** Mensaje del estado vacío. Si no se pasa, no se trata el caso. */
  emptyDescription?: string;
  emptyTitle?: string;
  error?: unknown;
  errorTitle?: string;
  /** true cuando la carga fue bien pero no hay nada que enseñar. */
  isEmpty?: boolean;
  /** Qué pintar mientras carga. Por defecto, tres líneas de esqueleto. */
  loading?: ReactNode;
  onRetry?: () => void;
  status: AsyncStatus;
}

/**
 * Decide qué se ve según el estado de la carga, y se asegura de que los
 * cuatro casos existan en todas las pantallas: cargando, error con reintento,
 * vacío con explicación, y el contenido.
 *
 * Es el componente que hace que «cargando» se vea igual en toda la
 * aplicación, que un fallo nunca deje una pantalla en blanco y que una lista
 * vacía diga por qué lo está.
 */
export function AsyncState({
  children,
  emptyDescription,
  emptyTitle,
  error,
  errorTitle = 'This could not be loaded',
  isEmpty,
  loading,
  onRetry,
  status,
}: AsyncStateProps) {
  if (status === 'loading') return <>{loading ?? <Skeleton lines={3} />}</>;

  if (status === 'error') {
    return (
      <ErrorState
        description={errorMessage(error)}
        onAction={onRetry}
        title={errorTitle}
      />
    );
  }

  if (isEmpty && emptyTitle) {
    return (
      <EmptyState description={emptyDescription ?? ''} title={emptyTitle} />
    );
  }

  return <>{children}</>;
}
