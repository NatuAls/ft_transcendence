import { buildHash, type AppRoute } from '../app/routes';
import { useTranslation } from '../core/i18n';

const linkClass =
  'rounded-sm text-primary underline-offset-2 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus';

/**
 * Privacy Policy, Terms of Service and service status as plain links: they
 * are navigation, they open in a new tab with the usual gesture and a screen
 * reader announces them as what they are. `from` is where the legal page's
 * "back" returns to.
 */
export function LegalLinks({
  className = '',
  from,
}: {
  className?: string;
  from?: AppRoute;
}) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('common.legalNavigation')} className={className}>
      <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2">
        <li>
          <a className={linkClass} href={buildHash('privacy-policy', { from })}>
            {t('auth.common.privacy')}
          </a>
        </li>
        <li>
          <a className={linkClass} href={buildHash('terms', { from })}>
            {t('auth.common.terms')}
          </a>
        </li>
        <li>
          <a className={linkClass} href="/status">
            {t('common.serviceStatus')}
          </a>
        </li>
      </ul>
    </nav>
  );
}

/**
 * Footer of the application shell, on every screen once signed in.
 *
 * The legal pages existed with real content, but after signing in nothing led
 * to them: the shell had no footer, and the only links were on the sign-in and
 * sign-up pages. The subject requires both pages to be "easily accessible from
 * the application (e.g., footer links)", and failing it rejects the project.
 */
export function AppFooter({ from }: { from: AppRoute }) {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-border bg-surface px-10 py-4 text-xs text-muted max-[1100px]:px-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 max-sm:justify-center">
        <span>{t('common.academicProject')}</span>
        <LegalLinks from={from} />
      </div>
    </footer>
  );
}
