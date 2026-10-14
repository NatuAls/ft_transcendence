import { Alert, Button, Icon, LoadingState, Tabs, TextField } from 'ui';
import { useEffect, useState } from 'react';
import { AccountHeader } from './AccountHeader';
import type { AccountProfile } from './accountData';
import { AsyncState } from '../../core/async/AsyncState';
import { useAsync } from '../../core/async/useAsync';
import { errorKey } from '../../core/api/errors';
import { useTranslation } from '../../core/i18n';
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

function latestOf(
  requests: GdprRequest[],
  type: GdprRequest['type'],
): GdprRequest | undefined {
  // The API already returns them newest first.
  return requests.find((request) => request.type === type);
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
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
  const { t, i18n } = useTranslation();
  const [error, setError] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  // La lista acompaña, no es el contenido de la pantalla: si falla, las dos
  // acciones siguen estando, así que no se tapa todo con un estado de error.
  // Lo que no se hace es tragarse el fallo en silencio, como antes.
  const requests = useAsync((signal) => listRequests(signal), []);
  const lastExport = requests.data
    ? latestOf(requests.data, 'EXPORT')
    : undefined;
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
      requests.reload();
      onExport();
    } catch (requestError) {
      setError(t(errorKey(requestError)));
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
        {t('account.back')}
      </button>
      <AccountHeader
        description={t('account.privacy.description')}
        title={t('account.privacy.title')}
      />
      <div className="mt-[26px] border-b border-border max-md:hidden">
        <Tabs
          activeTab="privacy"
          items={[
            { id: 'profile', label: t('account.profile.tabProfile') },
            { id: 'privacy', label: t('account.profile.tabPrivacy') },
          ]}
          label={t('account.profile.sections')}
          onChange={(tab) => {
            if (tab === 'profile') onProfile();
          }}
        />
      </div>
      <div className="mt-[22px] grid grid-cols-[1fr_270px] gap-[18px] max-md:block">
        <main className="grid gap-[14px]">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {requests.status === 'error' ? (
            <Alert tone="warning">
              {t('account.privacy.requestsReadError', {
                error: t(errorKey(requests.error)),
              })}{' '}
              <button
                className="underline"
                onClick={requests.reload}
                type="button"
              >
                {t('common.actions.retry')}
              </button>
            </Alert>
          ) : null}
          <section className="grid grid-cols-[34px_1fr_auto] gap-3 rounded-md border border-border bg-surface p-[22px] max-md:grid-cols-[34px_1fr] max-md:p-4 max-md:[&_.ui-button]:col-span-full">
            <i
              className="grid size-8 place-items-center rounded-[9px] bg-success-surface text-success not-italic"
              aria-hidden="true"
            >
              <Icon aria-hidden="true" name="send" size={18} />
            </i>
            <div>
              <h2 className="text-base font-medium">
                {t('account.privacy.export.title')}
              </h2>
              <p className="text-xs2 text-muted">
                {t('account.privacy.export.description')}
              </p>
              <small className="text-3xs text-muted uppercase">
                {requests.status === 'loading'
                  ? t('account.privacy.export.lastChecking')
                  : pendingExport
                    ? t('account.privacy.export.waiting')
                    : completedExport
                      ? t('account.privacy.export.lastCompleted', {
                          date: formatDate(
                            completedExport.completedAt,
                            i18n.language,
                          ),
                        })
                      : t('account.privacy.export.none')}
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
                ? t('account.privacy.export.continue')
                : isWorking
                  ? t('account.privacy.export.requesting')
                  : t('account.privacy.export.request')}
            </Button>
          </section>
          <section className="grid grid-cols-[34px_1fr_auto] gap-3 rounded-md border border-border bg-surface p-[22px] max-md:grid-cols-[34px_1fr] max-md:p-4 max-md:[&_.ui-button]:col-span-full">
            <i
              className="grid size-8 place-items-center rounded-[9px] bg-danger-surface text-danger not-italic"
              aria-hidden="true"
            >
              <Icon aria-hidden="true" name="close" size={18} />
            </i>
            <div>
              <h2 className="text-base font-medium">
                {t('account.privacy.delete.title')}
              </h2>
              <p className="text-xs2 text-muted">
                {t('account.privacy.delete.description')}
              </p>
              <small className="text-3xs text-muted">
                {t('account.privacy.delete.emailRequired')}
              </small>
            </div>
            <Button
              className="self-center"
              onClick={onDelete}
              size="compact"
              variant="destructive"
            >
              {t('account.privacy.delete.action')}
            </Button>
          </section>
          <section className="rounded-md border border-border bg-surface p-[22px] max-md:mt-[14px]">
            <h2 className="text-base font-medium">
              {t('account.privacy.legal.title')}
            </h2>
            <p className="text-xs2 text-muted">
              {t('account.privacy.legal.description')}
            </p>
            <button
              className="grid w-full grid-cols-[1fr_auto] border-t border-border py-[14px] text-left"
              onClick={onPrivacyPolicy}
              type="button"
            >
              <strong className="block">
                {t('account.privacy.legal.privacyTitle')}
              </strong>
              <small className="block text-2xs text-muted">
                {t('account.privacy.legal.privacyDescription')}
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
              <strong className="block">
                {t('account.privacy.legal.termsTitle')}
              </strong>
              <small className="block text-2xs text-muted">
                {t('account.privacy.legal.termsDescription')}
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
            {t('account.privacy.sidebar.title')}
          </h2>
          {[
            [
              t('account.privacy.sidebar.authorization'),
              t('account.privacy.sidebar.authorizationDescription'),
            ],
            [
              t('account.privacy.sidebar.dataScope'),
              t('account.privacy.sidebar.dataScopeDescription'),
            ],
            [
              t('account.privacy.sidebar.confirmation'),
              t('account.privacy.sidebar.confirmationDescription'),
            ],
          ].map(([title, description]) => (
            <div className="mt-5 flex gap-2.5" key={title}>
              <i className="text-success" aria-hidden="true">
                <Icon aria-hidden="true" name="check" size={16} />
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
  backLabel,
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
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-[660px] p-10 max-md:px-4 max-md:py-6">
      <button
        className="mb-6 block text-primary max-md:mb-[18px]"
        onClick={onBack}
        type="button"
      >
        {backLabel ?? t('account.back')}
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
  const { t } = useTranslation();
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
      setError(t(errorKey(confirmError)));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <FlowPage
      onBack={onBack}
      subtitle={t('account.privacy.export.confirmDescription')}
      title={t('account.privacy.export.confirmTitle')}
    >
      <Alert tone="info" title={t('account.privacy.export.checkInbox')}>
        {t('account.privacy.export.confirmHelp')}
      </Alert>
      <TextField
        autoComplete="off"
        label={t('account.privacy.export.confirmationCode')}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t('account.privacy.export.codePlaceholder')}
        value={value}
      />
      <dl className="grid gap-2 text-xs2 [&_dt]:font-medium [&_dd]:mb-2 [&_dd]:text-muted">
        <dt>{t('account.privacy.export.contents')}</dt>
        <dd>{t('account.privacy.export.contentsDescription')}</dd>
        <dt>{t('account.privacy.export.format')}</dt>
        <dd>{t('account.privacy.export.formatDescription')}</dd>
      </dl>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <footer>
        <Button onClick={onBack} variant="secondary">
          {t('account.privacy.export.cancel')}
        </Button>
        <Button
          disabled={value.trim().length < 20 || isWorking}
          onClick={() => void confirm()}
        >
          {isWorking
            ? t('account.privacy.export.confirming')
            : t('account.privacy.export.confirm')}
        </Button>
      </footer>
    </FlowPage>
  );
}

