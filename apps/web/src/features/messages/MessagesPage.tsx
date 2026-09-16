import { Avatar, Button, Dialog } from 'ui';
import { io, type Socket } from 'socket.io-client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type Conversation } from './messageData';
import {
  listConversations,
  listMessages,
  markConversationRead,
  openConversation,
  sendMessage as sendChatMessage,
  searchUsers,
  socketOrigin,
  currentUserId,
  type ChatUser,
  type ApiMessage,
} from './messagesApi';
import { getAccessToken } from '../../api/auth';
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
  // Los datos de ejemplo del mockup se conservan comentados en messageData.ts;
  // la pantalla real siempre empieza con datos vacíos hasta consultar la API.
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(
    initialPerson ?? null,
  );
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [candidates, setCandidates] = useState<ChatUser[]>([]);
  const [remoteMessages, setRemoteMessages] = useState<ApiMessage[]>([]);
  const [messagePage, setMessagePage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const socketAuthenticatedRef = useRef(false);
  const threadBodyRef = useRef<HTMLDivElement | null>(null);
  const scrollToLatestRef = useRef(false);
  const activeName = selected ?? '';
  const active = conversations.find(
    (conversation) => conversation.name === activeName,
  ) ??
    conversations[0] ?? {
      initials: '?',
      name: 'Selecciona una conversación',
      preview: '',
      role: '',
      time: '',
    };
  const activeConversationId = active.id;
  const userId = currentUserId();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    let cancelled = false;
    void listConversations()
      .then((rows) => {
        if (cancelled) return;
        const loaded = rows.flatMap((row) => {
          if (!row.participant) return [];
          const name =
            row.participant.profile?.displayName ?? row.participant.username;
          return [
            {
              id: row.id,
              userId: row.participant.id,
              username: row.participant.username,
              initials: name.slice(0, 2).toUpperCase(),
              name,
              preview: row.lastMessage?.body ?? 'No messages yet',
              role: 'Colleague',
              time: row.lastMessageAt
                ? new Date(row.lastMessageAt).toLocaleDateString()
                : 'New',
            },
          ];
        });
        setConversations(loaded);
        if (initialPerson) {
          const matching = loaded.find((conversation) =>
            [conversation.name, conversation.username].includes(initialPerson),
          );
          if (matching) setSelected(matching.name);
        }
      })
      .catch((error: unknown) => console.error('Unable to load chat', error));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!newConversationOpen || candidateQuery.trim().length < 2) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    void searchUsers(candidateQuery.trim())
      .then((users) => {
        if (!cancelled) setCandidates(users);
      })
      .catch((error: unknown) =>
        console.error('Unable to search users', error),
      );
    return () => {
      cancelled = true;
    };
  }, [candidateQuery, newConversationOpen]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const socket = io(`${socketOrigin() ?? window.location.origin}/rt`, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    const handleConnected = () => {
      socketAuthenticatedRef.current = true;
    };
    const handleDisconnected = () => {
      socketAuthenticatedRef.current = false;
    };
    socket.on('connected', handleConnected);
    socket.on('disconnect', handleDisconnected);
    socketRef.current = socket;
    return () => {
      socket.off('connected', handleConnected);
      socket.off('disconnect', handleDisconnected);
      socket.disconnect();
      socketRef.current = null;
      socketAuthenticatedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!activeConversationId) {
      setRemoteMessages([]);
      return;
    }
    scrollToLatestRef.current = true;
    let cancelled = false;
    const socket = socketRef.current;
    void listMessages(activeConversationId)
      .then((page) => {
        if (!cancelled) {
          setRemoteMessages(page.data);
          setMessagePage(page.meta.page);
          setHasMoreMessages(page.meta.page < page.meta.pages);
        }
      })
      .catch((error: unknown) =>
        console.error('Unable to load messages', error),
      );
    const subscribe = () => {
      socket?.emit(
        'conversation.subscribe',
        {
          conversationId: activeConversationId,
        },
        (result: { ok: boolean }) => {
          if (!result.ok) {
            console.warn('Chat room subscription was rejected');
          }
        },
      );
    };
    if (socketAuthenticatedRef.current) subscribe();
    socket?.on('connected', subscribe);
    const onMessage = (event: { message?: ApiMessage }) => {
      if (event.message?.conversationId !== activeConversationId) return;
      setRemoteMessages((current) =>
        current.some((message) => message.id === event.message!.id)
          ? current
          : [...current, event.message!],
      );
    };
    socket?.on('message.created', onMessage);
    void markConversationRead(activeConversationId).catch(() => undefined);
    return () => {
      cancelled = true;
      socket?.off('message.created', onMessage);
      socket?.off('connected', subscribe);
      socket?.emit('conversation.unsubscribe', {
        conversationId: activeConversationId,
      });
    };
  }, [activeConversationId]);

  useEffect(() => {
    const body = threadBodyRef.current;
    if (!body) return;
    if (scrollToLatestRef.current) {
      body.scrollTop = body.scrollHeight;
      scrollToLatestRef.current = false;
      return;
    }
    const distanceFromBottom =
      body.scrollHeight - body.scrollTop - body.clientHeight;
    if (distanceFromBottom < 160) body.scrollTop = body.scrollHeight;
  }, [remoteMessages]);
  const visibleConversations = useMemo(
    () =>
      conversations.filter((conversation) =>
        conversation.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [conversations, query],
  );

  async function loadOlderMessages() {
    const body = threadBodyRef.current;
    if (!body || !activeConversationId || !hasMoreMessages || loadingOlder)
      return;
    const oldHeight = body.scrollHeight;
    setLoadingOlder(true);
    try {
      const page = await listMessages(activeConversationId, messagePage + 1);
      setRemoteMessages((current) => [...page.data, ...current]);
      setMessagePage(page.meta.page);
      setHasMoreMessages(page.meta.page < page.meta.pages);
      requestAnimationFrame(() => {
        body.scrollTop += body.scrollHeight - oldHeight;
      });
    } catch (error) {
      console.error('Unable to load older messages', error);
    } finally {
      setLoadingOlder(false);
    }
  }

  function sendMessage() {
    const text = message.trim();
    if (!text) return;
    if (activeConversationId) {
      void sendChatMessage(activeConversationId, text)
        .then((created) =>
          setRemoteMessages((current) =>
            current.some((item) => item.id === created.id)
              ? current
              : [...current, created],
          ),
        )
        .catch((error: unknown) =>
          console.error('Unable to send message', error),
        );
      setMessage('');
      return;
    }
    setMessage('');
  }

  async function startConversation(user: ChatUser) {
    try {
      const conversation = await openConversation(user.id);
      const name = user.profile?.displayName ?? user.username;
      const item: Conversation = {
        id: conversation.id,
        userId: user.id,
        username: user.username,
        initials: name.slice(0, 2).toUpperCase(),
        name,
        preview: 'No messages yet',
        role: 'Colleague',
        time: 'Now',
      };
      setConversations((current) => [
        item,
        ...current.filter((existing) => existing.id !== item.id),
      ]);
      setSelected(item.name);
      setNewConversationOpen(false);
      setCandidateQuery('');
    } catch (error) {
      console.error('Unable to open conversation', error);
    }
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
          <div
            aria-live="polite"
            className="message-thread__body"
            onScroll={(event) => {
              if (event.currentTarget.scrollTop <= 24) {
                void loadOlderMessages();
              }
            }}
            ref={threadBodyRef}
          >
            {loadingOlder ? (
              <p className="message-thread__loading">Loading older messages…</p>
            ) : null}
            {activeConversationId && !remoteMessages.length ? (
              <p className="message-thread__empty">No messages yet.</p>
            ) : null}
            {remoteMessages.map((item) => (
              <article
                className={item.sender.id === userId ? 'is-own' : ''}
                key={item.id}
              >
                <div>
                  <p>{item.body}</p>
                  <time>
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
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
              disabled={!activeConversationId || !message.trim()}
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
            <input
              aria-label="Search colleagues"
              onChange={(event) => setCandidateQuery(event.target.value)}
              placeholder="Search by username"
              type="search"
              value={candidateQuery}
            />
            {!candidateQuery.trim() || candidateQuery.trim().length < 2 ? (
              <p className="new-conversation-list__hint">
                Write at least 2 characters to search.
              </p>
            ) : null}
            {candidates.map((user) => (
              <button
                key={user.id}
                onClick={() => void startConversation(user)}
                type="button"
              >
                <Avatar
                  initials={(user.profile?.displayName ?? user.username)
                    .slice(0, 2)
                    .toUpperCase()}
                />
                <span>
                  <strong>{user.profile?.displayName ?? user.username}</strong>
                  <small>@{user.username}</small>
                </span>
                <i aria-hidden="true">→</i>
              </button>
            ))}
            {candidateQuery.trim().length >= 2 && !candidates.length ? (
              <p className="new-conversation-list__hint">No users found.</p>
            ) : null}
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
