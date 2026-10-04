import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState, ErrorState, Skeleton } from 'ui';
import { errorKey } from '../api/errors';
import type { AsyncStatus } from './useAsync';

interface AsyncStateProps {
  status: AsyncStatus;
  error?: unknown;
  /** true cuando la carga fue bien pero no hay nada que mostrar. */
  isEmpty?: boolean;
  emptyTitle?: string;
  onRetry?: () => void;
  /** Qué pintar mientras carga (por defecto, tres líneas de esqueleto). */
  loading?: ReactNode;
  children: ReactNode;
}

/** Envuelve el contenido de una pantalla y decide qué se ve según el estado. */
export function AsyncState({
  status,
  error,
  isEmpty,
  emptyTitle,
  onRetry,
  loading,
  children,
}: AsyncStateProps) {
  const { t } = useTranslation();
  if (status === 'idle' || status === 'loading') {
    return <>{loading ?? <Skeleton lines={3} />}</>;
  }
  if (status === 'error') {
    return (
      <ErrorState
        title={t('common.state.error')}
        description={t(errorKey(error))}
        actionLabel={t('common.actions.retry')}
        onAction={onRetry}
      />
    );
  }
  if (isEmpty) {
    return <EmptyState title={emptyTitle ?? t('common.state.empty')} />;
  }
  return <>{children}</>;
}
