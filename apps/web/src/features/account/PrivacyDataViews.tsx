import { Alert, Button, Icon, Tabs, TextField } from 'ui';
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
    <div className="mx-auto max-w-[1040px] p-10 max-md:px-4 max-md:py-6">
      <button
        className="mb-[18px] hidden text-primary max-md:block"
        onClick={onBack}
        type="button"
      >
        ‹ Account
      </button>
      <AccountHeader
        description="Control your personal information and understand how it is handled."
        title="Privacy & data"
      />
      <div className="mt-[26px] border-b border-border max-md:hidden">
        <Tabs
          activeTab="privacy"
          items={[
            { id: 'profile', label: 'Profile' },
            { id: 'privacy', label: 'Privacy & data' },
          ]}
          label="Account sections"
          onChange={(tab) => {
            if (tab === 'profile') onProfile();
          }}
        />
      </div>
      <div className="mt-[22px] grid grid-cols-[1fr_270px] gap-[18px] max-md:block">
        <main className="grid gap-[14px]">
          <section className="grid grid-cols-[34px_1fr_auto] gap-3 rounded-md border border-border bg-surface p-[22px] max-md:grid-cols-[34px_1fr] max-md:p-4 max-md:[&_.ui-button]:col-span-full">
            <i
              className="grid size-8 place-items-center rounded-[9px] bg-[#e1ece5] text-success not-italic"
              aria-hidden="true"
            >
              ↓
            </i>
            <div>
              <h2 className="text-base font-medium">
                Export your personal data
              </h2>
              <p className="text-[11px] text-muted">
                Request a portable archive containing your profile, connections,
                conversations and ticket activity.
              </p>
              <small className="text-[9px] text-muted">
                LAST EXPORT · No export requested
              </small>
            </div>
            <Button
              className="self-center"
              onClick={onExport}
              size="compact"
              variant="secondary"
            >
              Request export
            </Button>
          </section>
          <section className="grid grid-cols-[34px_1fr_auto] gap-3 rounded-md border border-border bg-surface p-[22px] max-md:grid-cols-[34px_1fr] max-md:p-4 max-md:[&_.ui-button]:col-span-full">
            <i
              className="grid size-8 place-items-center rounded-[9px] bg-[#f1e3e3] text-danger not-italic"
              aria-hidden="true"
            >
              !
            </i>
            <div>
              <h2 className="text-base font-medium">Delete your account</h2>
              <p className="text-[11px] text-muted">
                Permanently remove your account and personal data. This action
                cannot be undone.
              </p>
              <small className="text-[9px] text-muted">
                Email confirmation required
              </small>
            </div>
            <Button
              className="self-center"
              onClick={onDelete}
              size="compact"
              variant="destructive"
            >
              Delete account
            </Button>
          </section>
          <section className="rounded-md border border-border bg-surface p-[22px] max-md:mt-[14px]">
            <h2 className="text-base font-medium">Legal documents</h2>
            <p className="text-[11px] text-muted">
              Review the policies that govern the service.
            </p>
            <button
              className="grid w-full grid-cols-[1fr_auto] border-t border-border py-[14px] text-left"
              onClick={onPrivacyPolicy}
              type="button"
            >
              <strong className="block">Privacy Policy</strong>
              <small className="block text-[10px] text-muted">
                How personal data is handled
              </small>
              <Icon
                className="col-start-2 row-span-2"
                name="chevron-right"
                size={18}
              />
            </button>
            <button
              className="grid w-full grid-cols-[1fr_auto] border-t border-border py-[14px] text-left"
              onClick={onTerms}
              type="button"
            >
              <strong className="block">Terms of Service</strong>
              <small className="block text-[10px] text-muted">
                Rules for using the platform
              </small>
              <Icon
                className="col-start-2 row-span-2"
                name="chevron-right"
                size={18}
              />
            </button>
          </section>
        </main>
        <aside className="rounded-md border border-border bg-surface p-[22px] max-md:hidden">
          <h2 className="text-[15px] font-medium">Your privacy at a glance</h2>
          {[
            ['Authorization', 'Access is checked by the backend.'],
            ['Data scope', 'Exports include only your own data.'],
            ['Confirmation', 'Sensitive requests require email.'],
          ].map(([title, description]) => (
            <div className="mt-5 flex gap-2.5" key={title}>
              <i className="text-success" aria-hidden="true">
                ✓
              </i>
              <p className="grid gap-1">
                <strong className="text-[11px]">{title}</strong>
                <small className="text-[9px] text-muted">{description}</small>
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
    <div className="mx-auto max-w-[660px] p-10 max-md:px-4 max-md:py-6">
      <button
        className="mb-6 block text-primary max-md:mb-[18px]"
        onClick={onBack}
        type="button"
      >
        ‹ {backLabel}
      </button>
      <section className="grid gap-[18px] rounded-lg border border-border bg-surface p-[30px] max-md:px-[18px] max-md:py-[22px] [&>footer]:flex [&>footer]:justify-end [&>footer]:gap-2 [&>footer]:border-t [&>footer]:border-border [&>footer]:pt-[18px] max-md:[&>footer]:flex-col-reverse max-md:[&>footer_.ui-button]:w-full">
        <h1 className="text-2xl font-medium">{title}</h1>
        <p className="text-xs text-muted">{subtitle}</p>
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
      <div className="grid gap-1.5 rounded-sm bg-surface-secondary p-4 text-xs">
        <strong>Backend confirmation required</strong>
        <span className="text-[11px] text-muted">
          No email is sent by this frontend preview. The production API must
          create and authorize the export request.
        </span>
      </div>
      <dl className="grid gap-2 text-[11px] [&_dt]:font-medium [&_dd]:mb-2 [&_dd]:text-muted">
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
      <div className="grid gap-1.5 rounded-sm bg-surface-secondary p-4 text-xs">
        <strong>✓ Frontend preview generated</strong>
        <span className="text-[11px] text-muted">
          helpdesk-lite-profile-preview.json
        </span>
      </div>
      <div className="grid gap-1.5 rounded-sm bg-surface-secondary p-4 text-xs">
        <strong>Production boundary</strong>
        <span className="text-[11px] text-muted">
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
      <div className="grid gap-1.5 rounded-sm bg-surface-secondary p-4 text-xs">
        <span className="text-[11px] text-muted">
          Production deletion starts only after the backend sends and verifies
          an email confirmation link.
        </span>
      </div>
      {feedback ? (
        <Alert aria-live="polite" role="status">
          {feedback}
        </Alert>
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
