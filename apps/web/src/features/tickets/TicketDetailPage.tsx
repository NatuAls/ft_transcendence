import {
  Alert,
  Button,
  Dialog,
  IconButton,
  SelectField,
  StatusBadge,
} from 'ui';
import { useState } from 'react';
import { getInitials } from '../../app/text';
import { initialTickets, type Ticket } from './ticketData';

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
    <div className="mx-auto max-w-[1160px] px-10 pt-8 pb-[50px] max-md:px-4 max-md:pt-0 max-md:pb-6">
      <header className="hidden h-[58px] grid-cols-[32px_1fr_32px] items-center border-b border-border max-md:grid">
        <IconButton
          icon="chevron-left"
          label="Back to tickets"
          onClick={onBack}
          size="sm"
        />
        <strong className="text-[15px]">Ticket detail</strong>
        <IconButton
          icon="more"
          label="Ticket actions"
          onClick={() => setMenuOpen(true)}
          size="sm"
        />
      </header>
      <button
        className="p-0 text-xs text-primary max-md:hidden"
        onClick={onBack}
        type="button"
      >
        ← Tickets
      </button>
      <section className="my-4 mb-7 flex items-center justify-between gap-6 max-md:mx-0.5 max-md:mt-8 max-md:mb-7 max-md:items-end">
        <div>
          <span className="text-[11px] text-muted">#{ticket.id}</span>
          <h1 className="my-3 mt-[7px] text-[28px] font-medium max-md:max-w-[310px] max-md:text-[22px]">
            {ticket.title}
          </h1>
          <div className="flex items-center gap-[14px]">
            <StatusBadge tone={current.tone}>{current.label}</StatusBadge>
            <span className="inline-flex items-center gap-[7px] text-[13px] text-ink">
              <span
                className={`size-[7px] rounded-full ${ticket.priority === 'High' ? 'bg-danger' : ticket.priority === 'Medium' ? 'bg-warning' : 'bg-success'}`}
              />
              {ticket.priority} priority
            </span>
            <small className="text-[11px] text-muted max-md:hidden">
              Updated 28 minutes ago
            </small>
          </div>
        </div>
        {ticketState === 'open' && (
          <Button
            className="max-md:!min-w-[100px] max-md:!px-3"
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
            className="max-md:!min-w-[100px] max-md:!px-3"
            onClick={() =>
              updateState('resolved', 'Ticket marked as resolved.')
            }
          >
            Mark resolved
          </Button>
        )}
        {ticketState === 'resolved' && (
          <div className="flex items-center gap-[14px] max-md:flex-col max-md:items-end max-md:gap-2 max-md:[&_.ui-button]:!min-h-[38px] max-md:[&_.ui-button]:!px-3">
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
          <span className="rounded-sm bg-[#e1ece5] px-4 py-3 text-xs font-medium text-success">
            ✓ Ticket closed
          </span>
        )}
      </section>

      {feedback ? (
        <Alert
          aria-live="polite"
          className="-mt-3 mb-5 !rounded-none !border-0 !border-l-[3px] !py-2.5 !text-[11px] !text-muted"
          role="status"
        >
          {feedback}
        </Alert>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-5 max-md:block">
        <div className="grid content-start gap-5 max-md:gap-4">
          <section className="rounded-md border border-border bg-surface p-[26px] max-md:p-4">
            <h2 className="mb-[7px] text-base font-medium">
              Issue description
            </h2>
            <small className="text-[11px] text-muted">
              {ticket.requester ?? 'John Lee'} · Requester
            </small>
            <p className="mt-[18px] max-w-[670px] text-[13px] leading-[1.65] text-muted max-md:text-[11px]">
              {ticket.description ??
                'The checkout page becomes unavailable after selecting a saved payment method. Refreshing the page does not restore the form.'}
            </p>
          </section>

          <details className="hidden rounded-md border border-border bg-surface p-4 max-md:block">
            <summary className="grid cursor-pointer grid-cols-[92px_1fr] items-center text-[10px]">
              <strong className="text-xs">Ticket details</strong>
              <span>
                {current.label} · {ticket.category} · {assignee}
              </span>
            </summary>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-[11px] [&_dd]:m-0">
              <dt>Organization</dt>
              <dd>Northstar Studio</dd>
              <dt>Created</dt>
              <dd>Today, 09:42</dd>
            </dl>
          </details>

          <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-[26px] max-md:border-0 max-md:px-0 max-md:py-2">
            <h2 className="mb-[7px] text-base font-medium">Conversation</h2>
            <article className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#d8e5df] text-[10px] text-primary">
                MS
              </span>
              <div className="max-w-[78%] max-md:max-w-[82%]">
                <small className="text-[11px] text-muted">
                  Maya Singh · Support agent
                </small>
                <p className="mt-2 rounded-[4px_12px_12px] bg-surface-secondary px-4 py-[13px] text-xs leading-[1.5] max-md:text-[10px]">
                  Thanks for the report. I can reproduce the issue and I am
                  checking the payment configuration now.
                </p>
              </div>
            </article>
            <article className="flex justify-end gap-3">
              <div className="max-w-[78%] max-md:max-w-[82%]">
                <p className="mt-2 rounded-[4px_12px_12px] bg-[#e1ece8] px-4 py-[13px] text-xs leading-[1.5] max-md:text-[10px]">
                  Thank you. It affects both Chrome and Firefox.
                </p>
              </div>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e9e2d8] text-[10px] text-[#6e573c]">
                JL
              </span>
            </article>
            {sentReplies.map((text, index) => (
              <article
                className="flex justify-end gap-3"
                key={`${text}-${index}`}
              >
                <div className="max-w-[78%] max-md:max-w-[82%]">
                  <small className="text-[11px] text-muted">
                    {currentUserName} · Now
                  </small>
                  <p className="mt-2 rounded-[4px_12px_12px] bg-[#e1ece8] px-4 py-[13px] text-xs leading-[1.5] max-md:text-[10px]">
                    {text}
                  </p>
                </div>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e9e2d8] text-[10px] text-[#6e573c]">
                  {getInitials(currentUserName)}
                </span>
              </article>
            ))}
            <form
              className="relative grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                sendReply();
              }}
            >
              <label className="relative grid gap-2 text-xs">
                <span className="max-md:hidden">Reply</span>
                <textarea
                  className="min-h-24 resize-y rounded-sm border border-border p-[13px] max-md:min-h-12 max-md:pr-12"
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
                <small className="absolute bottom-[9px] left-3 text-[10px] text-muted max-md:hidden">
                  Shift + Enter for a new line
                </small>
              </label>
              <Button
                className="self-end justify-self-end max-md:absolute max-md:right-2 max-md:bottom-[5px] max-md:!size-[38px] max-md:!min-h-[38px] max-md:!min-w-[38px] max-md:!p-0 max-md:text-0 max-md:after:text-lg max-md:after:content-['→']"
                disabled={!reply.trim()}
                type="submit"
              >
                Send reply
              </Button>
            </form>
          </section>
        </div>

        <aside className="grid content-start gap-5 max-md:hidden">
          <section className="rounded-md border border-border bg-surface p-[26px]">
            <h2 className="mb-[7px] text-base font-medium">Ticket details</h2>
            <dl className="my-[22px] mb-7 grid grid-cols-[100px_1fr] gap-x-3 gap-y-[18px] text-xs [&_dt]:text-muted [&_dd]:m-0">
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
            <h3 className="mb-3 border-t border-border pt-[18px] text-[11px] font-medium">
              Requester
            </h3>
            <div className="flex items-center gap-2.5 text-xs">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e9e2d8] text-[10px] text-[#6e573c]">
                {(ticket.requester ?? 'John Lee')
                  .split(' ')
                  .map((part) => part[0])
                  .join('')}
              </span>
              {ticket.requester ?? 'John Lee'}
            </div>
          </section>
          <section className="rounded-md border border-border bg-surface p-[26px]">
            <h2 className="mb-[7px] text-base font-medium">
              {ticketState === 'resolved' || ticketState === 'closed'
                ? 'Requester decision'
                : 'Agent actions'}
            </h2>
            <p className="mb-5 text-[11px] leading-[1.5] text-muted">
              Assignment and status changes are recorded.
            </p>
            {ticketState === 'closed' ? (
              <div className="grid gap-2 rounded-sm bg-surface-secondary p-[14px] text-xs">
                <strong>Ticket closed</strong>
                <span className="text-[11px] leading-[1.5] text-muted">
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
