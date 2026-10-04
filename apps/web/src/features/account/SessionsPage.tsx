import { Alert, Button, Dialog, EmptyState, LoadingState } from 'ui';
import { useEffect, useState } from 'react';
import {
  listSessions,
  revokeSession,
  signOutEverywhere,
  type DeviceSession,
} from '../../api/sessions';
import { previewMode } from '../../app/session';
import { AccountHeader } from './AccountHeader';

const dateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** "Chrome on macOS" from a user agent: enough to recognise a device. */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Firefox\//.test(userAgent)
      ? 'Firefox'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : /curl|node|axios|python/i.test(userAgent)
            ? 'Script or command line'
            : 'Browser';
  const system = /Android/.test(userAgent)
    ? 'Android'
    : /iPhone|iPad/.test(userAgent)
      ? 'iOS'
      : /Mac OS X/.test(userAgent)
        ? 'macOS'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : '';
  return system ? `${browser} on ${system}` : browser;
}

const previewSessions: DeviceSession[] = [
  {
    createdAt: '2026-10-01T08:12:00.000Z',
    current: true,
    expiresAt: '2026-10-08T08:12:00.000Z',
    id: 'preview-session-1',
    ip: '83.45.120.0',
    lastUsedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
  },
  {
    createdAt: '2026-09-29T17:40:00.000Z',
    current: false,
    expiresAt: '2026-10-06T17:40:00.000Z',
    id: 'preview-session-2',
    ip: '81.33.9.0',
    lastUsedAt: '2026-10-02T21:05:00.000Z',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  },
];

/**
 * Every device signed in to the account, with a way to close any of them.
 * The Terms of Service promise exactly this ("you can review and revoke your
 * active sessions at any time"), and the API had it; the screen did not.
 */
export function SessionsPage({
  onBack,
  onSignedOut,
}: {
  onBack: () => void;
  onSignedOut: () => void;
}) {
  const [sessions, setSessions] = useState<DeviceSession[]>(
    previewMode ? previewSessions : [],
  );
  const [loading, setLoading] = useState(!previewMode);
  const [feedback, setFeedback] = useState('');
  const [failure, setFailure] = useState('');
  const [busyId, setBusyId] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (previewMode) return;
    let active = true;
    listSessions()
      .then((rows) => {
        if (active) setSessions(rows);
      })
      .catch((error: unknown) => {
        if (active)
          setFailure(
            error instanceof Error
              ? error.message
              : 'The sessions could not be read.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [version]);

  async function revoke(session: DeviceSession) {
    setBusyId(session.id);
    setFeedback('');
    setFailure('');
    try {
      if (previewMode)
        setSessions((current) =>
          current.filter((row) => row.id !== session.id),
        );
      else await revokeSession(session.id);
      setFeedback(
        `${describeDevice(session.userAgent)} was signed out. It has to sign in again to come back.`,
      );
      setVersion((current) => current + 1);
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : 'The device could not be signed out.',
      );
    } finally {
      setBusyId('');
    }
  }

  async function revokeAll() {
    setConfirmAll(false);
    try {
      if (!previewMode) await signOutEverywhere();
    } finally {
      onSignedOut();
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
        description="Every device signed in to your account. Sign out the ones you do not recognise."
        title="Sessions & devices"
      />
      {feedback ? (
        <Alert aria-live="polite" className="mt-5" role="status" tone="success">
          {feedback}
        </Alert>
      ) : null}
      {failure ? (
        <Alert className="mt-5" tone="danger">
          {failure}
        </Alert>
      ) : null}
      <section className="mt-6 overflow-hidden rounded-md border border-border bg-surface">
        {loading ? (
          <LoadingState label="Loading sessions" />
        ) : sessions.length ? (
          <ul>
            {sessions.map((session) => (
              <li
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-border p-5 first:border-t-0 max-md:p-4"
                key={session.id}
              >
                <div className="grid min-w-0 gap-1">
                  <strong className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {describeDevice(session.userAgent)}
                    {session.current ? (
                      <span className="rounded-full bg-success-surface px-2.5 py-0.5 text-xs font-medium text-success">
                        This device
                      </span>
                    ) : null}
                  </strong>
                  <small className="text-xs text-muted">
                    Signed in {dateTime.format(new Date(session.createdAt))}
                    {' · '}last active{' '}
                    {dateTime.format(new Date(session.lastUsedAt))}
                    {session.ip ? ` · ${session.ip}` : ''}
                  </small>
                </div>
                {session.current ? (
                  <span className="text-xs text-muted">Current</span>
                ) : (
                  <Button
                    aria-label={`Sign out ${describeDevice(session.userAgent)}`}
                    disabled={busyId === session.id}
                    onClick={() => void revoke(session)}
                    size="compact"
                    variant="secondary"
                  >
                    Sign out
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState
              description="Reload the page if you have just signed in."
              title="No active sessions"
            />
          </div>
        )}
      </section>
      <section className="mt-5 flex items-center justify-between gap-4 rounded-md border border-border bg-surface p-5 max-md:grid">
        <div>
          <h2 className="text-base font-medium">Sign out everywhere</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Closes every session, this one included. Use it if you think
            somebody else has access to your account, then change your password.
          </p>
        </div>
        <Button onClick={() => setConfirmAll(true)} variant="destructive">
          Sign out everywhere
        </Button>
      </section>
      {confirmAll ? (
        <Dialog
          description="Every device, this one included, will have to sign in again."
          eyebrow="SESSIONS"
          footer={
            <>
              <Button onClick={() => setConfirmAll(false)} variant="secondary">
                Cancel
              </Button>
              <Button type="submit" variant="destructive">
                Sign out everywhere
              </Button>
            </>
          }
          onClose={() => setConfirmAll(false)}
          onSubmit={(event) => {
            event.preventDefault();
            void revokeAll();
          }}
          title="Sign out of every device?"
        />
      ) : null}
    </div>
  );
}
