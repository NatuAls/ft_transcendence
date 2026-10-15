import { Alert, Avatar, Button, SelectField, Tabs, TextField } from 'ui';
import {
  deleteAvatar,
  updatePreferences,
  updateProfile,
  uploadAvatar,
} from '../../api/users';
import { previewMode } from '../../app/session';
import { useRef, useState } from 'react';
import { getInitials } from '../../app/text';
import { errorKey } from '../../core/api/errors';
import { useTranslation } from '../../core/i18n';
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
  const { t } = useTranslation();
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

  /**
   * Back to the default avatar: the initials badge every account shows until
   * it uploads a photo. Applied at once - there is nothing to "save" about
   * removing a picture - and the old file is deleted on the server.
   */
  async function removeAvatar() {
    setFeedback('');
    try {
      if (!previewMode && avatarUrl) await deleteAvatar();
      setSelectedFile(undefined);
      setPreviewUrl(undefined);
      onAvatarChange('');
      setFeedbackKind('success');
      setFeedback(t('account.profile.photoRemoved'));
    } catch (error) {
      setFeedbackKind('error');
      setFeedback(t(errorKey(error)));
    }
  }

  function changeAvatar(file?: File) {
    if (!file) return;
    if (
      !['image/gif', 'image/jpeg', 'image/png', 'image/webp'].includes(
        file.type,
      )
    ) {
      setFeedbackKind('error');
      setFeedback(t('account.profile.invalidImageType'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFeedbackKind('error');
      setFeedback(t('account.profile.imageTooLarge'));
      return;
    }
    const reader = new FileReader();
    setSelectedFile(file);
    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string') return;
      setPreviewUrl(reader.result);
      setFeedbackKind('info');
      setFeedback(t('account.profile.previewUpdated'));
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
        {t('account.back')}
      </button>
      <AccountHeader
        description={t('account.profile.description')}
        title={t('account.profile.title')}
      />
      <div className="mt-[26px] border-b border-border max-md:hidden">
        <Tabs
          activeTab="profile"
          items={[
            { id: 'profile', label: t('account.profile.tabProfile') },
            { id: 'privacy', label: t('account.profile.tabPrivacy') },
          ]}
          label={t('account.profile.sections')}
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
            setFeedback(t('account.profile.updated'));
          } catch (error) {
            setFeedback(t(errorKey(error)));
          } finally {
            setIsSaving(false);
          }
        }}
      >
        <header className="max-md:hidden">
          <h2 className="text-base font-medium">
            {t('account.profile.publicTitle')}
          </h2>
          <p className="text-xs2 text-muted">
            {t('account.profile.publicDescription')}
          </p>
        </header>
        <div className="flex items-center gap-3 max-md:flex-wrap max-md:justify-center">
          <Avatar
            alt={t('account.profile.avatarAlt', { name: draft.fullName })}
            className="!size-[58px] !basis-[58px]"
            initials={getInitials(draft.fullName)}
            src={previewUrl}
          />
          <input
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="sr-only"
            name="avatar"
            onChange={(event) => changeAvatar(event.target.files?.[0])}
            ref={inputRef}
            type="file"
          />
          <Button onClick={() => inputRef.current?.click()} variant="secondary">
            {previewUrl
              ? t('account.profile.changeAvatar')
              : t('account.profile.uploadPhoto')}
          </Button>
          {previewUrl ? (
            <Button onClick={() => void removeAvatar()} variant="ghost">
              {t('account.profile.removePhoto')}
            </Button>
          ) : null}
          <small className="text-2xs text-muted max-md:w-full max-md:text-center">
            {previewUrl
              ? t('account.profile.imageHelp')
              : t('account.profile.noPhotoHelp')}
          </small>
        </div>
        <div className="grid grid-cols-2 gap-[14px] max-md:grid-cols-1">
          <TextField
            label={t('account.profile.firstName')}
            name="firstName"
            onChange={(event) => updateDraft('firstName', event.target.value)}
            required
            value={draft.firstName}
          />
          <TextField
            label={t('account.profile.lastName')}
            name="lastName"
            onChange={(event) => updateDraft('lastName', event.target.value)}
            required
            value={draft.lastName}
          />
        </div>
        <TextField
          autoComplete="username"
          label={t('account.profile.username')}
          name="username"
          className="[&_.ui-field__input]:cursor-not-allowed [&_.ui-field__input]:bg-surface-secondary [&_.ui-field__input]:text-muted"
          readOnly
          value={draft.username}
        />
        <TextField
          autoComplete="email"
          label={t('account.profile.email')}
          name="email"
          onChange={(event) => updateDraft('email', event.target.value)}
          className="[&_.ui-field__input]:cursor-not-allowed [&_.ui-field__input]:bg-surface-secondary [&_.ui-field__input]:text-muted"
          required
          readOnly
          type="email"
          value={draft.email}
        />
        <div className="grid grid-cols-2 gap-[14px] max-md:grid-cols-1">
          <TextField
            label={t('account.profile.jobTitle')}
            name="jobTitle"
            onChange={(event) => updateDraft('jobTitle', event.target.value)}
            value={draft.jobTitle}
          />
          <SelectField
            className="!h-[52px]"
            label={t('account.profile.timezone')}
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
          {t('account.profile.bio')}
          <textarea
            className="min-h-[90px] resize-y rounded-sm border border-border p-3 leading-[1.5] focus-visible:border-focus focus-visible:outline-3 focus-visible:outline-focus"
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
            {t('common.actions.cancel')}
          </Button>
          <Button disabled={isSaving} type="submit">
            {isSaving ? t('account.profile.saving') : t('account.profile.save')}
          </Button>
        </footer>
      </form>
    </div>
  );
}
