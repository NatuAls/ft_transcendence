import { Avatar, Button, Dialog } from 'ui';
import { useState } from 'react';
import { initialConnections, people } from './peopleData';

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
    <div className="mx-auto max-w-[1160px] p-10 max-md:px-4 max-md:py-6">
      <button
        className="text-primary max-md:pb-5"
        onClick={onBack}
        type="button"
      >
        ← People
      </button>
      <section className="mt-7 grid grid-cols-[84px_1fr_auto] items-center rounded-md border border-border bg-surface p-[30px] max-md:mt-0 max-md:flex max-md:flex-col max-md:p-6 max-md:text-center">
        <Avatar
          alt={person.name}
          className="!size-16 !basis-16 !text-[17px]"
          initials={person.initials}
          online={person.status === 'Online'}
        />
        <div>
          <h1 className="mb-[5px] text-[26px] font-medium max-md:mt-3 max-md:text-[22px]">
            {person.name}
          </h1>
          <p className="mb-2 text-xs text-muted">
            {person.role} · Northstar Studio
          </p>
          <span
            className={`inline-flex items-center gap-[5px] text-[10px] before:size-1.5 before:rounded-full before:bg-current before:content-[''] ${person.status === 'Online' ? 'text-success' : person.status === 'Away' ? 'text-warning' : 'text-muted'}`}
          >
            {person.status}
          </span>
          <p className="mt-4 max-w-[620px] text-[13px] leading-[1.55] text-muted max-md:mt-[14px] max-md:text-center max-md:text-[11px]">
            Helping people get unstuck through clear communication and
            dependable support.
          </p>
        </div>
        <div className="flex gap-2 max-md:mt-5 max-md:w-full max-md:[&_.ui-button]:flex-1">
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
            <span className="inline-flex min-h-11 items-center rounded-sm bg-warning-surface px-[18px] text-xs font-medium text-warning max-md:flex-1 max-md:justify-center">
              Request sent
            </span>
          ) : (
            <Button onClick={() => setConnection('pending')}>Connect</Button>
          )}
        </div>
      </section>
      <div className="mt-5 grid grid-cols-[1fr_340px] gap-5 max-md:mt-3 max-md:block">
        <section className="rounded-md border border-border bg-surface p-[25px] max-md:p-[18px]">
          <h2 className="mb-5 text-base font-medium">About</h2>
          <dl className="grid grid-cols-2 gap-5">
            <div>
              <dt className="text-[9px] tracking-[.06em] text-muted">
                JOB TITLE
              </dt>
              <dd className="mt-[5px] text-xs">{person.role}</dd>
            </div>
            <div>
              <dt className="text-[9px] tracking-[.06em] text-muted">TEAM</dt>
              <dd className="mt-[5px] text-xs">{person.team}</dd>
            </div>
            <div>
              <dt className="text-[9px] tracking-[.06em] text-muted">
                LOCATION
              </dt>
              <dd className="mt-[5px] text-xs">Barcelona, Spain</dd>
            </div>
            <div>
              <dt className="text-[9px] tracking-[.06em] text-muted">
                MEMBER SINCE
              </dt>
              <dd className="mt-[5px] text-xs">August 2026</dd>
            </div>
          </dl>
        </section>
        <aside className="rounded-md border border-border bg-surface p-[25px] max-md:hidden">
          <h2 className="mb-5 text-base font-medium">Shared context</h2>
          <p className="text-[11px] text-muted">
            Information relevant to your connection.
          </p>
          <dl className="my-5 grid grid-cols-1 gap-[13px]">
            <div>
              <dt className="text-[9px] tracking-[.06em] text-muted">
                Connection
              </dt>
              <dd className="mt-[5px] text-xs">
                {connection === 'connected'
                  ? 'Connected since Aug 2026'
                  : connection === 'pending'
                    ? 'Connection request pending'
                    : 'Not connected'}
              </dd>
            </div>
            <div>
              <dt className="text-[9px] tracking-[.06em] text-muted">
                Organization
              </dt>
              <dd className="mt-[5px] text-xs">Northstar Studio</dd>
            </div>
            <div>
              <dt className="text-[9px] tracking-[.06em] text-muted">
                Online state
              </dt>
              <dd className="mt-[5px] text-xs">Visible</dd>
            </div>
            <div>
              <dt className="text-[9px] tracking-[.06em] text-muted">
                Messages
              </dt>
              <dd className="mt-[5px] text-xs">12 shared messages</dd>
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
            <p className="rounded-sm bg-surface-secondary p-3 text-center">
              Connect first to start a conversation.
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
