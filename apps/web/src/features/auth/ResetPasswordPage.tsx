import { Alert, BrandMark, Button, Icon, TextField } from 'ui';
import { resetPasswordSchema } from 'contracts';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { resetPassword } from '../../api/verification';
import {
  errorKey,
  fieldErrorKey,
  fieldErrorsFromIssues,
} from '../../core/api/errors';
import { previewMode } from '../../app/session';
import { LanguageSwitcher } from '../../core/i18n/LanguageSwitcher';
import { useTranslation } from '../../core/i18n';

/** Lo que exige `passwordSchema` de `packages/contracts`, dicho en voz alta. */
const RULES = [
  'auth.reset.ruleMinLength',
  'auth.reset.ruleCase',
  'auth.reset.ruleDigit',
  'auth.reset.ruleSymbol',
];

/**
 * Donde aterriza el enlace del correo de recuperación
 * (`#reset-password?token=…`).
 *
 * La API construía `${origin}/reset-password?token=…`, una ruta sin `#` que no
 * existía en ningún router: Nginx servía `index.html`, el router veía el
 * fragmento vacío y la persona acababa en la pantalla de acceso con el testigo
 * perdido. Es decir, **la recuperación de contraseña no se podía completar**.
 *
 * Es público a propósito: quien llega aquí es justamente quien no puede
 * entrar. El testigo del correo es la prueba, dura 30 minutos y vale una vez.
 */
export function ResetPasswordPage({
  onDone,
  onRequestNew,
  token,
}: {
  onDone: () => void;
  onRequestNew: () => void;
  token: string;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});
  const [failure, setFailure] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // El testigo vale una vez y ya se ha leído: fuera de la barra de direcciones
  // y del historial, donde sólo puede acabar compartido por error.
  const cleaned = useRef(false);
  useEffect(() => {
    if (!token || cleaned.current) return;
    cleaned.current = true;
    window.history.replaceState(null, '', '#reset-password');
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure('');
    // Mismo esquema que valida la API: lo que falle aquí fallaría allí, y la
    // comprobación de que las dos contraseñas coinciden viene con él.
    const parsed = resetPasswordSchema.safeParse({
      token,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      const messages = fieldErrorsFromIssues(parsed.error.issues);
      setFieldErrors({
        confirmPassword: messages.confirmPassword
          ? t(fieldErrorKey(messages.confirmPassword))
          : undefined,
        password: messages.password
          ? t(fieldErrorKey(messages.password))
          : undefined,
      });
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      if (!previewMode) await resetPassword(parsed.data);
      setDone(true);
    } catch (error) {
      setFailure(t(errorKey(error)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-5">
      <section className="w-full max-w-[520px] rounded-lg border border-border bg-surface p-8 shadow-sm max-sm:p-6">
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
        <BrandMark className="mx-auto !size-12" />

        {!token ? (
          <div className="text-center">
            <span className="mx-auto mt-6 grid size-11 place-items-center rounded-full bg-surface-secondary text-primary">
              <Icon aria-hidden="true" name="shield" size={22} />
            </span>
            <h1 className="mt-4 text-2xl font-medium">
              {t('auth.reset.missingTitle')}
            </h1>
            <p className="mx-auto mt-2 max-w-[410px] text-sm leading-6 text-muted">
              {t('auth.reset.missingDescription')}
            </p>
            <Button className="mt-7" onClick={onRequestNew}>
              {t('auth.reset.requestNew')}
            </Button>
          </div>
        ) : done ? (
          <div className="text-center">
            <span className="mx-auto mt-6 grid size-11 place-items-center rounded-full bg-success-surface text-success">
              <Icon aria-hidden="true" name="check" size={22} />
            </span>
            <h1 className="mt-4 text-2xl font-medium">
              {t('auth.reset.doneTitle')}
            </h1>
            <p
              aria-live="polite"
              className="mx-auto mt-2 max-w-[410px] text-sm leading-6 text-muted"
              role="status"
            >
              {t('auth.reset.doneDescription')}
            </p>
            <Button className="mt-7" onClick={onDone}>
              {t('auth.reset.goToSignIn')}
            </Button>
          </div>
        ) : (
          <>
            <h1 className="mt-6 text-center text-2xl font-medium">
              {t('auth.reset.title')}
            </h1>
            <p className="mx-auto mt-2 max-w-[410px] text-center text-sm leading-6 text-muted">
              {t('auth.reset.description')}
            </p>
            <form className="mt-7 grid gap-4" noValidate onSubmit={submit}>
              <div className="relative">
                <TextField
                  autoComplete="new-password"
                  autoFocus
                  error={fieldErrors.password}
                  label={t('auth.reset.newPassword')}
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t('auth.reset.passwordPlaceholder')}
                  type={show ? 'text' : 'password'}
                  value={password}
                />
                <button
                  className="absolute right-3 bottom-0 flex h-12 items-center border-0 bg-transparent px-1 text-xs2 font-medium text-muted hover:text-primary hover:underline md:h-[52px] md:text-xs"
                  onClick={() => setShow(!show)}
                  tabIndex={-1}
                  type="button"
                >
                  {show ? t('auth.common.hide') : t('auth.common.show')}
                </button>
              </div>
              <TextField
                autoComplete="new-password"
                error={fieldErrors.confirmPassword}
                label={t('auth.reset.repeatPassword')}
                name="confirmPassword"
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={t('auth.reset.passwordPlaceholder')}
                type={show ? 'text' : 'password'}
                value={confirmPassword}
              />
              <ul className="grid gap-1 rounded-md bg-surface-secondary p-4 text-xs leading-5 text-muted">
                {RULES.map((rule) => (
                  <li className="flex items-center gap-2" key={rule}>
                    <Icon aria-hidden="true" name="check" size={14} />
                    {t(rule)}
                  </li>
                ))}
              </ul>
              {failure ? (
                <Alert tone="danger">
                  {failure}{' '}
                  <button
                    className="underline"
                    onClick={onRequestNew}
                    type="button"
                  >
                    {t('auth.reset.requestNew')}
                  </button>
                </Alert>
              ) : null}
              <Button
                className="!min-h-12"
                disabled={saving}
                fullWidth
                type="submit"
              >
                {saving ? t('auth.reset.submitting') : t('auth.reset.submit')}
              </Button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
