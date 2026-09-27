import { Alert, Avatar, Button, SelectField, Tabs, TextField } from 'ui';
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
    <div className="mx-auto max-w-[1040px] p-10 max-md:px-4 max-md:py-6">
      <button
        className="mb-[18px] hidden text-primary max-md:block"
        onClick={onBack}
        type="button"
      >
        ‹ Account
      </button>
      <AccountHeader
        description="Manage the public information connected to your account."
        title="Profile settings"
      />
      <div className="mt-[26px] border-b border-border max-md:hidden">
        <Tabs
          activeTab="profile"
          items={[
            { id: 'profile', label: 'Profile' },
            { id: 'privacy', label: 'Privacy & data' },
          ]}
          label="Account sections"
          onChange={(tab) => {
            if (tab === 'privacy') onPrivacy();
          }}
        />
      </div>
      <form
        className="mt-5 grid max-w-[700px] gap-5 rounded-md border border-border bg-surface p-[26px] max-md:mt-3 max-md:border-0 max-md:p-0"
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
        <header className="max-md:hidden">
          <h2 className="text-base font-medium">Public profile</h2>
          <p className="text-[11px] text-muted">
            This information is visible to other platform members.
          </p>
        </header>
        <div className="flex items-center gap-3 max-md:flex-wrap max-md:justify-center">
          <Avatar
            alt={draft.fullName}
            className="!size-[58px] !basis-[58px]"
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
          <small className="text-[10px] text-muted max-md:w-full max-md:text-center">
            PNG, JPG, GIF or WebP · Maximum 5 MB
          </small>
        </div>
        <div className="grid grid-cols-2 gap-[14px] max-md:grid-cols-1">
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
          className="[&_.ui-field__input]:cursor-not-allowed [&_.ui-field__input]:bg-[#eef0f2] [&_.ui-field__input]:text-muted"
          readOnly
          value={draft.username}
        />
        <TextField
          label="Email address"
          name="email"
          onChange={(event) => updateDraft('email', event.target.value)}
          className="[&_.ui-field__input]:cursor-not-allowed [&_.ui-field__input]:bg-[#eef0f2] [&_.ui-field__input]:text-muted"
          required
          readOnly
          type="email"
          value={draft.email}
        />
        <div className="grid grid-cols-2 gap-[14px] max-md:grid-cols-1">
          <TextField
            label="Job title"
            name="jobTitle"
            onChange={(event) => updateDraft('jobTitle', event.target.value)}
            value={draft.jobTitle}
          />
          <SelectField
            className="!h-[52px]"
            label="Time zone"
            name="timezone"
            onChange={(event) => updateDraft('location', event.target.value)}
            value={draft.location}
          >
            {timeZoneOptions.map((timeZone) => (
              <option key={timeZone} value={timeZone}>
                {timeZone}
              </option>
            ))}
          </SelectField>
        </div>
        <label className="grid gap-2 text-sm font-medium">
          Bio
          <textarea
            className="min-h-[90px] resize-y rounded-sm border border-border p-3 leading-[1.5] focus-visible:border-focus focus-visible:outline-3 focus-visible:outline-focus/20"
            maxLength={280}
            name="bio"
            onChange={(event) => updateDraft('bio', event.target.value)}
            value={draft.bio}
          />
        </label>
        {feedback ? (
          <Alert
            aria-live="polite"
            tone={
              feedbackKind === 'error'
                ? 'danger'
                : feedbackKind === 'success'
                  ? 'success'
                  : 'info'
            }
          >
            {feedback}
          </Alert>
        ) : null}
        <footer className="flex justify-end gap-2 border-t border-border pt-[18px] max-md:[&_.ui-button]:w-full max-md:[&_.ui-button:first-child]:hidden">
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
