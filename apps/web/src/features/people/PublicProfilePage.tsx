import { Avatar, Button, Dialog } from 'ui';
import { useState } from 'react';
import { initialConnections, people } from './peopleData';
import './people.css';

export function PublicProfilePage({
  onBack,
  onMessage,
  personName,
}: {
  onBack: () => void;
  onMessage: (personName: string) => void;
  personName: string;
}) {
  const initiallyConnected = initialConnections.includes(personName);
  const [connection, setConnection] = useState<
    'connected' | 'none' | 'pending'
  >(initiallyConnected ? 'connected' : 'none');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const person = people.find((item) => item.name === personName) ?? people[0];

  return (
    <div className="public-profile-page">
      <button className="public-profile-back" onClick={onBack} type="button">
        ← People
      </button>
      <section className="public-profile-hero">
        <Avatar
          alt={person.name}
          className="public-profile-avatar"
          initials={person.initials}
          online={person.status === 'Online'}
        />
        <div className="public-profile-identity">
          <h1>{person.name}</h1>
          <p>{person.role} · Northstar Studio</p>
          <span
            className={`person-presence person-presence--${person.status.toLowerCase()}`}
          >
            {person.status}
          </span>
          <p className="public-profile-bio">
            Helping people get unstuck through clear communication and
            dependable support.
          </p>
        </div>
        <div className="public-profile-actions">
          {connection === 'connected' ? (
            <>
              <Button onClick={() => onMessage(person.name)}>
                Send message
              </Button>
              <Button
                onClick={() => setConfirmDisconnect(true)}
                variant="secondary"
              >
                Disconnect
              </Button>
            </>
          ) : connection === 'pending' ? (
            <span className="public-profile-request-state">Request sent</span>
          ) : (
            <Button onClick={() => setConnection('pending')}>Connect</Button>
          )}
        </div>
      </section>
      <div className="public-profile-grid">
        <section>
          <h2>About</h2>
          <dl>
            <div>
              <dt>JOB TITLE</dt>
              <dd>{person.role}</dd>
            </div>
            <div>
              <dt>TEAM</dt>
              <dd>{person.team}</dd>
            </div>
            <div>
              <dt>LOCATION</dt>
              <dd>Barcelona, Spain</dd>
            </div>
            <div>
              <dt>MEMBER SINCE</dt>
              <dd>August 2026</dd>
            </div>
          </dl>
        </section>
        <aside>
          <h2>Shared context</h2>
          <p>Information relevant to your connection.</p>
          <dl>
            <div>
              <dt>Connection</dt>
              <dd>
                {connection === 'connected'
                  ? 'Connected since Aug 2026'
                  : connection === 'pending'
                    ? 'Connection request pending'
                    : 'Not connected'}
              </dd>
            </div>
            <div>
              <dt>Organization</dt>
              <dd>Northstar Studio</dd>
            </div>
            <div>
              <dt>Online state</dt>
              <dd>Visible</dd>
            </div>
            <div>
              <dt>Messages</dt>
              <dd>12 shared messages</dd>
            </div>
          </dl>
          {connection === 'connected' ? (
            <Button
              fullWidth
              onClick={() => onMessage(person.name)}
              variant="secondary"
            >
              Open conversation
            </Button>
          ) : (
            <p className="public-profile-connection-note">
              Connect first to start a persistent conversation.
            </p>
          )}
        </aside>
      </div>
      {confirmDisconnect ? (
        <Dialog
          description={`You can reconnect with ${person.name} later from the directory.`}
          eyebrow="CONNECTION"
          footer={
            <>
              <Button
                onClick={() => setConfirmDisconnect(false)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setConnection('none');
                  setConfirmDisconnect(false);
                }}
                variant="destructive"
              >
                Disconnect
              </Button>
            </>
          }
          onClose={() => setConfirmDisconnect(false)}
          title={`Disconnect from ${person.name}?`}
        />
      ) : null}
    </div>
  );
}