export function ExportReady({ onBack }: { onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const [error, setError] = useState('');
  const [timedOut, setTimedOut] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // La carga es la del resto de la aplicación; lo único propio de esta
  // pantalla es que el archivo se construye en segundo plano, así que
  // insiste hasta que termine. El sondeo es un `reload()` cada tres
  // segundos, no otro mecanismo de carga en paralelo.
  const latest = useAsync(
    async (signal) => latestOf(await listRequests(signal), 'EXPORT') ?? null,
    [],
  );
  const request = latest.data ?? null;

  useEffect(() => {
    if (
      timedOut ||
      request?.status === 'COMPLETED' ||
      request?.status === 'FAILED'
    ) {
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - startedAt > POLL_GIVE_UP_MS) {
        window.clearInterval(timer);
        setTimedOut(true);
        return;
      }
      latest.reload();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [request?.status, timedOut, latest]);

  async function download() {
    if (!request) return;
    setIsDownloading(true);
    setError('');
    try {
      await downloadExport(request.id);
    } catch (downloadError) {
      setError(t(errorKey(downloadError)));
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
          ? t('account.privacy.export.readyDescription')
          : t('account.privacy.export.buildingDescription')
      }
      title={
        isReady
          ? t('account.privacy.export.readyTitle')
          : t('account.privacy.export.buildingTitle')
      }
    >
      {/* `status` se calcula sobre los datos y no sobre el estado del hook:
          el sondeo recarga cada tres segundos y, si se mirase el hook, la
          pantalla parpadearía a «cargando» en cada vuelta. */}
      <AsyncState
        error={latest.error}
        errorTitle={t('account.privacy.export.stateError')}
        loading={<LoadingState label={t('account.privacy.export.building')} />}
        onRetry={latest.reload}
        status={request ? 'success' : latest.status}
      >
        {hasFailed ? (
          <Alert tone="danger" title={t('account.privacy.export.failedTitle')}>
            {t('account.privacy.export.failedDescription')}
          </Alert>
        ) : isReady ? (
          <div className="grid gap-1.5 rounded-sm bg-surface-secondary p-4 text-xs">
            <strong>{t('account.privacy.export.generated')}</strong>
            <span className="text-xs2 text-muted">
              {t('account.privacy.export.generatedDates', {
                requested: formatDate(request.requestedAt, i18n.language),
                expires: formatDate(request.expiresAt, i18n.language),
              })}
            </span>
          </div>
        ) : timedOut ? (
          <Alert
            tone="warning"
            title={t('account.privacy.export.takingLongerTitle')}
          >
            {t('account.privacy.export.takingLongerDescription')}
          </Alert>
        ) : (
          <LoadingState label={t('account.privacy.export.building')} />
        )}
      </AsyncState>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <footer>
        <Button onClick={onBack} variant="secondary">
          {t('account.privacy.back')}
        </Button>
        <Button
          disabled={!isReady || isDownloading}
          onClick={() => void download()}
        >
          {isDownloading
            ? t('account.privacy.export.downloading')
            : t('account.privacy.export.download')}
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
  const { t } = useTranslation();
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
      setError(t(errorKey(requestError)));
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
      setError(t(errorKey(confirmError)));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <FlowPage
      onBack={onBack}
      subtitle={t('account.privacy.delete.flowDescription')}
      title={t('account.privacy.delete.flowTitle')}
    >
      <p className="text-sm">{t('account.privacy.delete.details')}</p>

      {step === 'request' ? (
        <>
          <Alert
            tone="warning"
            title={t('account.privacy.delete.twoConfirmations')}
          >
            {t('account.privacy.delete.twoConfirmationsDescription')}
          </Alert>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <footer>
            <Button onClick={onBack} variant="secondary">
              {t('common.actions.cancel')}
            </Button>
            <Button
              disabled={isWorking}
              onClick={() => void sendEmail()}
              variant="destructive"
            >
              {isWorking
                ? t('account.privacy.delete.sending')
                : t('account.privacy.delete.sendCode')}
            </Button>
          </footer>
        </>
      ) : (
        <>
          <Alert tone="danger" title={t('account.privacy.delete.irreversible')}>
            {t('account.privacy.delete.irreversibleDescription')}
          </Alert>
          <TextField
            autoComplete="off"
            label={t('account.privacy.delete.confirmationCode')}
            onChange={(event) => setCode(event.target.value)}
            placeholder={t('account.privacy.delete.codePlaceholder')}
            value={code}
          />
          <TextField
            autoComplete="off"
            label={t('account.privacy.delete.usernameConfirmation')}
            onChange={(event) => setUsername(event.target.value)}
            placeholder={profile.username}
            value={username}
          />
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <footer>
            <Button onClick={onBack} variant="secondary">
              {t('common.actions.cancel')}
            </Button>
            <Button
              disabled={
                isWorking || code.trim().length < 20 || username.trim() === ''
              }
              onClick={() => void confirm()}
              variant="destructive"
            >
              {isWorking
                ? t('account.privacy.delete.deleting')
                : t('account.privacy.delete.confirm')}
            </Button>
          </footer>
        </>
      )}
    </FlowPage>
  );
}
