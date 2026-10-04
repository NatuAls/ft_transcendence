import { Alert, Avatar, Button, EmptyState, Icon, LoadingState } from 'ui';
import { useEffect, useMemo, useState } from 'react';
import { AsyncState } from '../../core/async/AsyncState';
import { useAsync } from '../../core/async/useAsync';
import { errorMessage } from '../../core/api/errors';
import * as social from '../../api/social';
import { listMembers } from '../../api/roles';
import { onPresenceChange } from '../../app/realtime';
import { getInitials } from '../../app/text';
import { openConversation } from '../messages/messagesApi';

type PeopleTab = 'all' | 'colleagues' | 'requests';
type Relation = 'friend' | 'incoming' | 'none' | 'outgoing';

interface Person {
  avatarUrl: string | null;
  id: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  name: string;
  relation: Relation;
  requestId?: string;
  since?: string;
  username: string;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

function personFrom(
  user: social.PublicPerson,
  relation: Relation,
  extra: Partial<Person> = {},
): Person {
  return {
    avatarUrl: user.profile?.avatarUrl ?? null,
    id: user.id,
    isOnline: Boolean(user.profile?.isOnline),
    lastSeenAt: user.profile?.lastSeenAt ?? null,
    name: user.profile?.displayName || user.username,
    relation,
    username: user.username,
    ...extra,
  };
}

/**
 * The people screen against the API: friends with their live presence,
 * friend requests both ways, and the colleagues of the active organization
 * plus anybody found by search, to send a request to.
 */
export function PeopleDirectory({
  currentUserId,
  onMessage,
  onOpenProfile,
  organizationId,
}: {
  currentUserId: string;
  onMessage: (username: string) => void;
  onOpenProfile: (username: string) => void;
  organizationId: string;
}) {
  const [tab, setTab] = useState<PeopleTab>('colleagues');
  const [found, setFound] = useState<Person[]>([]);
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState('');
  const [failure, setFailure] = useState('');
  const [busyId, setBusyId] = useState('');
  const [presence, setPresence] = useState<
    Record<string, { isOnline: boolean; lastSeenAt?: string }>
  >({});

  const directory = useAsync(async () => {
    const [friendRows, requests, members] = await Promise.all([
      social.listFriends(),
      social.listFriendRequests(),
      organizationId ? listMembers(organizationId).catch(() => []) : [],
    ]);
    return {
      friends: friendRows.map((row) =>
        personFrom(row.user, 'friend', { since: row.since }),
      ),
      incoming: requests.incoming.map((row) =>
        personFrom(row.requester, 'incoming', { requestId: row.id }),
      ),
      outgoing: requests.outgoing.map((row) =>
        personFrom(row.addressee, 'outgoing', { requestId: row.id }),
      ),
      colleagues: members.map((member) => ({
        avatarUrl: member.avatarUrl,
        id: member.userId,
        isOnline: member.isOnline,
        lastSeenAt: null,
        name: member.displayName,
        relation: 'none' as const,
        username: member.username,
      })),
    };
  }, [organizationId]);
  const friends = useMemo(
    () => directory.data?.friends ?? [],
    [directory.data],
  );
  const incoming = useMemo(
    () => directory.data?.incoming ?? [],
    [directory.data],
  );
  const outgoing = useMemo(
    () => directory.data?.outgoing ?? [],
    [directory.data],
  );
  const colleagues = useMemo(
    () => directory.data?.colleagues ?? [],
    [directory.data],
  );
  const reload = directory.reload;

  // Search as you type, from two characters: the API refuses shorter terms.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    let active = true;
    const timer = window.setTimeout(() => {
      social
        .searchPeople(term)
        .then((rows) => {
          if (active) setFound(rows.map((row) => personFrom(row, 'none')));
        })
        .catch(() => {
          if (active) setFound([]);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  // Presence, live: the server tells every connected client when somebody
  // comes online or leaves.
  useEffect(
    () =>
      onPresenceChange((change) =>
        setPresence((current) => ({
          ...current,
          [change.userId]: {
            isOnline: change.isOnline,
            lastSeenAt: change.lastSeenAt,
          },
        })),
      ),
    [],
  );

  const relationOf = useMemo(() => {
    const map = new Map<string, Person>();
    for (const person of [...outgoing, ...incoming, ...friends])
      map.set(person.id, person);
    return map;
  }, [friends, incoming, outgoing]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = (person: Person) =>
      !term || `${person.name} ${person.username}`.toLowerCase().includes(term);
    let list: Person[];
    if (tab === 'colleagues') list = friends.filter(matches);
    else if (tab === 'requests') list = incoming.filter(matches);
    else {
      // Colleagues and friends filtered here; search results come already
      // matched by the server, which also looks at the e-mail address.
      const byId = new Map<string, Person>();
      for (const person of [...colleagues, ...friends].filter(matches))
        byId.set(person.id, person);
      if (term.length >= 2)
        for (const person of found) byId.set(person.id, person);
      list = [...byId.values()].map(
        (person) => relationOf.get(person.id) ?? person,
      );
    }
    return list
      .filter((person) => person.id !== currentUserId)
      .map((person) => ({
        ...person,
        isOnline: presence[person.id]?.isOnline ?? person.isOnline,
        lastSeenAt: presence[person.id]?.lastSeenAt ?? person.lastSeenAt,
      }));
  }, [
    colleagues,
    currentUserId,
    found,
    friends,
    incoming,
    presence,
    query,
    relationOf,
    tab,
  ]);

  async function act(
    person: Person,
    action: () => Promise<void>,
    done: string,
  ) {
    setBusyId(person.id);
    setFeedback('');
    setFailure('');
    try {
      await action();
      setFeedback(done);
      reload();
    } catch (error) {
      setFailure(errorMessage(error, 'The request could not be completed.'));
    } finally {
      setBusyId('');
    }
  }

  async function message(person: Person) {
    setBusyId(person.id);
    try {
      await openConversation(person.id);
      onMessage(person.username);
    } catch (error) {
      setFailure(errorMessage(error, 'The conversation could not be opened.'));
      setBusyId('');
    }
  }

  function presenceLabel(person: Person) {
    if (person.isOnline) return 'Online';
    return person.lastSeenAt
      ? `Last seen ${dateFormat.format(new Date(person.lastSeenAt))}`
      : 'Offline';
  }

  function actions(person: Person) {
    const busy = busyId === person.id;
    if (person.relation === 'incoming' && person.requestId) {
      const requestId = person.requestId;
      return (
        <div className="flex min-w-0 gap-2 [&_.ui-button]:!min-w-0 [&_.ui-button]:!px-4">
          <Button
            disabled={busy}
            onClick={() =>
              void act(
                person,
                () => social.answerFriendRequest(requestId, 'DECLINE'),
                `The request from ${person.name} was declined.`,
              )
            }
            variant="ghost"
          >
            Decline
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void act(
                person,
                () => social.answerFriendRequest(requestId, 'ACCEPT'),
                `${person.name} is now one of your friends.`,
              )
            }
          >
            Accept
          </Button>
        </div>
      );
    }
    if (person.relation === 'friend') {
      return (
        <div className="flex gap-2">
          <Button
            disabled={busy}
            onClick={() => void message(person)}
            size="compact"
            variant="secondary"
          >
            Message
          </Button>
          <Button
            aria-label={`Remove ${person.name} from your friends`}
            disabled={busy}
            onClick={() =>
              void act(
                person,
                () => social.removeFriend(person.id),
                `${person.name} was removed from your friends.`,
              )
            }
            size="compact"
            variant="ghost"
          >
            Remove
          </Button>
        </div>
      );
    }
    if (person.relation === 'outgoing') {
      return (
        <Button
          aria-label={`Withdraw the request to ${person.name}`}
          disabled={busy}
          onClick={() =>
            void act(
              person,
              () => social.removeFriend(person.id),
              `Your request to ${person.name} was withdrawn.`,
            )
          }
          size="compact"
          variant="ghost"
        >
          Withdraw request
        </Button>
      );
    }
    return (
      <Button
        disabled={busy}
        onClick={() =>
          void act(
            person,
            () => social.sendFriendRequest(person.id),
            `Friend request sent to ${person.name}.`,
          )
        }
        size="compact"
      >
        Add friend
      </Button>
    );
  }

  function card(person: Person) {
    return (
      <article
        className="rounded-md border border-border bg-surface p-5 max-md:grid max-md:grid-cols-[48px_1fr] max-md:items-center max-md:gap-x-3 max-md:p-[14px]"
        key={`${person.relation}-${person.id}`}
      >
        <div className="flex items-start justify-between max-md:row-span-2">
          <button
            aria-label={`View ${person.name}'s profile`}
            className="rounded-full"
            onClick={() => onOpenProfile(person.username)}
            type="button"
          >
            <Avatar
              className="!size-[46px] !basis-[46px]"
              initials={getInitials(person.name)}
              online={person.isOnline}
              src={person.avatarUrl ?? undefined}
            />
          </button>
          <span
            className={`inline-flex items-center gap-[5px] text-2xs before:size-1.5 before:rounded-full before:bg-current before:content-[''] max-md:hidden ${person.isOnline ? 'text-success' : 'text-muted'}`}
          >
            {presenceLabel(person)}
          </span>
        </div>
        <button
          className="min-w-0 text-left focus-visible:rounded-sm"
          onClick={() => onOpenProfile(person.username)}
          type="button"
        >
          <h2 className="mt-[14px] mb-[5px] text-base font-medium max-md:m-0 max-md:mb-0.5 max-md:text-sm">
            {person.name}
          </h2>
          <p className="min-h-9 text-xs2 text-muted max-md:min-h-0">
            @{person.username}
            {person.relation === 'friend' && person.since
              ? ` · Friends since ${dateFormat.format(new Date(person.since))}`
              : ''}
            <span className="hidden max-md:inline">
              {' · '}
              {presenceLabel(person)}
            </span>
          </p>
        </button>
        <footer className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-[14px] max-md:col-start-2 max-md:mt-2 max-md:border-0 max-md:p-0">
          <button
            className="text-xs2 text-primary max-md:hidden"
            onClick={() => onOpenProfile(person.username)}
            type="button"
          >
            View profile
          </button>
          {actions(person)}
        </footer>
      </article>
    );
  }

  return (
    <div className="mx-auto max-w-[1160px] p-10 max-md:px-4 max-md:py-6">
      <header>
        <span className="text-xs2 tracking-[.08em] text-muted max-md:hidden">
          DIRECTORY
        </span>
        <h1 className="my-2 text-[1.875rem] font-medium max-md:text-[1.375rem]">
          People
        </h1>
        <p className="text-sm text-muted max-md:text-xs">
          {tab === 'requests'
            ? 'Answer the friend requests you received and follow the ones you sent.'
            : tab === 'colleagues'
              ? 'Your friends, whether they are online right now, and a message away.'
              : 'Colleagues of your organization, and anybody you search for by name or username.'}
        </p>
      </header>
      <label className="my-5 mt-7 flex h-[42px] w-80 items-center gap-[9px] rounded-sm border border-border bg-surface px-[13px] focus-within:border-focus focus-within:outline-3 focus-within:outline-focus max-md:my-2.5 max-md:mt-5 max-md:w-full">
        <Icon name="search" size={16} />
        <span className="sr-only">Search people</span>
        <input
          className="min-w-0 flex-1 border-0 bg-transparent outline-0 focus-visible:!outline-none"
          onChange={(event) => {
            setQuery(event.target.value);
            if (event.target.value.trim().length >= 2) setTab('all');
          }}
          placeholder="Search by name or username"
          type="search"
          value={query}
        />
      </label>
      <nav
        aria-label="People filters"
        className="mb-5 flex gap-1 border-b border-border max-md:justify-around"
      >
        {(
          [
            ['colleagues', `Friends (${friends.length})`],
            ['requests', 'Requests'],
            ['all', 'Find people'],
          ] as const
        ).map(([value, label]) => (
          <button
            aria-current={tab === value ? 'page' : undefined}
            className={`flex items-center gap-[7px] border-b-2 px-[18px] py-3 text-[0.8125rem] max-md:px-[7px] max-md:py-[11px] max-md:text-xs2 ${tab === value ? 'border-primary text-primary' : 'border-transparent text-muted'}`}
            key={value}
            onClick={() => setTab(value)}
            type="button"
          >
            {label}
            {value === 'requests' && incoming.length ? (
              <small className="inline-flex items-center rounded-full bg-[#e9dfd0] px-[7px] py-0.5 text-3xs leading-none text-warning">
                {incoming.length} pending
              </small>
            ) : null}
          </button>
        ))}
      </nav>
      {feedback ? (
        <Alert
          aria-live="polite"
          className="mb-[14px] !py-2.5 !text-xs2 !text-muted"
          role="status"
          tone="success"
        >
          {feedback}
        </Alert>
      ) : null}
      {failure ? (
        <Alert className="mb-[14px] !py-2.5 !text-xs2" tone="danger">
          {failure}
        </Alert>
      ) : null}
      <AsyncState
        error={directory.error}
        errorTitle="People could not be read"
        loading={<LoadingState label="Loading people" />}
        onRetry={reload}
        status={directory.status}
      >
        <>
          {tab === 'requests' ? (
            <h2 className="mb-4 text-base font-medium">Received</h2>
          ) : null}
          <section className="grid grid-cols-3 gap-[14px] max-[1000px]:grid-cols-2 max-md:grid-cols-1 max-md:gap-[9px]">
            {visible.map(card)}
            {!visible.length ? (
              <div className="col-span-full">
                <EmptyState
                  description={
                    tab === 'colleagues'
                      ? 'Find people by name or username and send them a friend request.'
                      : tab === 'requests'
                        ? 'Nobody is waiting for your answer.'
                        : 'Type at least two characters to search the whole platform.'
                  }
                  title={
                    tab === 'colleagues'
                      ? 'No friends yet'
                      : tab === 'requests'
                        ? 'No pending requests'
                        : 'Nobody matches this search'
                  }
                />
              </div>
            ) : null}
          </section>
          {tab === 'requests' && outgoing.length ? (
            <section className="mt-6">
              <h2 className="mb-4 text-base font-medium">Sent</h2>
              <div className="grid grid-cols-3 gap-[14px] max-[1000px]:grid-cols-2 max-md:grid-cols-1 max-md:gap-[9px]">
                {outgoing.map(card)}
              </div>
            </section>
          ) : null}
        </>
      </AsyncState>
    </div>
  );
}
