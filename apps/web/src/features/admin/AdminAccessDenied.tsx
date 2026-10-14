import { Button } from 'ui';
import { useTranslation } from '../../core/i18n';

export function AdminAccessDenied({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <main className="mx-auto grid min-h-dvh w-[min(620px,calc(100%_-_32px))] content-center justify-items-start gap-[14px]">
      <span className="text-2xs tracking-[.08em] text-muted">
        {t('admin.eyebrow')}
      </span>
      <h1 className="text-3xl font-medium">{t('admin.accessDenied.title')}</h1>
      <p className="max-w-[560px] leading-[1.6] text-muted">
        {t('admin.accessDenied.description')}
      </p>
      <Button onClick={onBack}>{t('admin.accessDenied.back')}</Button>
    </main>
  );
}
