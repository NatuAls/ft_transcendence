import { useState } from 'react';
import { loginSchema } from 'contracts';
import { Alert, Button, Checkbox, TextField } from 'ui';
import { AuthBrandPanel, BrandHeader } from './AuthBrand';
import { login, type AuthResponse } from '../../api/auth';
import { LanguageSwitcher } from '../../core/i18n/LanguageSwitcher';
import { errorKey } from '../../core/api/errors';
import { useTranslation } from '../../core/i18n';

export interface SignInValues {
  email: string;
  password: string;
  keepSignedIn: boolean;
}

interface SignInPageProps {
  onCreateAccount: () => void;
  onOpenPreview?: () => void;
  onSubmit: (user: AuthResponse['user']) => void | Promise<void>;
}

export function SignInPage({
  onCreateAccount,
  onOpenPreview,
  onSubmit,
}: SignInPageProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    setter: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setter(event.target.value);
      if (error) setError(null);
    };
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(t('errors.common.validationFailed'));
      return;
    }

    setIsSubmitting(true);

    try {
      const authData = await login(parsed.data);

      // Si fue exitoso, pasamos el usuario al router/padre
      void onSubmit(authData.user);
    } catch (err: unknown) {
      setError(t(errorKey(err)));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-ink min-[1100px]:grid min-[1100px]:grid-cols-[580px_minmax(0,1fr)]">
      <AuthBrandPanel
        title={
          <>
            {t('auth.signIn.brandLine1')}
            <br />
            {t('auth.signIn.brandLine2')}
          </>
        }
        description={t('auth.signIn.brandDescription')}
        insight={
          <section
            className="mt-36 max-w-[452px] rounded-lg bg-[#244148] p-6"
            aria-labelledby="benefits-heading"
          >
            <h2
              className="mb-[21px] text-xs2 font-medium text-[#bfd8cf] uppercase"
              id="benefits-heading"
            >
              {t('auth.signIn.benefitsTitle')}
            </h2>
            <ul className="grid list-none gap-[15px] p-0 text-[0.8125rem] text-[#f7faf8] [&_li]:flex [&_li]:items-center [&_li]:gap-3 [&_li]:before:grid [&_li]:before:size-5 [&_li]:before:shrink-0 [&_li]:before:place-items-center [&_li]:before:rounded-full [&_li]:before:bg-[#86afa4] [&_li]:before:text-xs2 [&_li]:before:font-medium [&_li]:before:text-[#183039] [&_li]:before:content-['✓']">
              <li>{t('auth.signIn.benefitOwnership')}</li>
              <li>{t('auth.signIn.benefitContext')}</li>
              <li>{t('auth.signIn.benefitRecord')}</li>
            </ul>
          </section>
        }
      />

      <section className="flex min-h-screen min-w-0 flex-col px-4 pt-6 pb-10 md:items-center md:justify-center md:p-12">
        <div className="md:hidden">
          <BrandHeader />
        </div>
        <div className="mt-4 flex justify-end md:absolute md:top-6 md:right-6 md:mt-0">
          <LanguageSwitcher />
        </div>

        <header className="mx-2 mt-[55px] mb-[18px] md:hidden">
          <h1 className="text-[1.75rem] leading-[1.2] font-medium">
            {t('auth.signIn.welcomeBack')}
          </h1>
          <p className="mt-2.5 text-[0.8125rem] leading-[1.45] text-muted">
            {t('auth.signIn.mobileDescription')}
          </p>
        </header>

        <section
          className="auth-card-enter w-full rounded-lg border border-border bg-surface px-[23px] pt-[37px] pb-[72px] md:max-w-[520px] md:px-[51px] md:pt-[46px] md:pb-[118px]"
          aria-labelledby="sign-in-heading"
        >
          <header className="mb-8 hidden md:block">
            <p className="mb-[17px] text-xs2 font-medium tracking-[.01em] text-primary uppercase">
              {t('auth.signIn.welcomeBack')}
            </p>
            <h1
              className="text-[1.75rem] leading-[1.2] font-medium"
              id="sign-in-heading"
            >
              {t('auth.signIn.title')}
            </h1>
            <p className="mt-2.5 text-[0.8125rem] leading-[1.45] text-muted">
              {t('auth.signIn.description')}
            </p>
          </header>

          <form className="grid gap-7 md:gap-5" onSubmit={handleSubmit}>
            <TextField
              label={t('auth.signIn.email')}
              name="email"
              type="email"
              autoComplete="email"
              placeholder={t('auth.signIn.emailPlaceholder')}
              value={email}
              onChange={handleChange(setEmail)}
              required
            />
            <div>
              <div className="relative">
                <TextField
                  label={t('auth.signIn.password')}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder={t('auth.signIn.passwordPlaceholder')}
                  value={password}
                  onChange={handleChange(setPassword)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 bottom-0 flex h-12 items-center border-0 bg-transparent px-1 text-xs2 font-medium text-muted hover:text-primary hover:underline md:h-[52px] md:text-xs"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1} // Evita que el usuario caiga aquí accidentalmente al usar la tecla Tab
                >
                  {showPassword ? t('auth.common.hide') : t('auth.common.show')}
                </button>
              </div>
            </div>
            {/* La API tenía /auth/forgot-password desde el principio y esta
                pantalla no lo enlazaba: quien olvidaba la contraseña no tenía
                por dónde empezar. */}
            <div className="-mt-1 flex justify-end text-xs2 md:text-xs">
              <a
                className="font-medium text-primary no-underline hover:underline"
                href="#forgot-password"
              >
                {t('auth.signIn.forgotPassword')}
              </a>
            </div>
            <Checkbox
              className="md:my-2"
              label={
                <>
                  <span className="hidden md:inline">
                    {t('auth.signIn.keepSignedIn')}
                  </span>
                  <span className="md:hidden">
                    {t('auth.signIn.keepSignedInShort')}
                  </span>
                </>
              }
              checked={keepSignedIn}
              onChange={(event) => setKeepSignedIn(event.target.checked)}
            />
            {error && <Alert tone="danger">{error}</Alert>}
            <Button
              className="!min-h-12"
              fullWidth
              type="submit"
              disabled={isSubmitting || !!error}
            >
              {isSubmitting
                ? t('auth.signIn.submitting')
                : t('auth.signIn.submit')}
            </Button>
            {onOpenPreview ? (
              <Button fullWidth onClick={onOpenPreview} variant="secondary">
                {t('auth.signIn.preview')}
              </Button>
            ) : null}
          </form>

          <div className="mt-[26px] flex justify-center gap-3 border-t border-border pt-[29px] text-xs2 text-muted md:mt-[31px] md:border-0 md:pt-0 md:text-[0.8125rem] [&_a]:font-medium [&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline">
            <span>{t('auth.signIn.newToHelpDesk')}</span>
            <a
              href="#register"
              onClick={(event) => {
                event.preventDefault();
                onCreateAccount();
              }}
            >
              {t('auth.signIn.createAccount')}
            </a>
          </div>
        </section>

        <footer className="mt-auto pt-[47px] text-center text-2xs text-muted md:mt-7 md:p-0 md:text-xs [&_a]:font-medium [&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline">
          <p>
            <a href="#terms">{t('auth.common.terms')}</a> ·{' '}
            <a href="#privacy-policy">{t('auth.common.privacy')}</a>
          </p>
          <p className="mt-8 md:hidden">{t('auth.common.secureFooter')}</p>
        </footer>
      </section>
    </main>
  );
}
