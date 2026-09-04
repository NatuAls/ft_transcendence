import { Button, Dialog, SelectField, StatusBadge } from 'ui';
import { useState } from 'react';
import { getInitials } from '../../app/text';
import { initialTickets, type Ticket } from './ticketData';
import './ticket-detail.css';

type TicketState = 'open' | 'progress' | 'resolved' | 'closed';

interface TicketDetailPageProps {
  currentUserName: string;
  onBack: () => void;
  onTicketChange: (ticket: Ticket) => void;
  ticket?: Ticket;
}

const stateCopy = {
  open: { label: 'Open', tone: 'open' },
  progress: { label: 'In progress', tone: 'progress' },
  resolved: { label: 'Resolved', tone: 'resolved' },
  closed: { label: 'Closed', tone: 'closed' },
} as const;

export function TicketDetailPage({
  currentUserName,
  onBack,
  onTicketChange,
  ticket = initialTickets[0],
}: TicketDetailPageProps) {
  const [ticketState, setTicketState] = useState<TicketState>(() => {
    if (ticket.statusTone === 'closed') return 'closed';
    if (ticket.statusTone === 'resolved') return 'resolved';
    if (ticket.statusTone === 'progress') return 'progress';
    return 'open';
  });
  const [reply, setReply] = useState('');
  const [sentReplies, setSentReplies] = useState<string[]>([]);
  const [assignee, setAssignee] = useState(ticket.assignee);
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const current = stateCopy[ticketState];

  function updateState(
    nextState: TicketState,
    message: string,
    nextAssignee = assignee,
  ) {
    setTicketState(nextState);
    setFeedback(message);
    onTicketChange({
      ...ticket,
      assignee: nextAssignee,
      status: stateCopy[nextState].label,
      statusTone: stateCopy[nextState].tone,
    });
  }

  function sendReply() {
    const text = reply.trim();
    if (!text) return;
    setSentReplies((currentReplies) => [...currentReplies, text]);
    setReply('');
    setFeedback('Reply added to this frontend preview.');
  }

  async function copyTicketId() {
    try {
      await navigator.clipboard.writeText(ticket.id);
      setFeedback('Ticket ID copied.');
    } catch {
      setFeedback(
        `Copy is unavailable in this browser. Ticket ID: ${ticket.id}.`,
      );
    }
    setMenuOpen(false);
  }

  return (
    <div className="ticket-detail-page">
      <header className="ticket-detail-mobile-header">
        <button onClick={onBack} type="button">
          ‹
        </button>
        <strong>Ticket detail</strong>
        <button
          aria-label="Ticket actions"
          onClick={() => setMenuOpen(true)}
          type="button"
        >
          ⋯
        </button>
      </header>
      <button className="ticket-detail-back" onClick={onBack} type="button">
        ← Tickets
      </button>
      <section className="ticket-detail-hero">
        <div>
          <span>#{ticket.id}</span>
          <h1>{ticket.title}</h1>
          <div className="ticket-detail-hero__meta">
            <StatusBadge tone={current.tone}>{current.label}</StatusBadge>
            <span
              className={`ticket-priority ticket-priority--${ticket.priority.toLowerCase()}`}
            >
              <span />
              {ticket.priority} priority
            </span>
            <small>Updated 28 minutes ago</small>
          </div>
        </div>
        {ticketState === 'open' && (
          <Button
            onClick={() => {
              setAssignee(currentUserName);
              updateState(
                'progress',
                `Ticket assigned to ${currentUserName}.`,
                currentUserName,
              );
            }}
          >
            Assign to me
          </Button>
        )}
        {ticketState === 'progress' && (
          <Button
            onClick={() =>
              updateState('resolved', 'Ticket marked as resolved.')
            }
          >
            Mark resolved
          </Button>
        )}
        {ticketState === 'resolved' && (
          <div className="ticket-detail-hero__actions">
            <Button
              onClick={() =>
                updateState('progress', 'Ticket reopened for support.')
              }
              variant="ghost"
            >
              Reopen ticket
            </Button>
            <Button
              onClick={() =>
                updateState('closed', 'Resolution confirmed and ticket closed.')
              }
            >
              Confirm & close
            </Button>
          </div>
        )}
        {ticketState === 'closed' && (
          <span className="ticket-detail-closed-state">✓ Ticket closed</span>
        )}
      </section>

      {feedback ? (
        <p aria-live="polite" className="ticket-detail-feedback" role="status">
          {feedback}
        </p>
      ) : null}

      <div className="ticket-detail-grid">
        <div className="ticket-detail-main">
          <section className="ticket-detail-card ticket-detail-description">
            <h2>Issue description</h2>
            <small>{ticket.requester ?? 'John Lee'} · Requester</small>
            <p>
              {ticket.description ??
                'The checkout page becomes unavailable after selecting a saved payment method. Refreshing the page does not restore the form.'}
            </p>
          </section>

          <details className="ticket-detail-mobile-summary">
            <summary>
              <strong>Ticket details</strong>
              <span>
                {current.label} · {ticket.category} · {assignee}
              </span>
            </summary>
            <dl>
              <dt>Organization</dt>
              <dd>Northstar Studio</dd>
              <dt>Created</dt>
              <dd>Today, 09:42</dd>
            </dl>
          </details>

          <section className="ticket-detail-card ticket-conversation">
            <h2>Conversation</h2>
            <article>
              <span className="ticket-person ticket-person--agent">MS</span>
              <div>
                <small>Maya Singh · Support agent</small>
                <p>
                  Thanks for the report. I can reproduce the issue and I am
                  checking the payment configuration now.
                </p>
              </div>
            </article>
            <article className="ticket-conversation__requester">
              <div>
                <p>Thank you. It affects both Chrome and Firefox.</p>
              </div>
              <span className="ticket-person">JL</span>
            </article>
            {sentReplies.map((text, index) => (
              <article
                className="ticket-conversation__requester"
                key={`${text}-${index}`}
              >
                <div>
                  <small>{currentUserName} · Now</small>
                  <p>{text}</p>
                </div>
                <span className="ticket-person">
                  {getInitials(currentUserName)}
                </span>
              </article>
            ))}
            <form
              className="ticket-reply-form"
              onSubmit={(event) => {
                event.preventDefault();
                sendReply();
              }}
            >
              <label>
                <span>Reply</span>
                <textarea
                  onChange={(event) => setReply(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      sendReply();
                    }
                  }}
                  placeholder="Write a reply…"
                  value={reply}
                />
                <small>Shift + Enter for a new line</small>
              </label>
              <Button disabled={!reply.trim()} type="submit">
                Send reply
              </Button>
            </form>
          </section>
        </div>

        <aside className="ticket-detail-sidebar">
          <section className="ticket-detail-card">
            <h2>Ticket details</h2>
            <dl>
              <dt>Status</dt>
              <dd>
                <StatusBadge tone={current.tone}>{current.label}</StatusBadge>
              </dd>
              <dt>Priority</dt>
              <dd>{ticket.priority}</dd>
              <dt>Category</dt>
              <dd>{ticket.category}</dd>
              <dt>Organization</dt>
              <dd>Northstar Studio</dd>
              <dt>Created</dt>
              <dd>Today, 09:42</dd>
            </dl>
            <h3>Requester</h3>
            <div className="ticket-detail-person">
              <span className="ticket-person">
                {(ticket.requester ?? 'John Lee')
                  .split(' ')
                  .map((part) => part[0])
                  .join('')}
              </span>
              {ticket.requester ?? 'John Lee'}
            </div>
          </section>
          <section className="ticket-detail-card ticket-detail-actions">
            <h2>
              {ticketState === 'resolved' || ticketState === 'closed'
                ? 'Requester decision'
                : 'Agent actions'}
            </h2>
            <p>Assignment and status changes are recorded.</p>
            {ticketState === 'closed' ? (
              <div className="ticket-closed-note">
                <strong>Ticket closed</strong>
                <span>
                  The requester confirmed the resolution. The conversation
                  remains available for reference.
                </span>
              </div>
            ) : (
              <SelectField
                label="Assignee"
                onChange={(event) => {
                  const nextAssignee = event.target.value;
                  setAssignee(nextAssignee);
                  if (nextAssignee !== 'Unassigned' && ticketState === 'open') {
                    updateState(
                      'progress',
                      'Ticket assigned and moved in progress.',
                      nextAssignee,
                    );
                  } else {
                    onTicketChange({
                      ...ticket,
                      assignee: nextAssignee,
                      status: current.label,
                      statusTone: current.tone,
                    });
                    setFeedback('Assignee updated in this frontend preview.');
                  }
                }}
                value={assignee}
              >
                <option>Unassigned</option>
                {[currentUserName, 'Maya Singh', 'Mia Chen', 'Carlos Vega'].map(
                  (name) => (
                    <option key={name}>{name}</option>
                  ),
                )}
              </SelectField>
            )}
          </section>
        </aside>
      </div>
      {menuOpen ? (
        <Dialog
          description={`Actions available for ticket ${ticket.id}.`}
          eyebrow="TICKET"
          footer={
            <Button onClick={onBack} variant="secondary">
              Return to tickets
            </Button>
          }
          onClose={() => setMenuOpen(false)}
          title="Ticket actions"
        >
          <Button fullWidth onClick={copyTicketId} variant="ghost">
            Copy ticket ID
          </Button>
        </Dialog>
      ) : null}
    </div>
  );
}
