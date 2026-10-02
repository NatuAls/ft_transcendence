import { Alert, Avatar, Button, Icon, SelectField } from 'ui';
import { useEffect, useState } from 'react';
import { getPreferences, updatePreferences } from '../../api/users';
import type { AccountView } from '../../app/routes';
import { getInitials } from '../../app/text';
import { AccountHeader } from './AccountHeader';
import type { AccountProfile } from './accountData';
import { ProfileSettings } from './ProfileSettings';
import {
  DeleteAccount,
  ExportReady,
  ExportRequested,
  PrivacyPage,
} from './PrivacyDataViews';

interface AccountPageProps {
  avatarUrl?: string;
  onAvatarChange: (avatarUrl: string) => void;
  onNavigate: (view: AccountView) => void;
  onPrivacyPolicy: () => void;
  onProfileChange: (profile: AccountProfile) => void;
  onTerms: () => void;
  profile: AccountProfile;
  view: AccountView;
}

function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function AccountPage({
  avatarUrl,
  onAvatarChange,
  onNavigate,
  onPrivacyPolicy,
  onProfileChange,
  onTerms,
  profile,
  view,
}: AccountPageProps) {
  const [deletionText, setDeletionText] = useState('');
  const [timeZone, setTimeZone] = useState(browserTimeZone);

  if (view === 'home')
    return (
      <AccountHome
        avatarUrl={avatarUrl}
        onPreferences={() => onNavigate('preferences')}
        onPrivacy={() => onNavigate('privacy')}
        onProfile={() => onNavigate('profile')}
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
      />
    );
  if (view === 'export-ready')
    return (
      <ExportReady onBack={() => onNavigate('privacy')} profile={profile} />
    );
  if (view === 'delete')
    return (
      <DeleteAccount
        deletionText={deletionText}
        onBack={() => onNavigate('privacy')}
        onChange={setDeletionText}
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
  onPrivacy,
  onProfile,
  profile,
  timeZone,
}: {
  avatarUrl?: string;
  onPreferences: () => void;
  onPrivacy: () => void;
  onProfile: () => void;
  profile: AccountProfile;
  timeZone: string;
}) {
  return (
    <div className="mx-auto max-w-[1040px] p-10 max-md:px-4 max-md:py-6">
      <AccountHeader
        description="Manage your personal details and privacy."
        title="Profile settings"
      />
      <section className="mt-7 flex items-center gap-4 rounded-md border border-border bg-surface p-[22px] max-md:p-4 max-md:[&_.ui-button]:!min-h-9 max-md:[&_.ui-button]:!px-2.5">
        <Avatar
          alt={profile.fullName}
          className="!size-[58px] !basis-[58px]"
          initials={getInitials(profile.fullName)}
          src={avatarUrl}
        />
        <div className="min-w-0 flex-1">
          <h2 className="mb-1 text-lg font-medium">{profile.fullName}</h2>
          <p className="truncate text-xs text-muted">{profile.email}</p>
          <small className="text-2xs text-muted">
            {profile.jobTitle || 'User'}
          </small>
        </div>
        <Button
          className="max-md:!min-w-[124px] max-md:!px-3"
          onClick={onProfile}
          variant="secondary"
        >
          Edit profile
        </Button>
      </section>
      <nav aria-label="Account settings" className="mt-4 grid gap-2.5">
        <button
          className="grid grid-cols-[36px_1fr_20px] items-center gap-2.5 rounded-md border border-border bg-surface p-4 text-left hover:border-focus hover:bg-surface-secondary"
          onClick={onPreferences}
          type="button"
        >
          <Icon name="ticket" size={20} />
          <div className="grid gap-1">
            <strong>Preferences</strong>
            <small className="text-2xs text-muted">
              Time zone · {timeZone}
            </small>
          </div>
          <b aria-hidden="true">›</b>
        </button>
        <button
          className="grid grid-cols-[36px_1fr_20px] items-center gap-2.5 rounded-md border border-border bg-surface p-4 text-left hover:border-focus hover:bg-surface-secondary"
          onClick={onPrivacy}
          type="button"
        >
          <Icon name="shield" size={20} />
          <div className="grid gap-1">
            <strong>Privacy &amp; data</strong>
            <small className="text-2xs text-muted">
              Export or delete your information
            </small>
          </div>
          <b aria-hidden="true">›</b>
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
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    void getPreferences()
      .then((preferences) => onChange(preferences.timezone))
      .catch(() => setFeedback('Unable to load your preferences.'));
  }, [onChange]);

  const options = Array.from(
    new Set([
      timeZone,
      'UTC',
      'Europe/Madrid',
      'Europe/Paris',
      'America/New_York',
    ]),
  );
  return (
    <div className="mx-auto max-w-[1040px] p-10 max-md:px-4 max-md:py-6">
      <button
        className="mb-[18px] hidden text-primary max-md:block"
        onClick={onBack}
        type="button"
      >
        ‹ Account
      </button>
      <AccountHeader
        description="Choose how dates and notification schedules are shown."
        title="Preferences"
      />
      <section className="mt-6 grid max-w-[620px] gap-[18px] rounded-md border border-border bg-surface p-6 max-md:border-0 max-md:p-0">
        <SelectField
          label="Time zone"
          onChange={(event) => onChange(event.target.value)}
          value={timeZone}
        >
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </SelectField>
        <p className="text-xs leading-[1.5] text-muted">
          The browser detected <strong>{browserTimeZone()}</strong>. This
          setting controls ticket timestamps and future notification schedules.
        </p>
        {feedback ? (
          <Alert
            tone={feedback.includes('successfully') ? 'success' : 'danger'}
          >
            {feedback}
          </Alert>
        ) : null}
        <Button
          className="justify-self-end max-md:w-full"
          disabled={isSaving}
          onClick={async () => {
            setIsSaving(true);
            setFeedback('');
            try {
              await updatePreferences({ timezone: timeZone });
              setFeedback('Preference saved successfully.');
            } catch (error) {
              setFeedback(
                error instanceof Error
                  ? error.message
                  : 'Unable to save your preference.',
              );
            } finally {
              setIsSaving(false);
            }
          }}
        >
          {isSaving ? 'Saving...' : 'Save preference'}
        </Button>
      </section>
    </div>
  );
}
