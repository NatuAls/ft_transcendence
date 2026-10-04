import { Alert, Button, Icon, LoadingState, Tabs, TextField } from 'ui';
import { useCallback, useEffect, useState } from 'react';
import { AccountHeader } from './AccountHeader';
import type { AccountProfile } from './accountData';
import {
  confirmDeletion,
  confirmExport,
  downloadExport,
  listRequests,
  requestDeletion,
  requestExport,
  type GdprRequest,
} from '../../api/gdpr';

// =============================================================================
//  Privacy & data — connected to the GDPR endpoints.
//
//  Until now these three screens were a mock: they rendered the flow and
//  produced a sample JSON in the browser. The API has had the whole thing for
//  a while (request, e-mail confirmation, ZIP archive, deletion with a second
//  factor), so the only thing missing was this file.
//
//  The shape of the flow is not ours to choose, it is what the API enforces:
//
//      POST /gdpr/export            -> e-mails a token, 30 minutes
//      POST /gdpr/export/confirm    -> starts building the archive
//      GET  /gdpr/export/:id/download
//
//      POST /gdpr/delete            -> e-mails a token
//      POST /gdpr/delete/confirm    -> token AND your own username
//
//  Two details worth keeping in mind when touching this:
//
//    · The confirmation token arrives in the URL of the e-mail link, so these
//      screens accept it as a prop and pre-fill the field. The field stays
//      editable because a mail client may cut a long link, and then copying
//      the token by hand is the only way through.
//    · The archive is built in the background. The ready screen polls instead
//      of assuming, and gives up after two minutes rather than spinning for
//      ever.
// =============================================================================

