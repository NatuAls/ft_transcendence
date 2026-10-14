import { Alert, BrandMark, Button, Icon, TextField } from 'ui';
import { forgotPasswordSchema } from 'contracts';
import { useState, type FormEvent } from 'react';
import { forgotPassword } from '../../api/verification';
import {
  errorKey,
  fieldErrorKey,
  fieldErrorsFromIssues,
} from '../../core/api/errors';
import { previewMode } from '../../app/session';
import { LanguageSwitcher } from '../../core/i18n/LanguageSwitcher';
import { useTranslation } from '../../core/i18n';

/**
 * Pedir el correo de recuperación (`#forgot-password`).
 *
 * No existía ninguna puerta de entrada: la API tenía
 * `POST /auth/forgot-password` desde el principio y la pantalla de acceso no
 * lo enlazaba, así que quien olvidaba la contraseña no tenía forma de empezar.
 *
 * La respuesta es deliberadamente la misma exista o no la dirección. La API
 * responde 202 en los dos casos, y la pantalla dice lo mismo: si distinguiera,
 * este formulario sería un comprobador de quién tiene cuenta aquí.
 */
export function ForgotPasswordPage({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [failure, setFailure] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure('');
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(
        t(
          fieldErrorKey(
            fieldErrorsFromIssues(parsed.error.issues).email ??
              'errors.email.invalid',
          ),
        ),
      );
      return;
    }
    setFieldError('');
    setSending(true);
    try {
      if (!previewMode) await forgotPassword(parsed.data.email);
      setSent(true);
    } catch (error) {
      setFailure(t(errorKey(error)));
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-5">
      <section className="w-full max-w-[520px] rounded-lg border border-border bg-surface p-8 shadow-sm max-sm:p-6">
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
        <BrandMark className="mx-auto !size-12" />

        {sent ? (
          <div className="text-center">
            <span className="mx-auto mt-6 grid size-11 place-items-center rounded-full bg-success-surface text-success">
              <Icon aria-hidden="true" name="check" size={22} />
            </span>
            <h1 className="mt-4 text-2xl font-medium">
              {t('auth.forgot.sentTitle')}
            </h1>
            <p
              aria-live="polite"
              className="mx-auto mt-2 max-w-[410px] text-sm leading-6 text-muted"
              role="status"
            >
              {t('auth.forgot.sentDescription', { email })}
            </p>
            <p className="mx-auto mt-3 max-w-[410px] text-xs leading-5 text-muted">
              {t('auth.forgot.sentPrivacy')}
            </p>
            <Button className="mt-7" onClick={onBack}>
              {t('auth.forgot.backToSignIn')}
            </Button>
          </div>
        ) : (
          <>
            <h1 className="mt-6 text-center text-2xl font-medium">
              {t('auth.forgot.title')}
            </h1>
            <p className="mx-auto mt-2 max-w-[410px] text-center text-sm leading-6 text-muted">
              {t('auth.forgot.description')}
            </p>
            <form className="mt-7 grid gap-4" noValidate onSubmit={submit}>
              <TextField
                autoComplete="email"
                autoFocus
                error={fieldError}
                label={t('auth.forgot.email')}
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t('auth.forgot.emailPlaceholder')}
                type="email"
                value={email}
              />
              {failure ? <Alert tone="danger">{failure}</Alert> : null}
              <Button
                className="!min-h-12"
                disabled={sending}
                fullWidth
                type="submit"
              >
                {sending
                  ? t('auth.forgot.submitting')
                  : t('auth.forgot.submit')}
              </Button>
              <Button
                fullWidth
                onClick={onBack}
                type="button"
                variant="secondary"
              >
                {t('auth.forgot.backToSignIn')}
              </Button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
