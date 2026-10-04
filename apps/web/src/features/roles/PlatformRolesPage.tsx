import { Alert, Button, Dialog, EmptyState, LoadingState, TextField } from 'ui';
import { useState, type FormEvent } from 'react';
import { AsyncState } from '../../core/async/AsyncState';
import { useAsync } from '../../core/async/useAsync';
import { errorMessage, fieldErrorsFromIssues } from '../../core/api/errors';
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
        text: `${name} is now a platform administrator. The change applies to their current session right away.`,
        tone: 'success' as const,
      };
    }
    if (result.outcome === 'UNCHANGED') {
      return {
        text: `${name} already is a platform administrator. Nothing changed.`,
        tone: 'info' as const,
      };
    }
    return {
      text:
        result.reservation?.waitingFor === 'VERIFICATION'
          ? `Reserved for ${result.email}. That account exists but its address is not confirmed: the role is applied as soon as it is. We e-mailed them.`
          : `Reserved for ${result.email}. Nobody has registered that address yet: the role is applied when they create their account with it and confirm it. We e-mailed them.`,
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
        fieldErrorsFromIssues(parsed.error.issues).email ?? 'Check this field.',
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
      setFeedback({
        text: errorMessage(error, 'The role could not be assigned.'),
        tone: 'danger',
      });
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
        text: `${administrator.displayName} is a standard user again. Their account and organization roles are untouched.`,
        tone: 'success',
      });
      setWithdrawing(null);
      reload();
    } catch (error) {
      setFeedback({
        text:
          error instanceof Error
            ? error.message
            : 'The role could not be withdrawn.',
        tone: 'danger',
      });
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
        text: `The reservation for ${reservation.email} was cancelled. Confirming that address no longer gives any role.`,
        tone: 'success',
      });
      reload();
    } catch (error) {
      setFeedback({
        text:
          error instanceof Error
            ? error.message
            : 'The reservation could not be cancelled.',
        tone: 'danger',
      });
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="mx-auto max-w-[1160px] p-10 max-md:px-4 max-md:py-6">
      <PageHeader
        description="Give platform administration to an e-mail address. A confirmed account receives it at once; any other address keeps it reserved until the person creates the account with it and confirms it."
        eyebrow="PLATFORM ADMINISTRATION"
        title="Platform roles"
      />
      <SummaryCards
        items={[
          { label: 'Platform administrators', value: administrators.length },
          {
            label: 'Waiting for an account',
            value: reservations.filter((row) => row.waitingFor === 'ACCOUNT')
              .length,
          },
          {
            label: 'Waiting for e-mail confirmation',
            value: reservations.filter(
              (row) => row.waitingFor === 'VERIFICATION',
            ).length,
          },
        ]}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-5 max-[900px]:grid-cols-1">
        <Panel
          description="Every account starts as a standard user. To take administration back from somebody, use Withdraw in the list below."
          title="Assign a platform role"
        >
          <form
            className="grid gap-4 border-t border-border p-5 max-md:p-4"
            noValidate
            onSubmit={(event) => void assign(event)}
          >
            <TextField
              autoComplete="off"
              error={emailError || undefined}
              label="E-mail address"
              name="email"
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailError('');
              }}
              placeholder="person@company.com"
              required
              type="email"
              value={email}
            />
            <div className="grid gap-1 rounded-sm border border-border bg-surface-secondary px-4 py-3">
              <span className="text-xs font-medium">Role to assign</span>
              <strong className="text-sm font-medium">
                Platform administrator
              </strong>
              <span className="text-xs leading-5 text-muted">
                Manages every account, organization and role on the platform,
                acts in any organization and reads the audit trail.
              </span>
            </div>
            <div className="flex justify-end">
              <Button disabled={submitting} type="submit">
                {submitting ? 'Assigning…' : 'Assign role'}
              </Button>
            </div>
          </form>
        </Panel>
        <HowTheLinkWorks scope=" for the whole platform" />
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
        errorTitle="The roles could not be loaded"
        loading={
          <div className="mt-5">
            <LoadingState label="Loading platform roles" />
          </div>
        }
        onRetry={reload}
        status={roles.status}
      >
        <div className="mt-5 grid gap-5">
          <Panel
            description="They can manage the whole platform. The primary administrator is created at deployment and cannot be withdrawn from here."
            title="Platform administrators"
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
                      {self ? <Tag tone="info">You</Tag> : null}
                      {administrator.isPrimary ? (
                        <Tag tone="success">Primary · protected</Tag>
                      ) : null}
                      {!administrator.emailVerified ? (
                        <Tag tone="warning">Address not confirmed</Tag>
                      ) : null}
                      {!administrator.isActive ? (
                        <Tag tone="danger">Suspended</Tag>
                      ) : null}
                      <small className="self-center text-xs text-muted">
                        Last sign-in: {formatDate(administrator.lastLoginAt)}
                      </small>
                    </span>
                    {self || administrator.isPrimary ? (
                      <span className="text-xs text-muted">
                        {self ? 'Your own role' : 'Protected'}
                      </span>
                    ) : (
                      <Button
                        aria-label={`Withdraw platform administration from ${administrator.displayName}`}
                        disabled={busyId === administrator.id}
                        onClick={() => setWithdrawing(administrator)}
                        size="compact"
                        variant="secondary"
                      >
                        Withdraw
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel
            description="Addresses that will become platform administrators once the account exists and the address is confirmed."
            title="Reserved for an e-mail address"
          >
            {reservations.length ? (
              <ul className="border-t border-border">
                {reservations.map((reservation) => (
                  <li
                    className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto] items-center gap-3 border-t border-border px-5 py-3 first:border-t-0 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:px-4"
                    key={reservation.id}
                  >
                    <PersonCell
                      detail={`Reserved by ${reservation.grantedBy?.displayName ?? 'a former administrator'} · ${formatDate(reservation.updatedAt)}`}
                      name={reservation.email}
                    />
                    <span className="max-md:order-3 max-md:col-span-2">
                      <WaitingTag reason={reservation.waitingFor} />
                    </span>
                    <Button
                      aria-label={`Cancel the reservation for ${reservation.email}`}
                      disabled={busyId === reservation.id}
                      onClick={() => void cancel(reservation)}
                      size="compact"
                      variant="secondary"
                    >
                      Cancel
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="border-t border-border p-5">
                <EmptyState
                  description="When you assign the role to an address without a confirmed account, it waits here."
                  title="Nothing is waiting"
                />
              </div>
            )}
          </Panel>
        </div>
      </AsyncState>

      {withdrawing ? (
        <Dialog
          description={`${withdrawing.displayName} keeps their account, their organizations and their roles in them. What they lose, immediately, is platform administration.`}
          eyebrow="PLATFORM ROLES"
          footer={
            <>
              <Button onClick={() => setWithdrawing(null)} variant="secondary">
                Keep the role
              </Button>
              <Button
                disabled={busyId === withdrawing.id}
                type="submit"
                variant="destructive"
              >
                Withdraw administration
              </Button>
            </>
          }
          onClose={() => setWithdrawing(null)}
          onSubmit={(event) => {
            event.preventDefault();
            void withdraw(withdrawing);
          }}
          title="Withdraw platform administration?"
        />
      ) : null}
    </div>
  );
}
