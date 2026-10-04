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
import { useEffect, useState, type FormEvent } from 'react';
import {
  assignOrganizationRoleSchema,
  type OrgRole,
  type OrganizationRoleAssignment,
  type OrganizationRoleReservation,
} from 'contracts';
import {
  formatDate,
  organizationRoleLabel,
  organizationRoles,
  rolesGateway,
  type OrganizationMemberRow,
} from './rolesGateway';
import {
  CapabilityMatrix,
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

const roleDescription = (role: OrgRole) =>
  organizationRoles.find((item) => item.value === role)?.description ?? '';

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

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
  if (!organizationId) {
    return (
      <div className="mx-auto max-w-[1160px] p-10 max-md:px-4 max-md:py-6">
        <PageHeader
          description="Roles are given inside an organization, and there is none to choose yet."
          eyebrow="ORGANIZATION"
          title="Roles & access"
        />
        <div className="mt-6">
          <EmptyState
            action={
              <Button onClick={onOpenOrganizations} variant="secondary">
                Go to organizations
              </Button>
            }
            description="Create an organization first; its roles are managed here."
            title="No organization selected"
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
  const [members, setMembers] = useState<OrganizationMemberRow[]>([]);
  const [reservations, setReservations] = useState<
    OrganizationRoleReservation[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrgRole>('MEMBER');
  const [emailError, setEmailError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busyId, setBusyId] = useState('');
  const [removing, setRemoving] = useState<OrganizationMemberRow | null>(null);
  const [demotingSelf, setDemotingSelf] = useState<OrgRole | null>(null);

  // Bumped after every change; the effect below re-reads both lists.
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((current) => current + 1);

  useEffect(() => {
    let active = true;
    Promise.all([
      rolesGateway.listMembers(organizationId),
      rolesGateway.listOrganizationReservations(organizationId),
    ])
      .then(([nextMembers, nextReservations]) => {
        if (!active) return;
        setMembers(nextMembers);
        setReservations(nextReservations);
        setLoadError('');
      })
      .catch((error: unknown) => {
        if (active)
          setLoadError(messageOf(error, 'The roles could not be read.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organizationId, version]);

  function describe(result: OrganizationRoleAssignment): Feedback {
    const name = result.user?.displayName ?? result.email;
    const label = organizationRoleLabel(result.role);
    if (result.outcome === 'APPLIED') {
      return {
        text: `${name} now has the role ${label} in ${organizationName}.`,
        tone: 'success',
      };
    }
    if (result.outcome === 'UNCHANGED') {
      return {
        text: `${name} already has the role ${label}. Nothing changed.`,
        tone: 'info',
      };
    }
    return {
      text:
        result.reservation?.waitingFor === 'VERIFICATION'
          ? `${label} reserved for ${result.email}. That account exists but its address is not confirmed: they join ${organizationName} as soon as it is. We e-mailed them.`
          : `${label} reserved for ${result.email}. Nobody has registered that address yet: they join ${organizationName} when they create their account with it and confirm it. We e-mailed them.`,
      tone: 'success',
    };
  }

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const parsed = assignOrganizationRoleSchema.safeParse({ email, role });
    if (!parsed.success) {
      setEmailError('Enter a valid e-mail address.');
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
      setFeedback({
        text: messageOf(error, 'The role could not be assigned.'),
        tone: 'danger',
      });
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
        text: `${member.displayName} now has the role ${organizationRoleLabel(next)}.`,
        tone: 'success',
      });
      reload();
      if (member.userId === currentUserId) onAccessChanged();
    } catch (error) {
      setFeedback({
        text: messageOf(error, 'The role could not be changed.'),
        tone: 'danger',
      });
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
        text: `${member.displayName} was removed from ${organizationName}. Their open tickets went back to the unassigned queue.`,
        tone: 'success',
      });
      setRemoving(null);
      reload();
    } catch (error) {
      setFeedback({
        text: messageOf(error, 'The member could not be removed.'),
        tone: 'danger',
      });
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
        text: `The reservation for ${reservation.email} was cancelled.`,
        tone: 'success',
      });
      reload();
    } catch (error) {
      setFeedback({
        text: messageOf(error, 'The reservation could not be cancelled.'),
        tone: 'danger',
      });
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
            Give roles in{' '}
            <strong className="font-medium">{organizationName}</strong> to an
            e-mail address, change them and remove members. A confirmed account
            gets the role at once; any other address keeps it reserved until the
            person creates the account with it and confirms it.
            {viewerRole === 'GLOBAL_ADMIN' && !self
              ? ' You are acting as a platform administrator.'
              : ''}
          </>
        }
        eyebrow="ORGANIZATION ADMINISTRATION"
        title="Roles & access"
      />
      <SummaryCards
        items={[
          { label: 'Organization admins', value: count('ORG_ADMIN') },
          { label: 'Support agents', value: count('AGENT') },
          { label: 'Members', value: count('MEMBER') },
          { label: 'Waiting for the person', value: reservations.length },
        ]}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-5 max-[900px]:grid-cols-1">
        <Panel
          description="The address does not need an account yet."
          title="Assign a role by e-mail"
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
            <SelectField
              label="Role in this organization"
              name="role"
              onChange={(event) => setRole(event.target.value as OrgRole)}
              value={role}
            >
              {organizationRoles.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </SelectField>
            <p className="-mt-2 text-xs leading-5 text-muted">
              {roleDescription(role)}
            </p>
            <div className="flex justify-end">
              <Button disabled={submitting} type="submit">
                {submitting ? 'Assigning…' : 'Assign role'}
              </Button>
            </div>
          </form>
        </Panel>
        <HowTheLinkWorks scope={` in ${organizationName}`} />
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

      {loading ? (
        <div className="mt-5">
          <LoadingState label="Loading roles" />
        </div>
      ) : loadError ? (
        <Alert
          className="mt-5"
          title="The roles could not be loaded"
          tone="danger"
        >
          <p>{loadError}</p>
          <Button
            className="mt-3"
            onClick={() => {
              setLoading(true);
              reload();
            }}
            size="compact"
            variant="secondary"
          >
            Try again
          </Button>
        </Alert>
      ) : (
        <div className="mt-5 grid gap-5">
          <Panel
            description="Changing a role applies immediately. An organization always keeps at least one administrator."
            title={`Members of ${organizationName}`}
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
                      detail={`${member.email} · since ${formatDate(member.joinedAt)}`}
                      name={
                        isSelf
                          ? `${member.displayName} (you)`
                          : member.displayName
                      }
                      online={member.isOnline}
                    />
                    <div className="max-md:order-3 max-md:col-span-2">
                      <SelectField
                        disabled={busyId === member.userId}
                        hideLabel
                        label={`Role of ${member.displayName}`}
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
                            {item.label}
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
                        label={`Remove ${member.displayName} from ${organizationName}`}
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
            description="Roles given to addresses that have no confirmed account yet. The person joins when they confirm it."
            title="Reserved for an e-mail address"
          >
            {reservations.length ? (
              <ul className="border-t border-border">
                {reservations.map((reservation) => (
                  <li
                    className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center gap-3 border-t border-border px-5 py-3 first:border-t-0 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:px-4"
                    key={reservation.id}
                  >
                    <PersonCell
                      detail={`Reserved by ${reservation.grantedBy?.displayName ?? 'a former administrator'} · ${formatDate(reservation.updatedAt)}`}
                      name={reservation.email}
                    />
                    <span className="max-md:order-3">
                      <Tag>{organizationRoleLabel(reservation.role)}</Tag>
                    </span>
                    <span className="max-md:order-4">
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
                  description="When you assign a role to an address without a confirmed account, it waits here."
                  title="Nothing is waiting"
                />
              </div>
            )}
          </Panel>

          <CapabilityMatrix highlight={self?.role} />
        </div>
      )}

      {removing ? (
        <Dialog
          description={`${removing.displayName} loses access to ${organizationName} and its tickets immediately. Their open tickets go back to the unassigned queue. Their account is not affected.`}
          eyebrow="ROLES & ACCESS"
          footer={
            <>
              <Button onClick={() => setRemoving(null)} variant="secondary">
                Keep member
              </Button>
              <Button
                disabled={busyId === removing.userId}
                type="submit"
                variant="destructive"
              >
                Remove member
              </Button>
            </>
          }
          onClose={() => setRemoving(null)}
          onSubmit={(event) => {
            event.preventDefault();
            void remove(removing);
          }}
          title={`Remove ${removing.displayName}?`}
        />
      ) : null}

      {demotingSelf && self ? (
        <Dialog
          description={`You will stop administering ${organizationName}: this screen, members, categories and API keys will no longer be available to you. Another administrator would have to give the role back.`}
          eyebrow="ROLES & ACCESS"
          footer={
            <>
              <Button onClick={() => setDemotingSelf(null)} variant="secondary">
                Stay administrator
              </Button>
              <Button type="submit" variant="destructive">
                Become {organizationRoleLabel(demotingSelf)}
              </Button>
            </>
          }
          onClose={() => setDemotingSelf(null)}
          onSubmit={(event) => {
            event.preventDefault();
            void changeRole(self, demotingSelf);
          }}
          title="Give up your own administration?"
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
  const [members, setMembers] = useState<OrganizationMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    rolesGateway
      .listMembers(organizationId)
      .then((rows) => {
        if (active) setMembers(rows);
      })
      .catch((error: unknown) => {
        if (active)
          setLoadError(messageOf(error, 'The members could not be read.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organizationId]);

  const administrators = members.filter(
    (member) => member.role === 'ORG_ADMIN',
  );
  const agent = viewerRole === 'AGENT';

  return (
    <div className="mx-auto max-w-[1160px] p-10 max-md:px-4 max-md:py-6">
      <PageHeader
        description={
          agent
            ? `Who does what in ${organizationName}. Roles are assigned by the organization administrators.`
            : `Your access in ${organizationName}, what each role can do and whom to ask for a change.`
        }
        eyebrow="ORGANIZATION"
        title="Roles & access"
      />

      <section className="my-6 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 max-md:grid-cols-1">
        <article className="grid gap-1.5 rounded-md border border-border bg-surface p-5">
          <span className="text-xs text-muted">Your role</span>
          <strong className="text-lg font-medium">
            {organizationRoleLabel(viewerRole)}
          </strong>
          <p className="text-sm leading-6 text-muted">
            {roleDescription(viewerRole)}
          </p>
        </article>
        <article className="grid content-start gap-2 rounded-md border border-border bg-surface p-5">
          <span className="text-xs text-muted">Need a different role?</span>
          <p className="text-sm leading-6 text-muted">
            Only an organization administrator can change it. Write to one of
            them from Messages:
          </p>
          {loading ? null : administrators.length ? (
            <ul className="grid gap-2">
              {administrators.map((member) => (
                <li key={member.userId}>
                  {/* Names only: the member directory, with addresses, is
                      for agents and administrators. */}
                  <PersonCell
                    avatarUrl={member.avatarUrl}
                    detail="Organization admin"
                    name={member.displayName}
                    online={member.isOnline}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              No administrator could be listed right now.
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
            description="Read only. Agents see who handles what; administrators manage it."
            title={`People in ${organizationName}`}
          >
            {loading ? (
              <LoadingState label="Loading members" />
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
