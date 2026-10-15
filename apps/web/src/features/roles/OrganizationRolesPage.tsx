import {
  Alert,
  Button,
  Dialog,
  EmptyState,
  IconButton,
  LoadingState,
  SelectField,
  TextField,
} from 'ui';
import { useState, type FormEvent } from 'react';
import { AsyncState } from '../../core/async/AsyncState';
import { useAsync } from '../../core/async/useAsync';
import { errorKey, fieldErrorsFromIssues } from '../../core/api/errors';
import { useTranslation } from '../../core/i18n';
import {
  assignOrganizationRoleSchema,
  type OrgRole,
  type OrganizationRoleAssignment,
  type OrganizationRoleReservation,
} from 'contracts';
import {
  formatDate,
  organizationRoleDescription,
  organizationRoleLabel,
  organizationRoles,
  rolesGateway,
  type OrganizationMemberRow,
} from './rolesGateway';
import {
  CapabilityMatrix,
  Highlighted,
  HowTheLinkWorks,
  PageHeader,
  Panel,
  PersonCell,
  SummaryCards,
  Tag,
  WaitingTag,
} from './RoleParts';

export type OrganizationViewerRole =
  'GLOBAL_ADMIN' | 'ORG_ADMIN' | 'AGENT' | 'MEMBER';

type Feedback = { text: string; tone: 'success' | 'info' | 'danger' } | null;

/**
 * Screen 2 of 2: roles at ORGANIZATION level, for the active organization.
 *
 * The same route shows three different screens, because the role decides
 * what there is to do here:
 *
 *   · ORG_ADMIN (or a platform administrator): assign roles by e-mail address,
 *     change them, remove members, cancel what is still waiting.
 *   · AGENT: who does what in the organization, read only.
 *   · MEMBER: their own access, what each role can do and whom to ask.
 *
 * The screen only decides what to SHOW. Every action is decided again by the
 * API (`orgScope` + the policy table), whatever the browser sends.
 *
 * Whether you manage comes from `can()` in the shell (`canManage`), never
 * from comparing role names here. `viewerRole` only says which role to
 * DESCRIBE — its name, its row in the table — and which read-only view fits
 * it; the roster the agent view lists is one every member may read anyway.
 */
export function OrganizationRolesPage({
  canManage,
  currentUserId,
  onAccessChanged,
  onOpenOrganizations,
  organizationId,
  organizationName,
  viewerRole,
}: {
  canManage: boolean;
  currentUserId: string;
  onAccessChanged: () => void;
  onOpenOrganizations: () => void;
  organizationId: string;
  organizationName: string;
  viewerRole: OrganizationViewerRole;
}) {
  const { t } = useTranslation();
  if (!organizationId) {
    return (
      <div className="mx-auto max-w-[1160px] p-10 max-md:px-4 max-md:py-6">
        <PageHeader
          description={t('organization.access.none.description')}
          eyebrow={t('organization.eyebrow')}
          title={t('organization.access.title')}
        />
        <div className="mt-6">
          <EmptyState
            action={
              <Button onClick={onOpenOrganizations} variant="secondary">
                {t('organization.access.none.goTo')}
              </Button>
            }
            description={t('organization.access.none.hint')}
            title={t('organization.access.none.title')}
          />
        </div>
      </div>
    );
  }

  return canManage ? (
    <ManageView
      currentUserId={currentUserId}
      onAccessChanged={onAccessChanged}
      organizationId={organizationId}
      organizationName={organizationName}
      viewerRole={viewerRole}
    />
  ) : (
    <ReadOnlyView
      organizationId={organizationId}
      organizationName={organizationName}
      viewerRole={viewerRole === 'AGENT' ? 'AGENT' : 'MEMBER'}
    />
  );
}

// ------------------------------------------------------------ administrator --

