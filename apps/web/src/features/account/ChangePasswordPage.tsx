import { Alert, Button, IconButton, TextField } from 'ui';
import { changePasswordSchema } from 'contracts';
import { useState, type FormEvent } from 'react';
import { changePassword } from '../../api/auth';
import {
  isApiError,
  errorKey,
  fieldErrorKey,
  fieldErrorsFromIssues,
} from '../../core/api/errors';
import { useToast } from '../../core/feedback/useToast';
import { useTranslation } from '../../core/i18n';

type PasswordField = 'currentPassword' | 'password' | 'confirmPassword';
type FieldErrors = Partial<Record<PasswordField, string>>;

export function ChangePasswordPage({
  onBack,
  onSignOut,
}: {
  onBack: () => void;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure('');
    const parsed = changePasswordSchema.safeParse({
      currentPassword,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      const rawErrors = fieldErrorsFromIssues(parsed.error.issues);
      const translated: FieldErrors = {};
      for (const field of Object.keys(rawErrors) as PasswordField[]) {
        translated[field] = t(fieldErrorKey(rawErrors[field]));
      }
      setFieldErrors(translated);
      return;
    }

    setFieldErrors({});
    setSaving(true);
    try {
      await changePassword(parsed.data);
      toast.success(t('account.password.success'));
      // The API has revoked this and every other session. Do not make another
      // request or render a success state that assumes this session survives.
      onSignOut();
    } catch (error) {
      if (isApiError(error) && error.code === 'AUTH_WRONG_PASSWORD') {
        setFieldErrors({
          currentPassword: t(errorKey(error)),
        });
      } else {
        setFailure(t(errorKey(error)));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-260 p-10 max-md:px-4 max-md:py-6">
      {/* <Button  Test   preguntar al grupo
        className="mb-[18px] hidden max-md:inline-flex"
        onClick={onBack}
        variant="secondary"
      >
        {t('account.back')}
      </Button> */}
      <header>
        <span className="text-xs2 tracking-[.08em] text-muted max-md:hidden">
          {t('nav.account').toLocaleUpperCase()}
        </span>
        <h1 className="my-2 text-[1.875rem] font-medium max-md:text-[1.375rem]">
          {t('account.password.title')}
        </h1>
        <p className="text-sm text-muted max-md:text-xs">
          {t('account.password.description')}
        </p>
      </header>
      <form
        className="mt-6 grid max-w-155 gap-4.5 rounded-md border border-border bg-surface p-6 max-md:border-0 max-md:px-0"
        noValidate
        onSubmit={submit}
      >
        <Alert tone="warning">{t('account.password.sessionWarning')}</Alert>
        <div className="relative">
          <TextField
            autoComplete="current-password"
            error={fieldErrors.currentPassword}
            label={t('account.password.current')}
            name="currentPassword"
            onChange={(event) => setCurrentPassword(event.target.value)}
            type={showCurrentPassword ? 'text' : 'password'}
            value={currentPassword}
          />
          <IconButton
            aria-label={
              showCurrentPassword
                ? t('account.password.hidePassword')
                : t('account.password.showPassword')
            }
            aria-pressed={showCurrentPassword}
            className="absolute right-3 bottom-0 flex h-12 items-center border-0 bg-transparent px-1 text-xs2 font-medium text-muted hover:text-primary hover:underline md:h-[52px] md:text-xs"
            icon={showCurrentPassword ? 'eye-off' : 'eye'}
            label={
              showCurrentPassword
                ? t('account.password.hidePassword')
                : t('account.password.showPassword')
            }
            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            size="sm"
          />
        </div>
        <div className="relative">
          <TextField
            autoComplete="new-password"
            error={fieldErrors.password}
            label={t('account.password.new')}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            type={showPassword ? 'text' : 'password'}
            value={password}
          />
          <IconButton
            aria-label={
              showPassword
                ? t('account.password.hidePassword')
                : t('account.password.showPassword')
            }
            aria-pressed={showPassword}
            className="absolute right-3 bottom-0 flex h-12 items-center border-0 bg-transparent px-1 text-xs2 font-medium text-muted hover:text-primary hover:underline md:h-[52px] md:text-xs"
            icon={showPassword ? 'eye-off' : 'eye'}
            label={
              showPassword
                ? t('account.password.hidePassword')
                : t('account.password.showPassword')
            }
            onClick={() => setShowPassword(!showPassword)}
            size="sm"
          />
        </div>
        <div className="relative">
          <TextField
            autoComplete="new-password"
            error={fieldErrors.confirmPassword}
            label={t('account.password.confirm')}
            name="confirmPassword"
            onChange={(event) => setConfirmPassword(event.target.value)}
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
          />
          <IconButton
            aria-label={
              showConfirmPassword
                ? t('account.password.hidePassword')
                : t('account.password.showPassword')
            }
            aria-pressed={showConfirmPassword}
            className="absolute right-3 bottom-0 flex h-12 items-center border-0 bg-transparent px-1 text-xs2 font-medium text-muted hover:text-primary hover:underline md:h-[52px] md:text-xs"
            icon={showConfirmPassword ? 'eye-off' : 'eye'}
            label={
              showConfirmPassword
                ? t('account.password.hidePassword')
                : t('account.password.showPassword')
            }
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            size="sm"
          />
        </div>
        {failure ? <Alert tone="danger">{failure}</Alert> : null}
        <div className="flex justify-end gap-3 max-md:flex-col-reverse">
          <Button onClick={onBack} type="button" variant="secondary">
            {t('common.actions.cancel')}
          </Button>
          <Button disabled={saving} type="submit">
            {saving
              ? t('account.password.saving')
              : t('account.password.submit')}
          </Button>
        </div>
      </form>
    </div>
  );
}
