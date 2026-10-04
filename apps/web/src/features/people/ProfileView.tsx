import { Alert, Avatar, Button, EmptyState, LoadingState } from 'ui';
import { useEffect, useState } from 'react';
import * as social from '../../api/social';
import { onPresenceChange } from '../../app/realtime';
import { getInitials } from '../../app/text';
import { openConversation } from '../messages/messagesApi';
import { errorMessage } from '../../core/api/errors';
import { useAsync } from '../../core/async/useAsync';

type Relation =
  | { kind: 'friend'; since: string }
  | { kind: 'incoming'; requestId: string }
  | { kind: 'none' }
  | { kind: 'outgoing' }
  | { kind: 'self' };

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const monthFormat = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
});

const roleLabels: Record<string, string> = {
  AGENT: 'Support agent',
  MEMBER: 'Member',
  ORG_ADMIN: 'Organization admin',
};

/** A person's public profile, from `GET /users/:username`. */
export function ProfileView({
  currentUserId,
  onBack,
  onEditOwnProfile,
  onMessage,
  username,
}: {
  currentUserId: string;
  onBack: () => void;
  onEditOwnProfile: () => void;
  onMessage: (username: string) => void;
  username: string;
}) {
  const [feedback, setFeedback] = useState('');
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<{
    isOnline: boolean;
    lastSeenAt?: string;
  } | null>(null);
  // La relación con esa persona se deduce de las tres lecturas, así que
  // viaja con ellas en una sola carga y no en un estado aparte que pueda
  // quedarse desfasado.
  const page = useAsync(async () => {
    const [person, friends, requests] = await Promise.all([
      social.getPublicProfile(username),
      social.listFriends(),
      social.listFriendRequests(),
    ]);
    const friendship = friends.find((row) => row.user.id === person.id);
    const received = requests.incoming.find(
      (row) => row.requester.id === person.id,
    );
    const sent = requests.outgoing.some(
      (row) => row.addressee.id === person.id,
    );
    const next: Relation =
      person.id === currentUserId
        ? { kind: 'self' }
        : friendship
          ? { kind: 'friend', since: friendship.since }
          : received
            ? { kind: 'incoming', requestId: received.id }
            : sent
              ? { kind: 'outgoing' }
              : { kind: 'none' };
    return { person, relation: next };
  }, [currentUserId, username]);

  const profile = page.data?.person ?? null;
  const loading = page.status === 'loading';
  // Esta pantalla sólo tiene dos desenlaces: la persona existe o no. Un fallo
  // de lectura se cuenta como «no está», que es lo que ya hacía.
  const missing = page.status === 'error';
  const reload = page.reload;

  // La relación se deriva de la carga: las acciones (aceptar, retirar,
  // eliminar) recargan, así que no hace falta un estado paralelo que pueda
  // contradecir a los datos.
  const relation: Relation = page.data?.relation ?? { kind: 'none' };

  useEffect(
    () =>
      onPresenceChange((change) => {
        if (change.userId === profile?.id)
          setLive({ isOnline: change.isOnline, lastSeenAt: change.lastSeenAt });
      }),
    [profile?.id],
  );

  async function act(action: () => Promise<void>, done: string) {
    setBusy(true);
    setFeedback('');
    setFailure('');
    try {
      await action();
      setFeedback(done);
      reload();
    } catch (error) {
      setFailure(errorMessage(error, 'The request could not be completed.'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1160px] p-10 max-md:px-4 max-md:py-6">
        <LoadingState label="Loading profile" />
      </div>
    );
  }

  if (missing || !profile) {
    return (
      <div className="mx-auto max-w-[1160px] p-10 max-md:px-4 max-md:py-6">
        <button className="text-primary" onClick={onBack} type="button">
          ← People
        </button>
        <div className="mt-7">
          <EmptyState
            description="The account may have been deleted, or the link is wrong."
            title="This profile does not exist"
          />
        </div>
      </div>
    );
  }

  const isOnline = live?.isOnline ?? profile.isOnline;
  const lastSeenAt = live?.lastSeenAt ?? profile.lastSeenAt;
  const name = profile.displayName;

  return (
    <div className="mx-auto max-w-[1160px] p-10 max-md:px-4 max-md:py-6">
      <button
        className="text-primary max-md:pb-5"
        onClick={onBack}
        type="button"
      >
        ← People
      </button>
      <section className="mt-7 grid grid-cols-[84px_1fr_auto] items-center gap-x-5 rounded-md border border-border bg-surface p-[30px] max-md:mt-0 max-md:flex max-md:flex-col max-md:p-6 max-md:text-center">
        <Avatar
          alt={name}
          className="!size-16 !basis-16 !text-[1.0625rem]"
          initials={getInitials(name)}
          online={isOnline}
          src={profile.avatarUrl ?? undefined}
        />
        <div>
          <h1 className="mb-[5px] text-[1.625rem] font-medium max-md:mt-3 max-md:text-[1.375rem]">
            {name}
          </h1>
          <p className="mb-2 text-xs text-muted">
            @{profile.username}
            {profile.jobTitle ? ` · ${profile.jobTitle}` : ''}
          </p>
          <span
            className={`inline-flex items-center gap-[5px] text-2xs before:size-1.5 before:rounded-full before:bg-current before:content-[''] ${isOnline ? 'text-success' : 'text-muted'}`}
          >
            {isOnline
              ? 'Online'
              : lastSeenAt
                ? `Last seen ${dateFormat.format(new Date(lastSeenAt))}`
                : 'Offline'}
          </span>
          {profile.bio ? (
            <p className="mt-4 max-w-[620px] text-[0.8125rem] leading-[1.55] text-muted">
              {profile.bio}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2 max-md:mt-5 max-md:w-full max-md:[&_.ui-button]:flex-1">
          {relation.kind === 'self' ? (
            <Button onClick={onEditOwnProfile} variant="secondary">
              Edit your profile
            </Button>
          ) : relation.kind === 'friend' ? (
            <>
              <Button
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  openConversation(profile.id)
                    .then(() => onMessage(profile.username))
                    .catch((error: unknown) => {
                      setFailure(
                        errorMessage(
                          error,
                          'The conversation could not be opened.',
                        ),
                      );
                      setBusy(false);
                    });
                }}
              >
                Send message
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void act(
                    () => social.removeFriend(profile.id),
                    `${name} was removed from your friends.`,
                  )
                }
                variant="secondary"
              >
                Remove friend
              </Button>
            </>
          ) : relation.kind === 'incoming' ? (
            <>
              <Button
                disabled={busy}
                onClick={() =>
                  void act(
                    () =>
                      social.answerFriendRequest(relation.requestId, 'ACCEPT'),
                    `${name} is now one of your friends.`,
                  )
                }
              >
                Accept request
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void act(
                    () =>
                      social.answerFriendRequest(relation.requestId, 'DECLINE'),
                    `The request from ${name} was declined.`,
                  )
                }
                variant="secondary"
              >
                Decline
              </Button>
            </>
          ) : relation.kind === 'outgoing' ? (
            <Button
              disabled={busy}
              onClick={() =>
                void act(
                  () => social.removeFriend(profile.id),
                  `Your request to ${name} was withdrawn.`,
                )
              }
              variant="secondary"
            >
              Withdraw request
            </Button>
          ) : (
            <Button
              disabled={busy}
              onClick={() =>
                void act(
                  () => social.sendFriendRequest(profile.id),
                  `Friend request sent to ${name}.`,
                )
              }
            >
              Add friend
            </Button>
          )}
        </div>
      </section>
      {feedback ? (
        <Alert aria-live="polite" className="mt-4" role="status" tone="success">
          {feedback}
        </Alert>
      ) : null}
      {failure ? (
        <Alert className="mt-4" tone="danger">
          {failure}
        </Alert>
      ) : null}
      <div className="mt-5 grid grid-cols-[1fr_340px] gap-5 max-md:mt-3 max-md:block">
        <section className="rounded-md border border-border bg-surface p-[25px] max-md:p-[18px]">
          <h2 className="mb-5 text-base font-medium">About</h2>
          <dl className="grid grid-cols-2 gap-5">
            <div>
              <dt className="text-3xs tracking-[.06em] text-muted">
                JOB TITLE
              </dt>
              <dd className="mt-[5px] text-xs">{profile.jobTitle || '—'}</dd>
            </div>
            <div>
              <dt className="text-3xs tracking-[.06em] text-muted">
                MEMBER SINCE
              </dt>
              <dd className="mt-[5px] text-xs">
                {monthFormat.format(new Date(profile.createdAt))}
              </dd>
            </div>
            <div>
              <dt className="text-3xs tracking-[.06em] text-muted">
                TICKETS OPENED
              </dt>
              <dd className="mt-[5px] text-xs">
                {profile.stats.ticketsCreated}
              </dd>
            </div>
            <div>
              <dt className="text-3xs tracking-[.06em] text-muted">
                TICKETS HANDLED
              </dt>
              <dd className="mt-[5px] text-xs">
                {profile.stats.ticketsAssigned}
              </dd>
            </div>
          </dl>
        </section>
        <aside className="rounded-md border border-border bg-surface p-[25px] max-md:mt-3 max-md:p-[18px]">
          <h2 className="mb-5 text-base font-medium">Organizations</h2>
          {profile.organizations.length ? (
            <ul className="grid gap-3">
              {profile.organizations.map((organization) => (
                <li
                  className="flex items-center justify-between gap-3 text-xs"
                  key={organization.id}
                >
                  <span>{organization.name}</span>
                  <span className="text-muted">
                    {roleLabels[organization.role] ?? organization.role}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">Not in any organization.</p>
          )}
          {relation.kind === 'friend' ? (
            <p className="mt-5 rounded-sm bg-surface-secondary p-3 text-center text-xs text-muted">
              Friends since {dateFormat.format(new Date(relation.since))}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
