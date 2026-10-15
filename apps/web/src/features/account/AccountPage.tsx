import { Avatar, Button, Checkbox, Icon, SelectField } from 'ui';
import { useEffect, useState } from 'react';
import type { UpdatePreferencesInput } from 'contracts';
import {
  currentLanguage,
  setLanguage,
  toApiLocale,
  useTranslation,
  type Language,
} from '../../core/i18n';
import {
  getPreferences,
  updatePreferences,
  type UserPreferences,
} from '../../api/users';
import type { AccountView } from '../../app/routes';
import { getInitials } from '../../app/text';
import { AccountHeader } from './AccountHeader';
import type { AccountProfile } from './accountData';
import { ProfileSettings } from './ProfileSettings';
import { SessionsPage } from './SessionsPage';
import { AsyncState } from '../../core/async/AsyncState';
import { useAsync } from '../../core/async/useAsync';
import { useToast } from '../../core/feedback/useToast';
import { applyTheme, chooseTheme } from '../../core/theme';
import {
  DeleteAccount,
  ExportReady,
  ExportRequested,
  PrivacyPage,
} from './PrivacyDataViews';

interface AccountPageProps {
  avatarUrl?: string;
  /**
   * Confirmation code carried by the link in a GDPR e-mail
   * (`#account/export-requested?token=…`). It only pre-fills the field: the
   * API is the one that validates it.
   */
  confirmationToken?: string;
  onAvatarChange: (avatarUrl: string) => void;
  onNavigate: (view: AccountView) => void;
  onPrivacyPolicy: () => void;
  onProfileChange: (profile: AccountProfile) => void;
  /** Called once the account has really been deleted: the session must end. */
  onSignOut: () => void;
  onTerms: () => void;
  profile: AccountProfile;
  view: AccountView;
}

function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function AccountPage({
  avatarUrl,
  confirmationToken,
  onAvatarChange,
  onNavigate,
  onPrivacyPolicy,
  onProfileChange,
  onSignOut,
  onTerms,
  profile,
  view,
}: AccountPageProps) {
  const [timeZone, setTimeZone] = useState(browserTimeZone);

  if (view === 'home')
    return (
      <AccountHome
        avatarUrl={avatarUrl}
        onPreferences={() => onNavigate('preferences')}
        onPassword={() => onNavigate('password')}
        onPrivacy={() => onNavigate('privacy')}
        onProfile={() => onNavigate('profile')}
        onSessions={() => onNavigate('sessions')}
        profile={profile}
        timeZone={timeZone}
      />
    );
  if (view === 'profile')
    return (
      <ProfileSettings
        avatarUrl={avatarUrl}
        onAvatarChange={onAvatarChange}
        onBack={() => onNavigate('home')}
        onPrivacy={() => onNavigate('privacy')}
        onProfileChange={onProfileChange}
        profile={profile}
      />
    );
  if (view === 'sessions')
    return (
      <SessionsPage onBack={() => onNavigate('home')} onSignedOut={onSignOut} />
    );
  if (view === 'preferences')
    return (
      <PreferencesPage
        onBack={() => onNavigate('home')}
        onChange={setTimeZone}
        timeZone={timeZone}
      />
    );
  if (view === 'export-requested')
    return (
      <ExportRequested
        onBack={() => onNavigate('privacy')}
        onConfirm={() => onNavigate('export-ready')}
        token={confirmationToken}
      />
    );
  if (view === 'export-ready')
    return <ExportReady onBack={() => onNavigate('privacy')} />;
  if (view === 'delete')
    return (
      <DeleteAccount
        onBack={() => onNavigate('privacy')}
        onDeleted={onSignOut}
        profile={profile}
        token={confirmationToken}
      />
    );
  return (
    <PrivacyPage
      onBack={() => onNavigate('home')}
      onDelete={() => onNavigate('delete')}
      onExport={() => onNavigate('export-requested')}
      onPrivacyPolicy={onPrivacyPolicy}
      onProfile={() => onNavigate('profile')}
      onTerms={onTerms}
    />
  );
}

