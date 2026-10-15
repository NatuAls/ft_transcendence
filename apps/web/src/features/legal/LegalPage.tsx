import { BrandMark } from 'ui';
import { useEffect } from 'react';
import { useTranslation } from '../../core/i18n';
export function LegalPage({
  kind,
  onBack,
  onNavigate,
  onSignIn,
  signedIn = false,
}: {
  kind: 'privacy' | 'terms';
  onBack: () => void;
  onNavigate: (k: 'privacy' | 'terms') => void;
  onSignIn: () => void;
  /** Opened from inside the application: offer the way back, not a sign-in. */
  signedIn?: boolean;
}) {
  const { t } = useTranslation();
  const page = t(`legalPages.${kind}`, { returnObjects: true }) as {
    label: string;
    intro: string;
    sections: { title: string; copy: string | string[] }[];
  };
  const lastUpdated = t('legalPages.lastUpdated');

  // Opened from the footer of a long screen, the page would otherwise keep
  // that scroll position and start halfway down: hash navigation does not
  // reset it.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [kind]);
  return (
    <div className="min-h-dvh bg-surface">
      <header className="flex h-[72px] items-center justify-between border-b border-border px-[6vw] max-md:px-4">
        <div className="flex items-center gap-2.5">
          <BrandMark className="!size-9" />
          <strong>HelpDesk Lite</strong>
        </div>
        <nav className="flex gap-2.5 [&_button]:border-0 [&_button]:bg-transparent [&_button]:p-2.5 [&_button]:text-primary max-md:[&_button:not(:last-child)]:hidden">
          <button onClick={() => onNavigate('privacy')} type="button">
            {t('auth.common.privacy')}
          </button>
          <button onClick={() => onNavigate('terms')} type="button">
            {t('auth.common.terms')}
          </button>
          <button onClick={onSignIn} type="button">
            {signedIn ? t('legalPages.openApp') : t('legalPages.signIn')}
          </button>
        </nav>
      </header>
      <div className="mx-auto grid max-w-[1100px] grid-cols-[240px_1fr] gap-[70px] px-[30px] py-12 max-md:block max-md:px-5 max-md:py-7">
        <aside className="grid content-start gap-[13px]">
          <button
            className="border-0 bg-transparent p-2.5 text-left text-primary"
            onClick={onBack}
            type="button"
          >
            ← {t('legalPages.back')}
          </button>
          <span className="mt-6 text-3xs tracking-[.08em] text-muted max-md:hidden">
            {t('legalPages.onThisPage')}
          </span>
          {page.sections.map(({ title }) => (
            <button
              key={title}
              className="p-0 text-left text-xs2 text-muted max-md:hidden"
              onClick={() =>
                document
                  .getElementById(`legal-${title.replaceAll(' ', '-')}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              type="button"
            >
              {title}
            </button>
          ))}
        </aside>
        <main className="max-w-[720px]">
          <span className="mt-6 text-3xs tracking-[.08em] text-muted">
            {t('legalPages.meta', { date: lastUpdated.toUpperCase() })}
          </span>
          <h1 className="my-3 text-4xl font-medium max-md:text-[1.75rem]">
            {page.label}
          </h1>
          <p className="text-[0.9375rem] leading-[1.7] text-muted">
            {page.intro}
          </p>
          {page.sections.map(({ title, copy }, i) => (
            <section
              className="mt-9 scroll-mt-6 max-md:mt-[26px]"
              id={`legal-${title.replaceAll(' ', '-')}`}
              key={title}
            >
              <h2 className="text-lg font-medium">
                {i + 1}. {title}
              </h2>
              {typeof copy === 'string' ? (
                <p className="text-[0.8125rem] leading-[1.8] text-muted">
                  {copy}
                </p>
              ) : (
                <ul className="text-[0.8125rem] leading-[1.8] text-muted">
                  {copy.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
