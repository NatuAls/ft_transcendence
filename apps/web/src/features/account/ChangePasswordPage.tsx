import { Alert, Button, TextField } from 'ui';
import { changePasswordSchema } from 'contracts';
import { useState, type FormEvent } from 'react';
import { changePassword } from '../../api/auth';
import {
  isApiError,
  errorKey,
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
        const issue = parsed.error.issues.find(
          (candidate) => candidate.path.join('.') === field,
        );
        if (!issue) continue;
        translated[field] = issue.message.startsWith('errors.')
          ? t(issue.message)
          : t('errors.field.required');
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
          currentPassword: t(error.messageKey, { defaultValue: error.message }),
        });
      } else {
        setFailure(t(errorKey(error)));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1040px] p-10 max-md:px-4 max-md:py-6">
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
        className="mt-6 grid max-w-[620px] gap-[18px] rounded-md border border-border bg-surface p-6 max-md:border-0 max-md:px-0"
        noValidate
        onSubmit={submit}
      >
        <Alert tone="warning">{t('account.password.sessionWarning')}</Alert>
        <TextField
          autoComplete="current-password"
          error={fieldErrors.currentPassword}
          label={t('account.password.current')}
          name="currentPassword"
          onChange={(event) => setCurrentPassword(event.target.value)}
          type="password"
          value={currentPassword}
        />
        <TextField
          autoComplete="new-password"
          error={fieldErrors.password}
          label={t('account.password.new')}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
        <TextField
          autoComplete="new-password"
          error={fieldErrors.confirmPassword}
          label={t('account.password.confirm')}
          name="confirmPassword"
          onChange={(event) => setConfirmPassword(event.target.value)}
          type="password"
          value={confirmPassword}
        />
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
