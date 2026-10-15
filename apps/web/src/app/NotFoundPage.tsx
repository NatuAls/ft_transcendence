import { Button } from 'ui';
import { useTranslation } from '../core/i18n';

export function NotFoundPage({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <section
      className="grid min-h-[calc(100dvh-72px)] place-content-center justify-items-center p-8 text-center"
      aria-labelledby="not-found-title"
    >
      <span className="text-[0.8125rem] font-semibold tracking-[.12em] text-primary">
        404
      </span>
      <h1
        className="mt-2.5 mb-2 text-[clamp(28px,5vw,46px)] font-medium"
        id="not-found-title"
      >
        {t('common.notFound.title')}
      </h1>
      <p className="mb-6 text-muted">{t('common.notFound.description')}</p>
      <Button onClick={onBack}>{t('common.notFound.back')}</Button>
    </section>
  );
}
