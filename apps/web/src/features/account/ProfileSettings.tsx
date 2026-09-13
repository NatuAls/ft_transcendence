import { Avatar, Button, TextField } from 'ui';
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
  const [feedback, setFeedback] = useState('');

  function updateDraft(field: keyof AccountProfile, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function changeAvatar(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setFeedback('Choose a PNG or JPG image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFeedback('The image must be 2 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string') return;
      setPreviewUrl(reader.result);
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
        onSubmit={(event) => {
          event.preventDefault();
          onProfileChange(draft);
          if (previewUrl) onAvatarChange(previewUrl);
          setFeedback(
            'Profile updated in this session. Backend persistence is still pending.',
          );
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
            accept="image/png,image/jpeg"
            className="sr-only"
            onChange={(event) => changeAvatar(event.target.files?.[0])}
            ref={inputRef}
            type="file"
          />
          <Button onClick={() => inputRef.current?.click()} variant="secondary">
            Change avatar
          </Button>
          <small>PNG or JPG · Maximum 2 MB</small>
        </div>
        <TextField
          label="Full name"
          name="fullName"
          onChange={(event) => updateDraft('fullName', event.target.value)}
          required
          value={draft.fullName}
        />
        <TextField
          label="Email address"
          name="email"
          onChange={(event) => updateDraft('email', event.target.value)}
          required
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
          <TextField
            label="Location"
            name="location"
            onChange={(event) => updateDraft('location', event.target.value)}
            value={draft.location}
          />
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
          <p aria-live="polite" className="account-feedback" role="status">
            {feedback}
          </p>
        ) : null}
        <footer>
          <Button onClick={onBack} variant="secondary">
            Cancel
          </Button>
          <Button type="submit">Save changes</Button>
        </footer>
      </form>
    </div>
  );
}