function AccountHome({
  avatarUrl,
  onPreferences,
  onPassword,
  onPrivacy,
  onProfile,
  onSessions,
  profile,
  timeZone,
}: {
  avatarUrl?: string;
  onPreferences: () => void;
  onPassword: () => void;
  onPrivacy: () => void;
  onProfile: () => void;
  onSessions: () => void;
  profile: AccountProfile;
  timeZone: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-[1040px] p-10 max-md:px-4 max-md:py-6">
      <AccountHeader
        description={t('account.home.description')}
        title={t('account.home.profileTitle')}
      />
      <section className="mt-7 flex items-center gap-4 rounded-md border border-border bg-surface p-[22px] max-md:p-4 max-md:[&_.ui-button]:!min-h-9 max-md:[&_.ui-button]:!px-2.5">
        <Avatar
          alt={t('account.profile.avatarAlt', { name: profile.fullName })}
          className="!size-[58px] !basis-[58px]"
          initials={getInitials(profile.fullName)}
          src={avatarUrl}
        />
        <div className="min-w-0 flex-1">
          <h2 className="mb-1 text-lg font-medium">{profile.fullName}</h2>
          <p className="truncate text-xs text-muted">{profile.email}</p>
          <small className="text-2xs text-muted">
            {profile.jobTitle || t('account.home.user')}
          </small>
        </div>
        <Button
          className="max-md:!min-w-[124px] max-md:!px-3"
          onClick={onProfile}
          variant="secondary"
        >
          {t('account.home.editProfile')}
        </Button>
      </section>
      <nav
        aria-label={t('account.home.settingsLabel')}
        className="mt-4 grid gap-2.5"
      >
        <button
          className="grid grid-cols-[36px_1fr_20px] items-center gap-2.5 rounded-md border border-border bg-surface p-4 text-left hover:border-focus hover:bg-surface-secondary"
          onClick={onPassword}
          type="button"
        >
          <Icon name="shield" size={20} />
          <div className="grid gap-1">
            <strong>{t('account.password.title')}</strong>
            <small className="text-2xs text-muted">
              {t('account.password.description')}
            </small>
          </div>
          <Icon aria-hidden="true" name="chevron-right" size={18} />
        </button>
        <button
          className="grid grid-cols-[36px_1fr_20px] items-center gap-2.5 rounded-md border border-border bg-surface p-4 text-left hover:border-focus hover:bg-surface-secondary"
          onClick={onPreferences}
          type="button"
        >
          <Icon name="ticket" size={20} />
          <div className="grid gap-1">
            <strong>{t('account.home.preferences.title')}</strong>
            <small className="text-2xs text-muted">
              {t('account.home.preferences.summary', { timezone: timeZone })}
            </small>
          </div>
          <Icon aria-hidden="true" name="chevron-right" size={18} />
        </button>
        <button
          className="grid grid-cols-[36px_1fr_20px] items-center gap-2.5 rounded-md border border-border bg-surface p-4 text-left hover:border-focus hover:bg-surface-secondary"
          onClick={onPrivacy}
          type="button"
        >
          <Icon name="shield" size={20} />
          <div className="grid gap-1">
            <strong>{t('account.home.privacy.title')}</strong>
            <small className="text-2xs text-muted">
              {t('account.home.privacy.description')}
            </small>
          </div>
          <Icon aria-hidden="true" name="chevron-right" size={18} />
        </button>
        <button
          className="grid grid-cols-[36px_1fr_20px] items-center gap-2.5 rounded-md border border-border bg-surface p-4 text-left hover:border-focus hover:bg-surface-secondary"
          onClick={onSessions}
          type="button"
        >
          <Icon name="logout" size={20} />
          <div className="grid gap-1">
            <strong>{t('account.home.sessions.title')}</strong>
            <small className="text-2xs text-muted">
              {t('account.home.sessions.description')}
            </small>
          </div>
          <Icon aria-hidden="true" name="chevron-right" size={18} />
        </button>
      </nav>
    </div>
  );
}

