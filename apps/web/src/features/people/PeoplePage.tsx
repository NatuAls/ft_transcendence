import { Alert, Avatar, Button, EmptyState, Icon } from 'ui';
import { useMemo, useState } from 'react';
import {
  incomingRequestNames,
  initialConnections,
  initialSentRequests,
  people,
} from './peopleData';

type PeopleTab = 'all' | 'colleagues' | 'requests';

export function PeoplePage({
  currentUserName,
  onOpenProfile,
}: {
  currentUserName: string;
  onOpenProfile: (personName: string) => void;
}) {
  const [tab, setTab] = useState<PeopleTab>('all');
  const [connected, setConnected] = useState(initialConnections);
  const [dismissedRequests, setDismissedRequests] = useState<string[]>([]);
  const [sentRequests, setSentRequests] = useState(initialSentRequests);
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState('');
  const pendingRequests = useMemo(
    () =>
      incomingRequestNames.filter((name) => !dismissedRequests.includes(name)),
    [dismissedRequests],
  );
  const visiblePeople = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return people.filter((person) => {
      if (person.name === currentUserName) return false;
      const matchesQuery = `${person.name} ${person.role} ${person.team}`
        .toLowerCase()
        .includes(normalizedQuery);
      if (!matchesQuery) return false;
      if (tab === 'colleagues') return connected.includes(person.name);
      if (tab === 'requests') return pendingRequests.includes(person.name);
      return true;
    });
  }, [connected, currentUserName, pendingRequests, query, tab]);

  function resolveRequest(personName: string, accept: boolean) {
    setDismissedRequests((current) => [...current, personName]);
    if (accept) setConnected((current) => [...current, personName]);
    setFeedback(
      accept
        ? `${personName} was added to your colleagues.`
        : `The request from ${personName} was declined.`,
    );
  }

  return (
    <div className="mx-auto max-w-[1160px] p-10 max-md:px-4 max-md:py-6">
      <header>
        <span className="text-[11px] tracking-[.08em] text-muted max-md:hidden">
          DIRECTORY
        </span>
        <h1 className="my-2 text-[30px] font-medium max-md:text-[22px]">
          People
        </h1>
        <p className="text-sm text-muted max-md:text-xs">
          {tab === 'requests'
            ? 'Review incoming requests and track invitations you have sent.'
            : tab === 'colleagues'
              ? 'View your colleagues, check availability and start a conversation.'
              : 'Find colleagues, manage connections and start a conversation.'}
        </p>
      </header>
      <label className="my-5 mt-7 flex h-[42px] w-80 items-center gap-[9px] rounded-sm border border-border bg-surface px-[13px] focus-within:border-focus focus-within:outline-3 focus-within:outline-focus/20 max-md:my-2.5 max-md:mt-5 max-md:w-full">
        <Icon name="search" size={16} />
        <input
          className="min-w-0 flex-1 border-0 bg-transparent outline-0 focus-visible:!outline-none"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people"
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
            ['all', 'All people'],
            ['colleagues', 'Colleagues'],
            ['requests', 'Requests'],
          ] as const
        ).map(([value, label]) => (
          <button
            aria-current={tab === value ? 'page' : undefined}
            className={`flex gap-[7px] border-b-2 px-[18px] py-3 text-[13px] max-md:px-[7px] max-md:py-[11px] max-md:text-[11px] ${tab === value ? 'border-primary text-primary' : 'border-transparent text-muted'}`}
            key={value}
            onClick={() => setTab(value)}
            type="button"
          >
            {label}
            {value === 'requests' && (
              <small className="rounded-full bg-[#e9dfd0] px-[7px] py-0.5 text-[9px] text-warning max-md:hidden">
                {pendingRequests.length} pending
              </small>
            )}
          </button>
        ))}
      </nav>
      {tab === 'requests' && (
        <h2 className="mb-4 text-base font-medium">Connection requests</h2>
      )}
      {feedback ? (
        <Alert
          aria-live="polite"
          className="mb-[14px] !py-2.5 !text-[11px] !text-muted"
          role="status"
          tone="success"
        >
          {feedback}
        </Alert>
      ) : null}
      <section className="grid grid-cols-3 gap-[14px] max-md:grid-cols-1 max-md:gap-[9px]">
        {visiblePeople.map((person) => {
          const isConnected = connected.includes(person.name);
          const isPending = sentRequests.includes(person.name);
          const incoming = tab === 'requests';
          return (
            <article
              className="rounded-md border border-border bg-surface p-5 max-md:grid max-md:grid-cols-[48px_1fr_auto] max-md:items-center max-md:p-[14px]"
              key={person.name}
            >
              <div className="flex items-start justify-between max-md:relative">
                <button
                  aria-label={`View ${person.name}'s profile`}
                  className="rounded-full"
                  onClick={() => onOpenProfile(person.name)}
                  type="button"
                >
                  <Avatar
                    className="!size-[46px] !basis-[46px]"
                    initials={person.initials}
                  />
                </button>
                <span
                  className={`inline-flex items-center gap-[5px] text-[10px] before:size-1.5 before:rounded-full before:bg-current before:content-[''] max-md:absolute max-md:-top-2 max-md:-left-1 max-md:rounded-full max-md:bg-surface max-md:px-1 max-md:py-0.5 max-md:text-[8px] ${person.status === 'Online' ? 'text-success' : person.status === 'Away' ? 'text-warning' : 'text-muted'}`}
                >
                  {person.status}
                </span>
              </div>
              <button
                className="min-w-0 text-left focus-visible:rounded-sm"
                onClick={() => onOpenProfile(person.name)}
                type="button"
              >
                <h2 className="mt-[14px] mb-[5px] text-base font-medium max-md:m-0 max-md:mb-1 max-md:text-sm">
                  {person.name}
                </h2>
                <p className="min-h-9 text-[11px] text-muted max-md:min-h-0 max-md:text-[10px]">
                  {person.role} · {person.team}
                </p>
              </button>
              <footer className="mt-4 flex items-center justify-between border-t border-border pt-[14px] max-md:m-0 max-md:border-0 max-md:p-0 max-md:[&_.ui-button]:!min-h-[34px] max-md:[&_.ui-button]:!min-w-[75px] max-md:[&_.ui-button]:!px-[9px]">
                <button
                  className="text-[11px] text-primary max-md:hidden"
                  onClick={() => onOpenProfile(person.name)}
                  type="button"
                >
                  View profile
                </button>
                {incoming ? (
                  <div className="flex min-w-0 gap-2 [&_.ui-button]:!min-w-0 [&_.ui-button]:!px-4 max-md:[&_.ui-button]:!min-w-[75px] max-md:[&_.ui-button]:!px-[9px]">
                    <Button
                      onClick={() => resolveRequest(person.name, false)}
                      variant="ghost"
                    >
                      Decline
                    </Button>
                    <Button onClick={() => resolveRequest(person.name, true)}>
                      Accept
                    </Button>
                  </div>
                ) : isConnected ? (
                  <span className="rounded-sm bg-surface-secondary px-3 py-[9px] text-[11px] text-muted">
                    Connected
                  </span>
                ) : isPending ? (
                  <span className="rounded-sm bg-[#efe9dc] px-3 py-[9px] text-[11px] text-warning">
                    Pending
                  </span>
                ) : (
                  <Button
                    onClick={() => {
                      setSentRequests((current) => [...current, person.name]);
                      setFeedback(`Connection request sent to ${person.name}.`);
                    }}
                    size="compact"
                  >
                    Connect
                  </Button>
                )}
              </footer>
            </article>
          );
        })}
        {!visiblePeople.length ? (
          <div className="col-span-full">
            <EmptyState
              description="Try another search or filter."
              title="No people match this view"
            />
          </div>
        ) : null}
      </section>
      {tab === 'requests' && (
        <section className="mt-6">
          <h2 className="mb-4 text-base font-medium">Sent requests</h2>
          <div className="grid grid-cols-3 gap-[14px] max-md:grid-cols-1 max-md:gap-[9px]">
            {people
              .filter(
                (person) =>
                  person.name !== currentUserName &&
                  sentRequests.includes(person.name),
              )
              .map((person) => (
                <article
                  className="rounded-md border border-border bg-surface p-5 max-md:grid max-md:grid-cols-[48px_1fr_auto] max-md:items-center max-md:p-[14px]"
                  key={person.name}
                >
                  <div className="flex items-start justify-between max-md:relative">
                    <button
                      aria-label={`View ${person.name}'s profile`}
                      className="rounded-full"
                      onClick={() => onOpenProfile(person.name)}
                      type="button"
                    >
                      <Avatar
                        className="!size-[46px] !basis-[46px]"
                        initials={person.initials}
                      />
                    </button>
                    <span
                      className={`inline-flex items-center gap-[5px] text-[10px] before:size-1.5 before:rounded-full before:bg-current before:content-[''] max-md:absolute max-md:-top-2 max-md:-left-1 max-md:rounded-full max-md:bg-surface max-md:px-1 max-md:py-0.5 max-md:text-[8px] ${person.status === 'Online' ? 'text-success' : person.status === 'Away' ? 'text-warning' : 'text-muted'}`}
                    >
                      {person.status}
                    </span>
                  </div>
                  <button
                    className="min-w-0 text-left focus-visible:rounded-sm"
                    onClick={() => onOpenProfile(person.name)}
                    type="button"
                  >
                    <h3 className="mt-[14px] mb-[5px] text-base font-medium max-md:m-0 max-md:mb-1 max-md:text-sm">
                      {person.name}
                    </h3>
                    <p className="min-h-9 text-[11px] text-muted max-md:min-h-0 max-md:text-[10px]">
                      {person.role} · {person.team}
                    </p>
                  </button>
                  <footer className="mt-4 flex items-center justify-between border-t border-border pt-[14px] max-md:m-0 max-md:border-0 max-md:p-0">
                    <button
                      className="text-[11px] text-primary max-md:hidden"
                      onClick={() => onOpenProfile(person.name)}
                      type="button"
                    >
                      View profile
                    </button>
                    <span className="rounded-sm bg-[#efe9dc] px-3 py-[9px] text-[11px] text-warning">
                      Pending
                    </span>
                  </footer>
                </article>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
