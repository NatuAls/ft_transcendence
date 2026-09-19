import { Avatar, Button, TextField } from 'ui';
import {
  updatePreferences,
  updateProfile,
  uploadAvatar,
} from '../../api/users';
import { useRef, useState } from 'react';
import { getInitials } from '../../app/text';
import { AccountHeader } from './AccountHeader';
import type { AccountProfile } from './accountData';

export function ProfileSettings({
  avatarUrl,
  onAvatarChange,
  onBack,
  onPrivacy,
  onProfileChange,
  profile,
}: {
  avatarUrl?: string;
  onAvatarChange: (avatarUrl: string) => void;
  onBack: () => void;
  onPrivacy: () => void;
  onProfileChange: (profile: AccountProfile) => void;
  profile: AccountProfile;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState(avatarUrl);
  const [draft, setDraft] = useState(profile);
  const [selectedFile, setSelectedFile] = useState<File>();
  const [feedback, setFeedback] = useState('');
  const [feedbackKind, setFeedbackKind] = useState<
    'error' | 'info' | 'success'
  >('error');
  const [isSaving, setIsSaving] = useState(false);

  const timeZoneOptions = Array.from(
    new Set([
      draft.location,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...(typeof Intl.supportedValuesOf === 'function'
        ? Intl.supportedValuesOf('timeZone')
        : ['UTC', 'Europe/Madrid', 'Europe/Paris', 'America/New_York']),
    ]),
  ).filter(Boolean);

  function updateDraft(field: keyof AccountProfile, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function changeAvatar(file?: File) {
    if (!file) return;
    if (
      !['image/gif', 'image/jpeg', 'image/png', 'image/webp'].includes(
        file.type,
      )
    ) {
      setFeedbackKind('error');
      setFeedback('Choose a PNG, JPG, GIF or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFeedbackKind('error');
      setFeedback('The image must be 5 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    setSelectedFile(file);
    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string') return;
      setPreviewUrl(reader.result);
      setFeedbackKind('info');
      setFeedback('Avatar preview updated. Save changes to keep it.');
    });
    reader.readAsDataURL(file);
  }

  return (
    <div className="account-page">
      <button className="account-back" onClick={onBack} type="button">
        ‹ Account
      </button>
      <AccountHeader
        description="Manage the public information connected to your account."
        title="Profile settings"
      />
      <div className="account-tabs">
        <span>Profile</span>
        <button onClick={onPrivacy} type="button">
          Privacy &amp; data
        </button>
      </div>
      <form
        className="profile-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setIsSaving(true);
          setFeedbackKind('error');
          setFeedback('');
          try {
            const saved = await updateProfile({
              firstName: draft.firstName,
              lastName: draft.lastName,
              bio: draft.bio,
              jobTitle: draft.jobTitle,
            });
            await updatePreferences({ timezone: draft.location });
            let savedAvatarUrl = avatarUrl;
            if (selectedFile) {
              savedAvatarUrl = (await uploadAvatar(selectedFile)).avatarUrl;
              onAvatarChange(savedAvatarUrl);
            }
            onProfileChange({
              ...draft,
              firstName: draft.firstName,
              lastName: draft.lastName,
              fullName: saved.displayName,
              jobTitle: saved.jobTitle ?? '',
              bio: saved.bio ?? '',
            });
            setFeedbackKind('success');
            setFeedback('Profile updated successfully.');
          } catch (error) {
            setFeedback(
              error instanceof Error
                ? error.message
                : 'Unable to update your profile.',
            );
          } finally {
            setIsSaving(false);
          }
        }}
      >
        <header>
          <h2>Public profile</h2>
          <p>This information is visible to other platform members.</p>
        </header>
        <div className="profile-avatar-row">
          <Avatar
            alt={draft.fullName}
            className="account-avatar"
            initials={getInitials(draft.fullName)}
            src={previewUrl}
          />
          <input
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="sr-only"
            onChange={(event) => changeAvatar(event.target.files?.[0])}
            ref={inputRef}
            type="file"
          />
          <Button onClick={() => inputRef.current?.click()} variant="secondary">
            Change avatar
          </Button>
          <small>PNG, JPG, GIF or WebP · Maximum 5 MB</small>
        </div>
        <div className="profile-form__split">
          <TextField
            label="First name"
            name="firstName"
            onChange={(event) => updateDraft('firstName', event.target.value)}
            required
            value={draft.firstName}
          />
          <TextField
            label="Last name"
            name="lastName"
            onChange={(event) => updateDraft('lastName', event.target.value)}
            required
            value={draft.lastName}
          />
        </div>
        <TextField
          label="Username"
          name="username"
          className="profile-form__readonly"
          readOnly
          value={draft.username}
        />
        <TextField
          label="Email address"
          name="email"
          onChange={(event) => updateDraft('email', event.target.value)}
          className="profile-form__readonly"
          required
          readOnly
          type="email"
          value={draft.email}
        />
        <div className="profile-form__split">
          <TextField
            label="Job title"
            name="jobTitle"
            onChange={(event) => updateDraft('jobTitle', event.target.value)}
            value={draft.jobTitle}
          />
          <label className="ui-field">
            <span className="ui-field__label">Time zone</span>
            <select
              className="ui-field__input"
              name="timezone"
              onChange={(event) => updateDraft('location', event.target.value)}
              value={draft.location}
            >
              {timeZoneOptions.map((timeZone) => (
                <option key={timeZone} value={timeZone}>
                  {timeZone}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="account-textarea">
          Bio
          <textarea
            maxLength={280}
            name="bio"
            onChange={(event) => updateDraft('bio', event.target.value)}
            value={draft.bio}
          />
        </label>
        {feedback ? (
          <p
            aria-live="polite"
            className={`account-feedback account-feedback--${feedbackKind}`}
            role="status"
          >
            {feedback}
          </p>
        ) : null}
        <footer>
          <Button onClick={onBack} variant="secondary">
            Cancel
          </Button>
          <Button disabled={isSaving} type="submit">
            {isSaving ? 'Saving...' : 'Save changes'}
          </Button>
        </footer>
      </form>
    </div>
  );
}
