import { Avatar, Button, SelectField } from 'ui';
import { useState } from 'react';
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
import './account.css';

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
    <div className="account-page account-home">
      <AccountHeader
        description="Manage your personal details and privacy."
        title="Profile settings"
      />
      <section>
        <Avatar
          alt={profile.fullName}
          className="account-avatar"
          initials={getInitials(profile.fullName)}
          src={avatarUrl}
        />
        <div>
          <h2>{profile.fullName}</h2>
          <p>{profile.email}</p>
          <small>{profile.jobTitle || 'User'}</small>
        </div>
        <Button onClick={onProfile} variant="secondary">
          Edit profile
        </Button>
      </section>
      <nav aria-label="Account settings">
        <button onClick={onPreferences} type="button">
          <span aria-hidden="true">◷</span>
          <div>
            <strong>Preferences</strong>
            <small>Time zone · {timeZone}</small>
          </div>
          <b aria-hidden="true">›</b>
        </button>
        <button onClick={onPrivacy} type="button">
          <span aria-hidden="true">◇</span>
          <div>
            <strong>Privacy &amp; data</strong>
            <small>Export or delete your information</small>
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
    <div className="account-page">
      <button className="account-back" onClick={onBack} type="button">
        ‹ Account
      </button>
      <AccountHeader
        description="Choose how dates and notification schedules are shown."
        title="Preferences"
      />
      <section className="preferences-card">
        <SelectField
          label="Time zone"
          onChange={(event) => onChange(event.target.value)}
          value={timeZone}
        >
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </SelectField>
        <p>
          The browser detected <strong>{browserTimeZone()}</strong>. This
          setting controls ticket timestamps and future notification schedules.
        </p>
        <Button onClick={onBack}>Save preference</Button>
      </section>
    </div>
  );
}
