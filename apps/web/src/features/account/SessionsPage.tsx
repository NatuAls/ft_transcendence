import { Alert, Button, Dialog, LoadingState } from 'ui';
import { useState } from 'react';
import { AsyncState } from '../../core/async/AsyncState';
import { useAsync } from '../../core/async/useAsync';
import { errorKey } from '../../core/api/errors';
import { useTranslation } from '../../core/i18n';
import {
  listSessions,
  revokeSession,
  signOutEverywhere,
  type DeviceSession,
} from '../../api/sessions';
import { previewMode } from '../../app/session';
import { AccountHeader } from './AccountHeader';

/** Recognises a device from its user agent and translates its description. */
function browserAndSystem(userAgent: string | null) {
  if (!userAgent) return { browser: 'unknown', system: '' };
  const browser = /Edg\//.test(userAgent)
    ? 'edge'
    : /Firefox\//.test(userAgent)
      ? 'firefox'
      : /Chrome\//.test(userAgent)
        ? 'chrome'
        : /Safari\//.test(userAgent)
          ? 'safari'
          : /curl|node|axios|python/i.test(userAgent)
            ? 'script'
            : 'browser';
  const system = /Android/.test(userAgent)
    ? 'android'
    : /iPhone|iPad/.test(userAgent)
      ? 'ios'
      : /Mac OS X/.test(userAgent)
        ? 'macos'
        : /Windows/.test(userAgent)
          ? 'windows'
          : /Linux/.test(userAgent)
            ? 'linux'
            : '';
  return { browser, system };
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
  const { t, i18n } = useTranslation();
  const dateTime = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const describeDevice = (userAgent: string | null) => {
    const { browser, system } = browserAndSystem(userAgent);
    return system
      ? t('account.sessions.device', {
          browser: t(`account.sessions.browsers.${browser}`),
          system: t(`account.sessions.systems.${system}`),
        })
      : t(`account.sessions.browsers.${browser}`);
  };
  const [feedback, setFeedback] = useState('');
  const [failure, setFailure] = useState('');
  const [busyId, setBusyId] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);

  const devices = useAsync(
    (signal) =>
      previewMode ? Promise.resolve(previewSessions) : listSessions(signal),
    [],
  );
  const sessions = devices.data ?? [];

  async function revoke(session: DeviceSession) {
    setBusyId(session.id);
    setFeedback('');
    setFailure('');
    try {
      if (previewMode) {
        // En vista previa no hay servidor al que volver a preguntar: la fila
        // se quita en local y ya está.
        devices.setData((current) =>
          (current ?? []).filter((row) => row.id !== session.id),
        );
      } else {
        await revokeSession(session.id);
      }
      setFeedback(
        t('account.sessions.revoked', {
          device: describeDevice(session.userAgent),
        }),
      );
      if (!previewMode) devices.reload();
    } catch (error) {
      setFailure(t(errorKey(error)));
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
        {t('account.back')}
      </button>
      <AccountHeader
        description={t('account.sessions.description')}
        title={t('account.sessions.title')}
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
        <AsyncState
          emptyDescription={t('account.sessions.emptyDescription')}
          emptyTitle={t('account.sessions.emptyTitle')}
          error={devices.error}
          errorTitle={t('account.sessions.errorTitle')}
          isEmpty={!sessions.length}
          loading={<LoadingState label={t('account.sessions.loading')} />}
          onRetry={devices.reload}
          status={devices.status}
        >
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
                        {t('account.sessions.thisDevice')}
                      </span>
                    ) : null}
                  </strong>
                  <small className="text-xs text-muted">
                    {t('account.sessions.activity', {
                      signedIn: dateTime.format(new Date(session.createdAt)),
                      lastActive: dateTime.format(new Date(session.lastUsedAt)),
                      ip: session.ip
                        ? t('account.sessions.ip', { ip: session.ip })
                        : '',
                    })}
                  </small>
                </div>
                {session.current ? (
                  <span className="text-xs text-muted">
                    {t('account.sessions.current')}
                  </span>
                ) : (
                  <Button
                    aria-label={t('account.sessions.signOutDevice', {
                      device: describeDevice(session.userAgent),
                    })}
                    disabled={busyId === session.id}
                    onClick={() => void revoke(session)}
                    size="compact"
                    variant="secondary"
                  >
                    {t('common.actions.signOut')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </AsyncState>
      </section>
      <section className="mt-5 flex items-center justify-between gap-4 rounded-md border border-border bg-surface p-5 max-md:grid">
        <div>
          <h2 className="text-base font-medium">
            {t('account.sessions.signOutEverywhere')}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            {t('account.sessions.signOutEverywhereDescription')}
          </p>
        </div>
        <Button onClick={() => setConfirmAll(true)} variant="destructive">
          {t('account.sessions.signOutEverywhere')}
        </Button>
      </section>
      {confirmAll ? (
        <Dialog
          description={t('account.sessions.confirmDescription')}
          eyebrow={t('account.sessions.eyebrow')}
          footer={
            <>
              <Button onClick={() => setConfirmAll(false)} variant="secondary">
                {t('common.actions.cancel')}
              </Button>
              <Button type="submit" variant="destructive">
                {t('account.sessions.signOutEverywhere')}
              </Button>
            </>
          }
          onClose={() => setConfirmAll(false)}
          onSubmit={(event) => {
            event.preventDefault();
            void revokeAll();
          }}
          title={t('account.sessions.confirmTitle')}
        />
      ) : null}
    </div>
  );
}
