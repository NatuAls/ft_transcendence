import { Avatar, Button } from 'ui';
import { useMemo, useState } from 'react';
import {
  incomingRequestNames,
  initialConnections,
  initialSentRequests,
  people,
} from './peopleData';
import './people.css';

type PeopleTab = 'all' | 'colleagues' | 'requests';

export function PeoplePage({
  onOpenProfile,
}: {
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
      const matchesQuery = `${person.name} ${person.role} ${person.team}`
        .toLowerCase()
        .includes(normalizedQuery);
      if (!matchesQuery) return false;
      if (tab === 'colleagues') return connected.includes(person.name);
      if (tab === 'requests') return pendingRequests.includes(person.name);
      return true;
    });
  }, [connected, pendingRequests, query, tab]);

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
    <div className="people-page">
      <header>
        <span>DIRECTORY</span>
        <h1>People</h1>
        <p>
          {tab === 'requests'
            ? 'Review incoming requests and track invitations you have sent.'
            : tab === 'colleagues'
              ? 'View your colleagues, check availability and start a conversation.'
              : 'Find colleagues, manage connections and start a conversation.'}
        </p>
      </header>
      <label className="people-search">
        <span aria-hidden="true">⌕</span>
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people"
          type="search"
          value={query}
        />
      </label>
      <nav aria-label="People filters" className="people-tabs">
        {(
          [
            ['all', 'All people'],
            ['colleagues', 'Colleagues'],
            ['requests', 'Requests'],
          ] as const
        ).map(([value, label]) => (
          <button
            aria-current={tab === value ? 'page' : undefined}
            key={value}
            onClick={() => setTab(value)}
            type="button"
          >
            {label}
            {value === 'requests' && (
              <small>{pendingRequests.length} pending</small>
            )}
          </button>
        ))}
      </nav>
      {tab === 'requests' && (
        <h2 className="people-section-title">Connection requests</h2>
      )}
      {feedback ? (
        <p aria-live="polite" className="people-feedback" role="status">
          {feedback}
        </p>
      ) : null}
      <section className="people-grid">
        {visiblePeople.map((person) => {
          const isConnected = connected.includes(person.name);
          const isPending = sentRequests.includes(person.name);
          const incoming = tab === 'requests';
          return (
            <article className="person-card" key={person.name}>
              <div className="person-card__top">
                <Avatar className="person-avatar" initials={person.initials} />
                <span
                  className={`person-presence person-presence--${person.status.toLowerCase()}`}
                >
                  {person.status}
                </span>
              </div>
              <div className="person-card__copy">
                <h2>{person.name}</h2>
                <p>
                  {person.role} · {person.team}
                </p>
              </div>
              <footer>
                <button
                  onClick={() => onOpenProfile(person.name)}
                  type="button"
                >
                  View profile
                </button>
                {incoming ? (
                  <div>
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
                  <span className="person-connection">Connected</span>
                ) : isPending ? (
                  <span className="person-connection person-connection--pending">
                    Pending
                  </span>
                ) : (
                  <Button
                    onClick={() => {
                      setSentRequests((current) => [...current, person.name]);
                      setFeedback(`Connection request sent to ${person.name}.`);
                    }}
                  >
                    Connect
                  </Button>
                )}
              </footer>
            </article>
          );
        })}
        {!visiblePeople.length ? (
          <p className="people-empty">No people match this view.</p>
        ) : null}
      </section>
      {tab === 'requests' && (
        <section className="sent-requests">
          <h2>Sent requests</h2>
          {people
            .filter((person) => sentRequests.includes(person.name))
            .map((person) => (
              <div key={person.name}>
                <Avatar className="person-avatar" initials={person.initials} />
                <strong>{person.name}</strong>
                <span>Pending</span>
              </div>
            ))}
        </section>
      )}
      <p className="people-note">
        Public profiles show only shared information, role and online state.
      </p>
    </div>
  );
}