function ManageView({
  currentUserId,
  onAccessChanged,
  organizationId,
  organizationName,
  viewerRole,
}: {
  currentUserId: string;
  onAccessChanged: () => void;
  organizationId: string;
  organizationName: string;
  viewerRole: OrganizationViewerRole;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrgRole>('MEMBER');
  const [emailError, setEmailError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busyId, setBusyId] = useState('');
  const [removing, setRemoving] = useState<OrganizationMemberRow | null>(null);
  const [demotingSelf, setDemotingSelf] = useState<OrgRole | null>(null);

  const roles = useAsync(async () => {
    const [members, reservations] = await Promise.all([
      rolesGateway.listMembers(organizationId),
      rolesGateway.listOrganizationReservations(organizationId),
    ]);
    return { members, reservations };
  }, [organizationId]);
  const members: OrganizationMemberRow[] = roles.data?.members ?? [];
  const reservations: OrganizationRoleReservation[] =
    roles.data?.reservations ?? [];
  const reload = roles.reload;

  function describe(result: OrganizationRoleAssignment): Feedback {
    const values = {
      email: result.email,
      name: result.user?.displayName ?? result.email,
      organization: organizationName,
      role: organizationRoleLabel(result.role),
    };
    if (result.outcome === 'APPLIED') {
      return {
        text: t('organization.access.manage.feedback.applied', values),
        tone: 'success',
      };
    }
    if (result.outcome === 'UNCHANGED') {
      return {
        text: t('organization.access.manage.feedback.unchanged', values),
        tone: 'info',
      };
    }
    return {
      text:
        result.reservation?.waitingFor === 'VERIFICATION'
          ? t(
              'organization.access.manage.feedback.reservedVerification',
              values,
            )
          : t('organization.access.manage.feedback.reservedAccount', values),
      tone: 'success',
    };
  }

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const parsed = assignOrganizationRoleSchema.safeParse({ email, role });
    if (!parsed.success) {
      setEmailError(
        fieldErrorsFromIssues(parsed.error.issues).email ??
          t('errors.field.invalid'),
      );
      return;
    }
    setEmailError('');
    setSubmitting(true);
    try {
      const result = await rolesGateway.assignOrganizationRole(
        organizationId,
        parsed.data,
      );
      setFeedback(describe(result));
      setEmail('');
      reload();
      if (result.user?.id === currentUserId) onAccessChanged();
    } catch (error) {
      setFeedback({ text: t(errorKey(error)), tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
  }

  async function changeRole(member: OrganizationMemberRow, next: OrgRole) {
    if (next === member.role) return;
    setBusyId(member.userId);
    setFeedback(null);
    try {
      await rolesGateway.changeMemberRole(organizationId, member.userId, next);
      setFeedback({
        text: t('organization.access.manage.feedback.changed', {
          name: member.displayName,
          role: organizationRoleLabel(next),
        }),
        tone: 'success',
      });
      reload();
      if (member.userId === currentUserId) onAccessChanged();
    } catch (error) {
      setFeedback({ text: t(errorKey(error)), tone: 'danger' });
    } finally {
      setBusyId('');
      setDemotingSelf(null);
    }
  }

  async function remove(member: OrganizationMemberRow) {
    setBusyId(member.userId);
    setFeedback(null);
    try {
      await rolesGateway.removeMember(organizationId, member.userId);
      setFeedback({
        text: t('organization.access.manage.feedback.removed', {
          name: member.displayName,
          organization: organizationName,
        }),
        tone: 'success',
      });
      setRemoving(null);
      reload();
    } catch (error) {
      setFeedback({ text: t(errorKey(error)), tone: 'danger' });
      setRemoving(null);
    } finally {
      setBusyId('');
    }
  }

  async function cancel(reservation: OrganizationRoleReservation) {
    setBusyId(reservation.id);
    setFeedback(null);
    try {
      await rolesGateway.cancelOrganizationReservation(
        organizationId,
        reservation.id,
      );
      setFeedback({
        text: t('organization.access.reservationCancelled', {
          email: reservation.email,
        }),
        tone: 'success',
      });
      reload();
    } catch (error) {
      setFeedback({ text: t(errorKey(error)), tone: 'danger' });
    } finally {
      setBusyId('');
    }
  }

  const count = (value: OrgRole) =>
    members.filter((member) => member.role === value).length;
  const self = members.find((member) => member.userId === currentUserId);

  return (
    <div className="mx-auto max-w-[1160px] p-10 max-md:px-4 max-md:py-6">
      <PageHeader
        description={
          <>
            <Highlighted
              sentence={(organization) =>
                t('organization.access.manage.description', { organization })
              }
              value={organizationName}
            />
            {viewerRole === 'GLOBAL_ADMIN' && !self
              ? t('organization.access.manage.actingAsPlatformAdmin')
              : ''}
          </>
        }
        eyebrow={t('organization.access.manage.eyebrow')}
        title={t('organization.access.title')}
      />
      <SummaryCards
        items={[
          {
            label: t('organization.access.manage.cards.admins'),
            value: count('ORG_ADMIN'),
          },
          {
            label: t('organization.access.manage.cards.agents'),
            value: count('AGENT'),
          },
          {
            label: t('organization.access.manage.cards.members'),
            value: count('MEMBER'),
          },
          {
            label: t('organization.access.manage.cards.waiting'),
            value: reservations.length,
          },
        ]}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-5 max-[900px]:grid-cols-1">
        <Panel
          description={t('organization.access.manage.assignDescription')}
          title={t('organization.access.manage.assignTitle')}
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
            <SelectField
              label={t('organization.access.manage.roleLabel')}
              name="role"
              onChange={(event) => setRole(event.target.value as OrgRole)}
              value={role}
            >
              {organizationRoles.map((item) => (
                <option key={item.value} value={item.value}>
                  {organizationRoleLabel(item.value)}
                </option>
              ))}
            </SelectField>
            <p className="-mt-2 text-xs leading-5 text-muted">
              {organizationRoleDescription(role)}
            </p>
            <div className="flex justify-end">
              <Button disabled={submitting} type="submit">
                {submitting
                  ? t('organization.access.assigning')
                  : t('organization.access.assign')}
              </Button>
            </div>
          </form>
        </Panel>
        <HowTheLinkWorks organizationName={organizationName} />
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
            <LoadingState label={t('organization.access.manage.loading')} />
          </div>
        }
        onRetry={reload}
        status={roles.status}
      >
        <div className="mt-5 grid gap-5">
          <Panel
            description={t('organization.access.manage.membersDescription')}
            title={t('organization.access.manage.membersTitle', {
              organization: organizationName,
            })}
          >
            <ul className="border-t border-border">
              {members.map((member) => {
                const isSelf = member.userId === currentUserId;
                return (
                  <li
                    className="grid grid-cols-[minmax(0,2fr)_minmax(180px,1fr)_44px] items-center gap-3 border-t border-border px-5 py-3 first:border-t-0 max-md:grid-cols-[minmax(0,1fr)_44px] max-md:px-4"
                    key={member.userId}
                  >
                    <PersonCell
                      avatarUrl={member.avatarUrl}
                      detail={t('organization.access.manage.since', {
                        date: formatDate(member.joinedAt),
                        email: member.email,
                      })}
                      name={
                        isSelf
                          ? t('organization.access.manage.you', {
                              name: member.displayName,
                            })
                          : member.displayName
                      }
                      online={member.isOnline}
                    />
                    <div className="max-md:order-3 max-md:col-span-2">
                      <SelectField
                        disabled={busyId === member.userId}
                        hideLabel
                        label={t('organization.access.manage.roleOf', {
                          name: member.displayName,
                        })}
                        onChange={(event) => {
                          const next = event.target.value as OrgRole;
                          if (
                            isSelf &&
                            member.role === 'ORG_ADMIN' &&
                            next !== 'ORG_ADMIN'
                          ) {
                            setDemotingSelf(next);
                            return;
                          }
                          void changeRole(member, next);
                        }}
                        value={member.role}
                      >
                        {organizationRoles.map((item) => (
                          <option key={item.value} value={item.value}>
                            {organizationRoleLabel(item.value)}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                    {isSelf ? (
                      <span aria-hidden="true" />
                    ) : (
                      <IconButton
                        disabled={busyId === member.userId}
                        icon="close"
                        label={t('organization.access.manage.removeFrom', {
                          name: member.displayName,
                          organization: organizationName,
                        })}
                        onClick={() => setRemoving(member)}
                        size="sm"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel
            description={t(
              'organization.access.manage.reservationsDescription',
            )}
            title={t('organization.access.manage.reservationsTitle')}
          >
            {reservations.length ? (
              <ul className="border-t border-border">
                {reservations.map((reservation) => (
                  <li
                    className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center gap-3 border-t border-border px-5 py-3 first:border-t-0 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:px-4"
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
                    <span className="max-md:order-3">
                      <Tag>{organizationRoleLabel(reservation.role)}</Tag>
                    </span>
                    <span className="max-md:order-4">
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
                  description={t(
                    'organization.access.manage.reservationsEmpty',
                  )}
                  title={t('organization.access.nothingWaiting')}
                />
              </div>
            )}
          </Panel>

          <CapabilityMatrix highlight={self?.role} />
        </div>
      </AsyncState>

      {removing ? (
        <Dialog
          description={t(
            'organization.access.manage.removeDialog.description',
            {
              name: removing.displayName,
              organization: organizationName,
            },
          )}
          eyebrow={t('organization.access.manage.removeDialog.eyebrow')}
          footer={
            <>
              <Button onClick={() => setRemoving(null)} variant="secondary">
                {t('organization.access.manage.removeDialog.keep')}
              </Button>
              <Button
                disabled={busyId === removing.userId}
                type="submit"
                variant="destructive"
              >
                {t('organization.access.manage.removeDialog.confirm')}
              </Button>
            </>
          }
          onClose={() => setRemoving(null)}
          onSubmit={(event) => {
            event.preventDefault();
            void remove(removing);
          }}
          title={t('organization.access.manage.removeDialog.title', {
            name: removing.displayName,
          })}
        />
      ) : null}

      {demotingSelf && self ? (
        <Dialog
          description={t(
            'organization.access.manage.demoteDialog.description',
            {
              organization: organizationName,
            },
          )}
          eyebrow={t('organization.access.manage.removeDialog.eyebrow')}
          footer={
            <>
              <Button onClick={() => setDemotingSelf(null)} variant="secondary">
                {t('organization.access.manage.demoteDialog.keep')}
              </Button>
              <Button type="submit" variant="destructive">
                {t('organization.access.manage.demoteDialog.confirm', {
                  role: organizationRoleLabel(demotingSelf),
                })}
              </Button>
            </>
          }
          onClose={() => setDemotingSelf(null)}
          onSubmit={(event) => {
            event.preventDefault();
            void changeRole(self, demotingSelf);
          }}
          title={t('organization.access.manage.demoteDialog.title')}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------- agent / member --

function ReadOnlyView({
  organizationId,
  organizationName,
  viewerRole,
}: {
  organizationId: string;
  organizationName: string;
  viewerRole: 'AGENT' | 'MEMBER';
}) {
  const { t } = useTranslation();
  const roster = useAsync(
    () => rolesGateway.listMembers(organizationId),
    [organizationId],
  );
  const members: OrganizationMemberRow[] = roster.data ?? [];
  const loading = roster.status === 'loading';
  const loadError = roster.status === 'error' ? t(errorKey(roster.error)) : '';

  const administrators = members.filter(
    (member) => member.role === 'ORG_ADMIN',
  );
  const agent = viewerRole === 'AGENT';

  return (
    <div className="mx-auto max-w-[1160px] p-10 max-md:px-4 max-md:py-6">
      <PageHeader
        description={t(
          agent
            ? 'organization.access.readOnly.descriptionAgent'
            : 'organization.access.readOnly.descriptionMember',
          { organization: organizationName },
        )}
        eyebrow={t('organization.eyebrow')}
        title={t('organization.access.title')}
      />

      <section className="my-6 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 max-md:grid-cols-1">
        <article className="grid gap-1.5 rounded-md border border-border bg-surface p-5">
          <span className="text-xs text-muted">
            {t('organization.access.readOnly.yourRole')}
          </span>
          <strong className="text-lg font-medium">
            {organizationRoleLabel(viewerRole)}
          </strong>
          <p className="text-sm leading-6 text-muted">
            {organizationRoleDescription(viewerRole)}
          </p>
        </article>
        <article className="grid content-start gap-2 rounded-md border border-border bg-surface p-5">
          <span className="text-xs text-muted">
            {t('organization.access.readOnly.needDifferent')}
          </span>
          <p className="text-sm leading-6 text-muted">
            {t('organization.access.readOnly.onlyAdmin')}
          </p>
          {loading ? null : administrators.length ? (
            <ul className="grid gap-2">
              {administrators.map((member) => (
                <li key={member.userId}>
                  {/* Names only: the member directory, with addresses, is
                      for agents and administrators. */}
                  <PersonCell
                    avatarUrl={member.avatarUrl}
                    detail={organizationRoleLabel('ORG_ADMIN')}
                    name={member.displayName}
                    online={member.isOnline}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              {t('organization.access.readOnly.noAdmin')}
            </p>
          )}
        </article>
      </section>

      {loadError ? (
        <Alert className="mb-5" tone="danger">
          {loadError}
        </Alert>
      ) : null}

      <div className="grid gap-5">
        {agent ? (
          <Panel
            description={t('organization.access.readOnly.peopleDescription')}
            title={t('organization.access.readOnly.peopleTitle', {
              organization: organizationName,
            })}
          >
            {loading ? (
              <LoadingState label={t('organization.access.readOnly.loading')} />
            ) : (
              <ul className="border-t border-border">
                {members.map((member) => (
                  <li
                    className="grid grid-cols-[minmax(0,2fr)_auto] items-center gap-3 border-t border-border px-5 py-3 first:border-t-0 max-md:px-4"
                    key={member.userId}
                  >
                    <PersonCell
                      avatarUrl={member.avatarUrl}
                      detail={member.email}
                      name={member.displayName}
                      online={member.isOnline}
                    />
                    <Tag
                      tone={member.role === 'ORG_ADMIN' ? 'success' : 'neutral'}
                    >
                      {organizationRoleLabel(member.role)}
                    </Tag>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : null}
        <CapabilityMatrix highlight={viewerRole} />
      </div>
    </div>
  );
}