const POLL_MS = 3000;
const POLL_GIVE_UP_MS = 120_000;

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function latestOf(
  requests: GdprRequest[],
  type: GdprRequest['type'],
): GdprRequest | undefined {
  // The API already returns them newest first.
  return requests.find((request) => request.type === type);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

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
  const [requests, setRequests] = useState<GdprRequest[] | null>(null);
  const [error, setError] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    void listRequests()
      .then(setRequests)
      .catch(() => setRequests([]));
  }, []);

  const lastExport = requests ? latestOf(requests, 'EXPORT') : undefined;
  const pendingExport =
    lastExport?.status === 'AWAITING_CONFIRMATION' ? lastExport : undefined;
  const completedExport =
    lastExport?.status === 'COMPLETED' ? lastExport : undefined;

  async function startExport() {
    // An export already waiting for its token does not need another e-mail:
    // asking again would only be refused by the API, which rejects a second
    // pending request of the same type.
    if (pendingExport) {
      onExport();
      return;
    }
    setIsWorking(true);
    setError('');
    try {
      await requestExport();
      onExport();
    } catch (requestError) {
      setError(messageOf(requestError, 'The export could not be requested.'));
    } finally {
      setIsWorking(false);
    }
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
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <section className="grid grid-cols-[34px_1fr_auto] gap-3 rounded-md border border-border bg-surface p-[22px] max-md:grid-cols-[34px_1fr] max-md:p-4 max-md:[&_.ui-button]:col-span-full">
            <i
              className="grid size-8 place-items-center rounded-[9px] bg-success-surface text-success not-italic"
              aria-hidden="true"
            >
              ↓
            </i>
            <div>
              <h2 className="text-base font-medium">
                Export your personal data
              </h2>
              <p className="text-xs2 text-muted">
                Request a portable archive containing your profile, connections,
                conversations and ticket activity. We e-mail you a confirmation
                link before anything is built.
              </p>
              <small className="text-3xs text-muted uppercase">
                {pendingExport
                  ? 'Waiting for your e-mail confirmation'
                  : completedExport
                    ? `Last export · ${formatDate(completedExport.completedAt)}`
                    : 'Last export · No export requested'}
              </small>
            </div>
            <Button
              className="self-center"
              disabled={isWorking}
              onClick={() => void startExport()}
              size="compact"
              variant="secondary"
            >
              {pendingExport
                ? 'Continue export'
                : isWorking
                  ? 'Requesting…'
                  : 'Request export'}
            </Button>
          </section>
          <section className="grid grid-cols-[34px_1fr_auto] gap-3 rounded-md border border-border bg-surface p-[22px] max-md:grid-cols-[34px_1fr] max-md:p-4 max-md:[&_.ui-button]:col-span-full">
            <i
              className="grid size-8 place-items-center rounded-[9px] bg-danger-surface text-danger not-italic"
              aria-hidden="true"
            >
              !
            </i>
            <div>
              <h2 className="text-base font-medium">Delete your account</h2>
              <p className="text-xs2 text-muted">
                Permanently remove your account and personal data. This action
                cannot be undone.
              </p>
              <small className="text-3xs text-muted">
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
            <p className="text-xs2 text-muted">
              Review the policies that govern the service.
            </p>
            <button
              className="grid w-full grid-cols-[1fr_auto] border-t border-border py-[14px] text-left"
              onClick={onPrivacyPolicy}
              type="button"
            >
              <strong className="block">Privacy Policy</strong>
              <small className="block text-2xs text-muted">
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
              <small className="block text-2xs text-muted">
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
          <h2 className="text-[0.9375rem] font-medium">
            Your privacy at a glance
          </h2>
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
                <strong className="text-xs2">{title}</strong>
                <small className="text-3xs text-muted">{description}</small>
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
  token = '',
}: {
  onBack: () => void;
  onConfirm: () => void;
  token?: string;
}) {
  const [value, setValue] = useState(token);
  const [error, setError] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  async function confirm() {
    setIsWorking(true);
    setError('');
    try {
      await confirmExport(value.trim());
      onConfirm();
    } catch (confirmError) {
      setError(
        messageOf(
          confirmError,
          'That confirmation code is not valid any more. Request the export again.',
        ),
      );
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <FlowPage
      onBack={onBack}
      subtitle="We have sent a confirmation link to your e-mail address. Nothing is built until you confirm."
      title="Confirm your data export"
    >
      <Alert tone="info" title="Check your inbox">
        The link is valid for 30 minutes. Opening it brings you back here with
        the code already filled in; if your mail client broke the link, paste
        the code by hand.
      </Alert>
      <TextField
        autoComplete="off"
        label="Confirmation code"
        onChange={(event) => setValue(event.target.value)}
        placeholder="Paste the code from the e-mail"
        value={value}
      />
      <dl className="grid gap-2 text-xs2 [&_dt]:font-medium [&_dd]:mb-2 [&_dd]:text-muted">
        <dt>Export contents</dt>
        <dd>Profile, connections, conversations and ticket activity.</dd>
        <dt>Format</dt>
        <dd>ZIP archive containing readable JSON files</dd>
      </dl>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <footer>
        <Button onClick={onBack} variant="secondary">
          Cancel request
        </Button>
        <Button
          disabled={value.trim().length < 20 || isWorking}
          onClick={() => void confirm()}
        >
          {isWorking ? 'Confirming…' : 'Confirm export'}
        </Button>
      </footer>
    </FlowPage>
  );
}

export function ExportReady({ onBack }: { onBack: () => void }) {
  const [request, setRequest] = useState<GdprRequest | null>(null);
  const [error, setError] = useState('');
  const [timedOut, setTimedOut] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const load = useCallback(async () => {
    const requests = await listRequests();
    const latest = latestOf(requests, 'EXPORT') ?? null;
    setRequest(latest);
    return latest;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    async function tick() {
      try {
        const latest = await load();
        if (cancelled) return;
        if (latest?.status === 'COMPLETED' || latest?.status === 'FAILED') {
          window.clearInterval(timer);
          return;
        }
        if (Date.now() - startedAt > POLL_GIVE_UP_MS) {
          window.clearInterval(timer);
          setTimedOut(true);
        }
      } catch {
        if (!cancelled) setError('Unable to read the state of your export.');
      }
    }

    void tick();
    const timer = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [load]);

  async function download() {
    if (!request) return;
    setIsDownloading(true);
    setError('');
    try {
      await downloadExport(request.id);
    } catch (downloadError) {
      setError(
        messageOf(downloadError, 'The archive could not be downloaded.'),
      );
    } finally {
      setIsDownloading(false);
    }
  }

  const isReady = request?.status === 'COMPLETED';
  const hasFailed = request?.status === 'FAILED';

  return (
    <FlowPage
      onBack={onBack}
      subtitle={
        isReady
          ? 'Your archive is ready. The link expires, so download it now.'
          : 'Your archive is being built. This page updates on its own.'
      }
      title={isReady ? 'Your archive is ready' : 'Preparing your archive'}
    >
      {hasFailed ? (
        <Alert tone="danger" title="The export failed">
          Nothing was produced. Request the export again, and if it keeps
          failing, contact support.
        </Alert>
      ) : isReady ? (
        <div className="grid gap-1.5 rounded-sm bg-surface-secondary p-4 text-xs">
          <strong>✓ Archive generated</strong>
          <span className="text-xs2 text-muted">
            Requested {formatDate(request.requestedAt)} · available until{' '}
            {formatDate(request.expiresAt)}
          </span>
        </div>
      ) : timedOut ? (
        <Alert tone="warning" title="This is taking longer than usual">
          The archive is still being built. Come back to Privacy &amp; data in a
          few minutes; the download appears here when it is ready.
        </Alert>
      ) : (
        <LoadingState label="Building your archive" />
      )}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <footer>
        <Button onClick={onBack} variant="secondary">
          Back to privacy
        </Button>
        <Button
          disabled={!isReady || isDownloading}
          onClick={() => void download()}
        >
          {isDownloading ? 'Downloading…' : 'Download archive'}
        </Button>
      </footer>
    </FlowPage>
  );
}

export function DeleteAccount({
  onBack,
  onDeleted,
  profile,
  token = '',
}: {
  onBack: () => void;
  onDeleted: () => void;
  profile: AccountProfile;
  token?: string;
}) {
  // Arriving from the e-mail link means the request already exists: start at
  // the confirmation step instead of asking for a second e-mail.
  const [step, setStep] = useState<'request' | 'confirm'>(
    token ? 'confirm' : 'request',
  );
  const [code, setCode] = useState(token);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  async function sendEmail() {
    setIsWorking(true);
    setError('');
    try {
      await requestDeletion();
      setStep('confirm');
    } catch (requestError) {
      setError(
        messageOf(requestError, 'The confirmation e-mail could not be sent.'),
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function confirm() {
    setIsWorking(true);
    setError('');
    try {
      await confirmDeletion(code.trim(), username.trim());
      // The account no longer exists: the session has to go with it.
      onDeleted();
    } catch (confirmError) {
      setError(
        messageOf(
          confirmError,
          'The account was not deleted. Check the code and the username.',
        ),
      );
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <FlowPage
      onBack={onBack}
      subtitle="This permanently removes your account and personal data."
      title="Delete your account?"
    >
      <p className="text-sm">
        Your profile, sessions, notifications and private messages are deleted.
        Content other people still depend on — comments on their tickets — is
        anonymised instead of removed, which is what the regulation allows and
        what keeps their records readable.
      </p>

      {step === 'request' ? (
        <>
          <Alert tone="warning" title="Two confirmations are required">
            First we e-mail you a confirmation code. Then you type that code and
            your own username. Nothing is deleted before both.
          </Alert>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <footer>
            <Button onClick={onBack} variant="secondary">
              Cancel
            </Button>
            <Button
              disabled={isWorking}
              onClick={() => void sendEmail()}
              variant="destructive"
            >
              {isWorking ? 'Sending…' : 'E-mail me the confirmation code'}
            </Button>
          </footer>
        </>
      ) : (
        <>
          <Alert tone="danger" title="This cannot be undone">
            Once confirmed, the account and its personal data are gone. There is
            no recovery, not even from a backup: restoring one would bring other
            people's data back with it.
          </Alert>
          <TextField
            autoComplete="off"
            label="Confirmation code from the e-mail"
            onChange={(event) => setCode(event.target.value)}
            placeholder="Paste the code from the e-mail"
            value={code}
          />
          <TextField
            autoComplete="off"
            label="Type your username to confirm"
            onChange={(event) => setUsername(event.target.value)}
            placeholder={profile.username}
            value={username}
          />
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <footer>
            <Button onClick={onBack} variant="secondary">
              Cancel
            </Button>
            <Button
              disabled={
                isWorking || code.trim().length < 20 || username.trim() === ''
              }
              onClick={() => void confirm()}
              variant="destructive"
            >
              {isWorking ? 'Deleting…' : 'Delete my account permanently'}
            </Button>
          </footer>
        </>
      )}
    </FlowPage>
  );
}
