import { Avatar, Button, Dialog } from 'ui';
import { useMemo, useState } from 'react';
import {
  initialConversations,
  newConversationCandidates,
  type Conversation,
} from './messageData';
import './messages.css';

export function MessagesPage({
  initialPerson,
  onOpenProfile,
  onViewTickets,
}: {
  initialPerson?: string;
  onOpenProfile: (personName: string) => void;
  onViewTickets: (personName: string) => void;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [selected, setSelected] = useState<string | null>(
    initialPerson &&
      initialConversations.some(
        (conversation) => conversation.name === initialPerson,
      )
      ? initialPerson
      : null,
  );
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState<Record<string, string[]>>({});
  const [query, setQuery] = useState('');
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const activeName = selected ?? 'Maya Singh';
  const active =
    conversations.find((conversation) => conversation.name === activeName) ??
    conversations[0];
  const visibleConversations = useMemo(
    () =>
      conversations.filter((conversation) =>
        conversation.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [conversations, query],
  );

  function sendMessage() {
    const text = message.trim();
    if (!text) return;
    setSent((current) => ({
      ...current,
      [active.name]: [...(current[active.name] ?? []), text],
    }));
    setMessage('');
  }

  function startConversation(conversation: Conversation) {
    setConversations((current) =>
      current.some((item) => item.name === conversation.name)
        ? current
        : [conversation, ...current],
    );
    setSelected(conversation.name);
    setNewConversationOpen(false);
  }

  return (
    <div
      className={`messages-page ${selected ? 'messages-page--conversation' : ''}`}
    >
      <header className="messages-heading">
        <span>CONVERSATIONS</span>
        <h1>Messages</h1>
        <p>Stay connected with colleagues through persistent conversations.</p>
      </header>
      <section className="messages-layout">
        <aside className="conversation-list">
          <div className="conversation-list__title">
            <h2>Conversations</h2>
            <button
              aria-label="New conversation"
              onClick={() => setNewConversationOpen(true)}
              type="button"
            >
              ＋
            </button>
          </div>
          <label className="conversation-list__search">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">Search conversations</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search conversations"
              type="search"
              value={query}
            />
          </label>
          <div>
            {visibleConversations.map((conversation) => (
              <button
                className={active.name === conversation.name ? 'is-active' : ''}
                key={conversation.name}
                onClick={() => setSelected(conversation.name)}
                type="button"
              >
                <Avatar
                  className="message-avatar"
                  initials={conversation.initials}
                />
                <span>
                  <strong>{conversation.name}</strong>
                  <small>{conversation.preview}</small>
                </span>
                <time>{conversation.time}</time>
              </button>
            ))}
            {!visibleConversations.length ? (
              <p className="conversation-list__empty">
                No conversations found.
              </p>
            ) : null}
          </div>
        </aside>
        <section className="message-thread">
          <header>
            <button
              aria-label="Back to conversations"
              className="message-thread__back"
              onClick={() => setSelected(null)}
              type="button"
            >
              ‹
            </button>
            <Avatar
              className="message-avatar"
              initials={active.initials}
              online
            />
            <div>
              <strong>{active.name}</strong>
              <small>Online · {active.role}</small>
            </div>
            <button onClick={() => onViewTickets(active.name)} type="button">
              View tickets (2)
            </button>
          </header>
          <div aria-live="polite" className="message-thread__body">
            <span>TODAY</span>
            <article>
              <Avatar className="message-avatar" initials={active.initials} />
              <div>
                <p>
                  I checked the request. I will share another update as soon as
                  the review is complete.
                </p>
                <time>09:48</time>
              </div>
            </article>
            <article className="is-own">
              <div>
                <p>
                  Perfect, thank you. Let me know if you need anything else.
                </p>
                <time>09:51</time>
              </div>
            </article>
            {(sent[active.name] ?? []).map((text, index) => (
              <article className="is-own" key={`${text}-${index}`}>
                <div>
                  <p>{text}</p>
                  <time>Now</time>
                </div>
              </article>
            ))}
          </div>
          <form
            className="message-composer"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <label className="sr-only" htmlFor="message-composer-input">
              Write a message
            </label>
            <textarea
              id="message-composer-input"
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Write a message…"
              rows={1}
              value={message}
            />
            <Button
              aria-label="Send message"
              disabled={!message.trim()}
              type="submit"
            >
              →
            </Button>
          </form>
        </section>
        <aside className="message-profile">
          <Avatar
            alt={active.name}
            className="message-profile__avatar"
            initials={active.initials}
            online
          />
          <h2>{active.name}</h2>
          <p>{active.role}</p>
          <span className="person-presence person-presence--online">
            Online
          </span>
          <dl>
            <dt>ORGANIZATION</dt>
            <dd>Northstar Studio</dd>
            <dt>CONNECTION</dt>
            <dd>Connected since Aug 2026</dd>
          </dl>
          <Button
            onClick={() => onOpenProfile(active.name)}
            variant="secondary"
          >
            View profile
          </Button>
        </aside>
      </section>
      {newConversationOpen ? (
        <Dialog
          description="Choose a colleague to begin a conversation."
          eyebrow="MESSAGES"
          onClose={() => setNewConversationOpen(false)}
          title="New conversation"
        >
          <div className="new-conversation-list">
            {newConversationCandidates.map((conversation) => (
              <button
                key={conversation.name}
                onClick={() => startConversation(conversation)}
                type="button"
              >
                <Avatar initials={conversation.initials} />
                <span>
                  <strong>{conversation.name}</strong>
                  <small>{conversation.role}</small>
                </span>
                <i aria-hidden="true">→</i>
              </button>
            ))}
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
