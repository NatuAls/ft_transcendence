import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../api/errors';
import { ToastContext } from './toast-context';

export function useToast() {
  const ctx = useContext(ToastContext);
  const { t } = useTranslation();
  return {
    ...ctx,
    /** Aviso de error a partir de cualquier excepción (API, red, desconocida). */
    error: (error: unknown) =>
      ctx.show({
        tone: 'danger',
        title: t('common.state.error'),
        description: t(errorKey(error)),
      }),
    success: (title: string) => ctx.show({ tone: 'success', title }),
  };
}
