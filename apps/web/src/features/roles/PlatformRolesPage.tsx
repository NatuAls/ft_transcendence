import { Alert, Button, Dialog, EmptyState, LoadingState, TextField } from 'ui';
import { useState, type FormEvent } from 'react';
import { AsyncState } from '../../core/async/AsyncState';
import { useAsync } from '../../core/async/useAsync';
import { errorKey, fieldErrorsFromIssues } from '../../core/api/errors';
import { useTranslation } from '../../core/i18n';
import {
  assignPlatformRoleSchema,
  type PlatformRoleAssignment,
  type PlatformRoleReservation,
} from 'contracts';
import {
  formatDate,
  rolesGateway,
  type PlatformAdministrator,
} from './rolesGateway';
import {
  HowTheLinkWorks,
  PageHeader,
  Panel,
  PersonCell,
  SummaryCards,
  Tag,
  WaitingTag,
} from './RoleParts';

/**
 * Screen 1 of 2: roles at SYSTEM level.
 *
 * A platform administrator gives the platform role to an e-mail address. The
 * person creates the account on their own; the role reaches it when the
 * address is confirmed. Only reachable with `user:setGlobalRole` - the shell
 * does not even show the entry otherwise, and the API refuses it anyway.
 */
export function PlatformRolesPage({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    text: string;
    tone: 'success' | 'info' | 'danger';
  } | null>(null);
  const [withdrawing, setWithdrawing] = useState<PlatformAdministrator | null>(
    null,
  );
  const [busyId, setBusyId] = useState('');

  const roles = useAsync(async () => {
    const [administrators, reservations] = await Promise.all([
      rolesGateway.listPlatformAdministrators(),
      rolesGateway.listPlatformReservations(),
    ]);
    return { administrators, reservations };
  }, []);
  const administrators: PlatformAdministrator[] =
    roles.data?.administrators ?? [];
  const reservations: PlatformRoleReservation[] =
    roles.data?.reservations ?? [];
  const reload = roles.reload;

  function describe(result: PlatformRoleAssignment) {
    const name = result.user?.displayName ?? result.email;
    if (result.outcome === 'APPLIED') {
      return {
        text: t('admin.roles.feedback.applied', { name }),
        tone: 'success' as const,
      };
    }
    if (result.outcome === 'UNCHANGED') {
      return {
        text: t('admin.roles.feedback.unchanged', { name }),
        tone: 'info' as const,
      };
    }
    return {
      text:
        result.reservation?.waitingFor === 'VERIFICATION'
          ? t('admin.roles.feedback.reservedVerification', {
              email: result.email,
            })
          : t('admin.roles.feedback.reservedAccount', { email: result.email }),
      tone: 'success' as const,
    };
  }

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const parsed = assignPlatformRoleSchema.safeParse({
      email,
      globalRole: 'GLOBAL_ADMIN',
    });
    if (!parsed.success) {
      // Mismo camino que un rechazo de la API: el mensaje sale de la pieza
      // compartida, así que validar aquí y que lo rechace el servidor
      // producen exactamente la misma pantalla.
      setEmailError(
        fieldErrorsFromIssues(parsed.error.issues).email ??
          t('errors.field.invalid'),
      );
      return;
    }
    setEmailError('');
    setSubmitting(true);
    try {
      const result = await rolesGateway.assignPlatformRole(parsed.data);
      setFeedback(describe(result));
      setEmail('');
      reload();
    } catch (error) {
      setFeedback({ text: t(errorKey(error)), tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
  }

  async function withdraw(administrator: PlatformAdministrator) {
    setBusyId(administrator.id);
    setFeedback(null);
    try {
      await rolesGateway.withdrawPlatformRole(administrator.id);
      setFeedback({
        text: t('admin.roles.feedback.withdrawn', {
          name: administrator.displayName,
        }),
        tone: 'success',
      });
      setWithdrawing(null);
      reload();
    } catch (error) {
      setFeedback({ text: t(errorKey(error)), tone: 'danger' });
      setWithdrawing(null);
    } finally {
      setBusyId('');
    }
  }

  async function cancel(reservation: PlatformRoleReservation) {
    setBusyId(reservation.id);
    setFeedback(null);
    try {
      await rolesGateway.cancelPlatformReservation(reservation.id);
      setFeedback({
        text: t('admin.roles.feedback.cancelled', { email: reservation.email }),
        tone: 'success',
      });
      reload();
    } catch (error) {
      setFeedback({ text: t(errorKey(error)), tone: 'danger' });
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="mx-auto max-w-[1160px] p-10 max-md:px-4 max-md:py-6">
      <PageHeader
        description={t('admin.roles.description')}
        eyebrow={t('admin.eyebrow')}
        title={t('admin.roles.title')}
      />
      <SummaryCards
        items={[
          {
            label: t('admin.roles.cards.administrators'),
            value: administrators.length,
          },
          {
            label: t('admin.roles.cards.waitingAccount'),
            value: reservations.filter((row) => row.waitingFor === 'ACCOUNT')
              .length,
          },
          {
            label: t('admin.roles.cards.waitingVerification'),
            value: reservations.filter(
              (row) => row.waitingFor === 'VERIFICATION',
            ).length,
          },
        ]}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-5 max-[900px]:grid-cols-1">
        <Panel
          description={t('admin.roles.assignDescription')}
          title={t('admin.roles.assignTitle')}
        >
          <form
            className="grid gap-4 border-t border-border p-5 max-md:p-4"
            noValidate
            onSubmit={(event) => void assign(event)}
          >
            <TextField
              autoComplete="off"
              error={emailError || undefined}
              label={t('organization.access.emailLabel')}
              name="email"
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailError('');
              }}
              placeholder={t('organization.access.emailPlaceholder')}
              required
              type="email"
              value={email}
            />
            <div className="grid gap-1 rounded-sm border border-border bg-surface-secondary px-4 py-3">
              <span className="text-xs font-medium">
                {t('admin.roles.roleToAssign')}
              </span>
              <strong className="text-sm font-medium">
                {t('admin.platformAdministrator')}
              </strong>
              <span className="text-xs leading-5 text-muted">
                {t('admin.roles.roleDescription')}
              </span>
            </div>
            <div className="flex justify-end">
              <Button disabled={submitting} type="submit">
                {submitting
                  ? t('organization.access.assigning')
                  : t('organization.access.assign')}
              </Button>
            </div>
          </form>
        </Panel>
        <HowTheLinkWorks />
      </div>

      {feedback ? (
        <Alert
          aria-live="polite"
          className="mt-5"
          role={feedback.tone === 'danger' ? 'alert' : 'status'}
          tone={feedback.tone}
        >
          {feedback.text}
        </Alert>
      ) : null}

      <AsyncState
        error={roles.error}
        errorTitle={t('organization.access.loadError')}
        loading={
          <div className="mt-5">
            <LoadingState label={t('admin.roles.loading')} />
          </div>
        }
        onRetry={reload}
        status={roles.status}
      >
        <div className="mt-5 grid gap-5">
          <Panel
            description={t('admin.roles.administratorsDescription')}
            title={t('admin.roles.cards.administrators')}
          >
            <ul className="border-t border-border">
              {administrators.map((administrator) => {
                const self = administrator.id === currentUserId;
                return (
                  <li
                    className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto] items-center gap-3 border-t border-border px-5 py-3 first:border-t-0 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:px-4"
                    key={administrator.id}
                  >
                    <PersonCell
                      avatarUrl={administrator.avatarUrl}
                      detail={administrator.email}
                      name={administrator.displayName}
                    />
                    <span className="flex flex-wrap gap-1.5 max-md:order-3 max-md:col-span-2">
                      {self ? (
                        <Tag tone="info">{t('admin.roles.you')}</Tag>
                      ) : null}
                      {administrator.isPrimary ? (
                        <Tag tone="success">{t('admin.roles.primary')}</Tag>
                      ) : null}
                      {!administrator.emailVerified ? (
                        <Tag tone="warning">{t('admin.roles.unconfirmed')}</Tag>
                      ) : null}
                      {!administrator.isActive ? (
                        <Tag tone="danger">{t('admin.roles.suspended')}</Tag>
                      ) : null}
                      <small className="self-center text-xs text-muted">
                        {t('admin.roles.lastSignIn', {
                          date: formatDate(administrator.lastLoginAt),
                        })}
                      </small>
                    </span>
                    {self || administrator.isPrimary ? (
                      <span className="text-xs text-muted">
                        {self
                          ? t('admin.roles.ownRole')
                          : t('admin.roles.protected')}
                      </span>
                    ) : (
                      <Button
                        aria-label={t('admin.roles.withdrawFrom', {
                          name: administrator.displayName,
                        })}
                        disabled={busyId === administrator.id}
                        onClick={() => setWithdrawing(administrator)}
                        size="compact"
                        variant="secondary"
                      >
                        {t('admin.roles.withdraw')}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel
            description={t('admin.roles.reservationsDescription')}
            title={t('admin.roles.reservationsTitle')}
          >
            {reservations.length ? (
              <ul className="border-t border-border">
                {reservations.map((reservation) => (
                  <li
                    className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto] items-center gap-3 border-t border-border px-5 py-3 first:border-t-0 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:px-4"
                    key={reservation.id}
                  >
                    <PersonCell
                      detail={t('organization.access.reservedBy', {
                        date: formatDate(reservation.updatedAt),
                        name:
                          reservation.grantedBy?.displayName ??
                          t('organization.access.formerAdministrator'),
                      })}
                      name={reservation.email}
                    />
                    <span className="max-md:order-3 max-md:col-span-2">
                      <WaitingTag reason={reservation.waitingFor} />
                    </span>
                    <Button
                      aria-label={t('organization.access.cancelReservation', {
                        email: reservation.email,
                      })}
                      disabled={busyId === reservation.id}
                      onClick={() => void cancel(reservation)}
                      size="compact"
                      variant="secondary"
                    >
                      {t('common.actions.cancel')}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="border-t border-border p-5">
                <EmptyState
                  description={t('admin.roles.reservationsEmpty')}
                  title={t('organization.access.nothingWaiting')}
                />
              </div>
            )}
          </Panel>
        </div>
      </AsyncState>

      {withdrawing ? (
        <Dialog
          description={t('admin.roles.withdrawDialog.description', {
            name: withdrawing.displayName,
          })}
          eyebrow={t('admin.roles.eyebrowDialog')}
          footer={
            <>
              <Button onClick={() => setWithdrawing(null)} variant="secondary">
                {t('admin.roles.withdrawDialog.keep')}
              </Button>
              <Button
                disabled={busyId === withdrawing.id}
                type="submit"
                variant="destructive"
              >
                {t('admin.roles.withdrawDialog.confirm')}
              </Button>
            </>
          }
          onClose={() => setWithdrawing(null)}
          onSubmit={(event) => {
            event.preventDefault();
            void withdraw(withdrawing);
          }}
          title={t('admin.roles.withdrawDialog.title')}
        />
      ) : null}
    </div>
  );
}
