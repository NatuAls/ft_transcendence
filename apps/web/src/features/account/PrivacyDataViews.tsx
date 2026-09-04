import { Button, TextField } from 'ui';
import { useState } from 'react';
import { AccountHeader } from './AccountHeader';
import type { AccountProfile } from './accountData';

export function PrivacyPage({
  onBack,
  onDelete,
  onExport,
  onPrivacyPolicy,
  onProfile,
  onTerms,
}: {
  onBack: () => void;
  onDelete: () => void;
  onExport: () => void;
  onPrivacyPolicy: () => void;
  onProfile: () => void;
  onTerms: () => void;
}) {
  return (
    <div className="account-page">
      <button className="account-back" onClick={onBack} type="button">
        ‹ Account
      </button>
      <AccountHeader
        description="Control your personal information and understand how it is handled."
        title="Privacy & data"
      />
      <div className="account-tabs">
        <button onClick={onProfile} type="button">
          Profile
        </button>
        <span>Privacy &amp; data</span>
      </div>
      <div className="privacy-grid">
        <main>
          <section className="privacy-card">
            <i aria-hidden="true">↓</i>
            <div>
              <h2>Export your personal data</h2>
              <p>
                Request a portable archive containing your profile, connections,
                conversations and ticket activity.
              </p>
              <small>LAST EXPORT · No export requested</small>
            </div>
            <Button onClick={onExport} variant="secondary">
              Request export
            </Button>
          </section>
          <section className="privacy-card privacy-card--danger">
            <i aria-hidden="true">!</i>
            <div>
              <h2>Delete your account</h2>
              <p>
                Permanently remove your account and personal data. This action
                cannot be undone.
              </p>
              <small>Email confirmation required</small>
            </div>
            <Button onClick={onDelete} variant="destructive">
              Delete account
            </Button>
          </section>
          <section className="legal-card">
            <h2>Legal documents</h2>
            <p>Review the policies that govern the service.</p>
            <button onClick={onPrivacyPolicy} type="button">
              <strong>Privacy Policy</strong>
              <small>How personal data is handled</small>
              <span aria-hidden="true">→</span>
            </button>
            <button onClick={onTerms} type="button">
              <strong>Terms of Service</strong>
              <small>Rules for using the platform</small>
              <span aria-hidden="true">→</span>
            </button>
          </section>
        </main>
        <aside>
          <h2>Your privacy at a glance</h2>
          {[
            ['Authorization', 'Access is checked by the backend.'],
            ['Data scope', 'Exports include only your own data.'],
            ['Confirmation', 'Sensitive requests require email.'],
          ].map(([title, description]) => (
            <div key={title}>
              <i aria-hidden="true">✓</i>
              <p>
                <strong>{title}</strong>
                <small>{description}</small>
              </p>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

function FlowPage({
  backLabel = 'Privacy & data',
  children,
  onBack,
  subtitle,
  title,
}: {
  backLabel?: string;
  children: React.ReactNode;
  onBack: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="account-flow">
      <button className="account-back" onClick={onBack} type="button">
        ‹ {backLabel}
      </button>
      <section>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
      </section>
    </div>
  );
}

export function ExportRequested({
  onBack,
  onConfirm,
}: {
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <FlowPage
      onBack={onBack}
      subtitle="A production request requires confirmation by email."
      title="Confirm your data export"
    >
      <div className="flow-notice">
        <strong>Backend confirmation required</strong>
        <span>
          No email is sent by this frontend preview. The production API must
          create and authorize the export request.
        </span>
      </div>
      <dl>
        <dt>Export contents</dt>
        <dd>Profile, connections, conversations and ticket activity.</dd>
        <dt>Format</dt>
        <dd>ZIP archive containing readable JSON files</dd>
      </dl>
      <footer>
        <Button onClick={onBack} variant="secondary">
          Cancel request
        </Button>
        <Button onClick={onConfirm}>Preview confirmed state</Button>
      </footer>
    </FlowPage>
  );
}

export function ExportReady({
  onBack,
  profile,
}: {
  onBack: () => void;
  profile: AccountProfile;
}) {
  function downloadPreview() {
    const data = JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        profile,
        preview: true,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([data], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'helpdesk-lite-profile-preview.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <FlowPage
      onBack={onBack}
      subtitle="This sample file demonstrates the download interaction."
      title="Your preview archive is ready"
    >
      <div className="archive-card">
        <strong>✓ Frontend preview generated</strong>
        <span>helpdesk-lite-profile-preview.json</span>
      </div>
      <div className="flow-notice">
        <strong>Production boundary</strong>
        <span>
          The backend must generate the complete private archive and a
          short-lived authorized download URL.
        </span>
      </div>
      <footer>
        <Button onClick={onBack} variant="secondary">
          Back to privacy
        </Button>
        <Button onClick={downloadPreview}>Download preview</Button>
      </footer>
    </FlowPage>
  );
}

export function DeleteAccount({
  deletionText,
  onBack,
  onChange,
}: {
  deletionText: string;
  onBack: () => void;
  onChange: (value: string) => void;
}) {
  const [feedback, setFeedback] = useState('');
  return (
    <FlowPage
      onBack={onBack}
      subtitle="This permanently removes your account and personal data."
      title="Delete your account?"
    >
      <p>
        Organization-owned records may be retained only where legally or
        operationally required.
      </p>
      <TextField
        label="Type DELETE to continue"
        onChange={(event) => onChange(event.target.value)}
        placeholder="DELETE"
        value={deletionText}
      />
      <div className="flow-notice">
        <span>
          Production deletion starts only after the backend sends and verifies
          an email confirmation link.
        </span>
      </div>
      {feedback ? (
        <p aria-live="polite" className="account-feedback" role="status">
          {feedback}
        </p>
      ) : null}
      <footer>
        <Button onClick={onBack} variant="secondary">
          Cancel
        </Button>
        <Button
          disabled={deletionText !== 'DELETE'}
          onClick={() =>
            setFeedback(
              'Deletion request is ready for the backend; no account was deleted.',
            )
          }
          variant="destructive"
        >
          Prepare confirmation request
        </Button>
      </footer>
    </FlowPage>
  );
}