function PreferencesPage({
  onBack,
  onChange,
  timeZone,
}: {
  onBack: () => void;
  onChange: (value: string) => void;
  timeZone: string;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const preferences = useAsync(getPreferences, []);
  const [saving, setSaving] = useState<PreferenceField | 'language' | null>(
    null,
  );
  const data = preferences.data;
  const preferenceTimeZone = data?.timezone;
  const preferenceTheme = data?.theme;

  useEffect(() => {
    if (preferenceTimeZone) onChange(preferenceTimeZone);
  }, [onChange, preferenceTimeZone]);

  useEffect(() => {
    if (preferenceTheme) applyTheme(preferenceTheme);
  }, [preferenceTheme]);

  const options = Array.from(
    new Set([
      data?.timezone ?? timeZone,
      'UTC',
      'Europe/Madrid',
      'Europe/Paris',
      'America/New_York',
    ]),
  );

  async function savePreference(
    field: PreferenceField,
    value: UserPreferences[PreferenceField],
    previous: UserPreferences,
  ) {
    setSaving(field);
    if (field === 'timezone') onChange(String(value));
    if (field === 'theme') chooseTheme(String(value));
    preferences.setData((current) =>
      current ? { ...current, [field]: value } : current,
    );
    try {
      const saved = await updatePreferences({
        [field]: value,
      } as UpdatePreferencesInput);
      preferences.setData(() => saved);
      toast.success(t('account.preferences.saved'));
    } catch (error) {
      preferences.setData((current) =>
        current ? { ...current, [field]: previous[field] } : current,
      );
      if (field === 'timezone') onChange(previous.timezone);
      if (field === 'theme') chooseTheme(previous.theme);
      toast.error(error);
    } finally {
      setSaving(null);
    }
  }

  async function changeLanguage(language: Language) {
    if (!data || saving) return;
    const previousLanguage = currentLanguage();
    const previousLocale = data.locale;
    const apiLocale = toApiLocale(language);
    setSaving('language');
    await setLanguage(language);
    preferences.setData((current) =>
      current ? { ...current, locale: apiLocale } : current,
    );
    if (apiLocale === 'CA') {
      toast.success(t('account.preferences.saved'));
      setSaving(null);
      return;
    }
    try {
      const saved = await updatePreferences({ locale: apiLocale });
      preferences.setData(() => saved);
      toast.success(t('account.preferences.saved'));
    } catch (error) {
      await setLanguage(previousLanguage);
      preferences.setData((current) =>
        current ? { ...current, locale: previousLocale } : current,
      );
      toast.error(error);
    } finally {
      setSaving(null);
    }
  }

  const notificationFields = [
    'notifyOnTicketUpdate',
    'notifyOnComment',
    'notifyOnMention',
    'notifyOnMessage',
    'notifyOnFriendship',
  ] as const;
  return (
    <div className="mx-auto max-w-[1040px] p-10 max-md:px-4 max-md:py-6">
      <button
        className="mb-[18px] hidden text-primary max-md:block"
        onClick={onBack}
        type="button"
      >
        {t('account.back')}
      </button>
      <AccountHeader
        description={t('account.preferences.description')}
        title={t('account.preferences.title')}
      />
      <AsyncState
        error={preferences.error}
        onRetry={preferences.reload}
        status={preferences.status}
      >
        {data ? (
          <section className="mt-6 grid max-w-[620px] gap-[18px] rounded-md border border-border bg-surface p-6 max-md:border-0 max-md:p-0">
            <SelectField
              disabled={saving !== null}
              label={t('account.preferences.language')}
              onChange={(event) =>
                void changeLanguage(event.target.value as Language)
              }
              value={currentLanguage()}
            >
              <option value="en">
                {t('account.preferences.languages.en')}
              </option>
              <option value="es">
                {t('account.preferences.languages.es')}
              </option>
              <option value="ca">
                {t('account.preferences.languages.ca')}
              </option>
            </SelectField>
            <SelectField
              disabled={saving !== null}
              label={t('account.preferences.theme')}
              onChange={(event) =>
                void savePreference('theme', event.target.value, data)
              }
              value={data.theme}
            >
              <option value="light">
                {t('account.preferences.themes.light')}
              </option>
              <option value="dark">
                {t('account.preferences.themes.dark')}
              </option>
              <option value="system">
                {t('account.preferences.themes.system')}
              </option>
            </SelectField>
            <SelectField
              disabled={saving !== null}
              label={t('account.preferences.timezone')}
              onChange={(event) =>
                void savePreference('timezone', event.target.value, data)
              }
              value={data.timezone}
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </SelectField>
            <p className="text-xs leading-[1.5] text-muted">
              {t('account.preferences.timezoneHelp', {
                timezone: browserTimeZone(),
              })}
            </p>
            <fieldset className="grid gap-3 border-0 p-0">
              <legend className="mb-1 text-sm font-medium text-ink">
                {t('account.preferences.notifications')}
              </legend>
              {notificationFields.map((field) => (
                <Checkbox
                  checked={data[field]}
                  disabled={saving !== null}
                  key={field}
                  label={t(`account.preferences.${field}`)}
                  onChange={(event) =>
                    void savePreference(field, event.target.checked, data)
                  }
                />
              ))}
            </fieldset>
          </section>
        ) : null}
      </AsyncState>
    </div>
  );
}

type PreferenceField =
  | 'timezone'
  | 'theme'
  | 'notifyOnTicketUpdate'
  | 'notifyOnComment'
  | 'notifyOnMention'
  | 'notifyOnMessage'
  | 'notifyOnFriendship';
