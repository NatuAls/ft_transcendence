import { Avatar, Button, Dialog, Icon, IconButton, LoadingState } from 'ui';
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
  const [candidateResultsQuery, setCandidateResultsQuery] = useState('');
  const [remoteMessages, setRemoteMessages] = useState<ApiMessage[]>([]);
  const [messagesConversationId, setMessagesConversationId] = useState<
    string | null
  >(null);
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
  }, [initialPerson]);

  useEffect(() => {
    if (!newConversationOpen || candidateQuery.trim().length < 2) {
      // setCandidates([]); // Sustituido: visibleCandidates filtra la UI sin
      // ejecutar setState síncrono dentro del efecto.
      return;
    }
    const normalizedQuery = candidateQuery.trim();
    let cancelled = false;
    void searchUsers(normalizedQuery)
      .then((users) => {
        if (!cancelled) {
          setCandidates(users);
          setCandidateResultsQuery(normalizedQuery);
        }
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
      // setRemoteMessages([]); // Sustituido: visibleRemoteMessages evita
      // mostrar mensajes de una conversación que ya no está activa.
      return;
    }
    scrollToLatestRef.current = true;
    let cancelled = false;
    const socket = socketRef.current;
    void listMessages(activeConversationId)
      .then((page) => {
        if (!cancelled) {
          setRemoteMessages(page.data);
          setMessagesConversationId(activeConversationId);
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

  const visibleCandidates =
    newConversationOpen &&
    candidateQuery.trim().length >= 2 &&
    candidateResultsQuery === candidateQuery.trim()
      ? candidates
      : [];
  const visibleRemoteMessages =
    activeConversationId && messagesConversationId === activeConversationId
      ? remoteMessages
      : [];

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
  }, [remoteMessages, messagesConversationId, activeConversationId]);
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
      className={`mx-auto w-[calc(100%_-_48px)] max-w-[1480px] pt-8 pb-12 md:max-[1100px]:p-8 max-md:w-auto max-md:px-4 max-md:pt-0 max-md:pb-5 ${selected ? 'max-md:[&_.messages-heading]:hidden max-md:[&_.conversation-list]:hidden' : ''}`}
    >
      <header className="messages-heading max-md:py-6 max-md:pb-[18px]">
        <span className="text-[11px] tracking-[.08em] text-muted max-md:hidden">
          CONVERSATIONS
        </span>
        <h1 className="my-2 text-[30px] font-medium max-md:text-[22px]">
          Messages
        </h1>
        <p className="mb-7 text-sm text-muted max-md:hidden">
          Stay connected with colleagues through persistent conversations.
        </p>
      </header>
      <section className="grid h-[min(780px,calc(100dvh-190px))] min-h-[560px] grid-cols-[330px_minmax(520px,1fr)_280px] overflow-hidden rounded-md border border-border bg-surface md:max-[1100px]:grid-cols-[260px_minmax(0,1fr)] max-md:block max-md:h-auto max-md:min-h-0 max-md:overflow-visible max-md:border-0">
        <aside className="conversation-list flex min-h-0 flex-col border-r border-border max-md:border-0">
          <div className="flex h-[62px] items-center justify-between px-5 max-md:hidden">
            <h2 className="text-base font-medium">Conversations</h2>
            <IconButton
              icon="plus"
              label="New conversation"
              onClick={() => setNewConversationOpen(true)}
              size="sm"
            />
          </div>
          <label className="mx-4 mb-2 flex h-[38px] items-center gap-2 rounded-sm border border-border px-2.5 focus-within:border-focus focus-within:outline-3 focus-within:outline-focus/20 max-md:mx-0 max-md:mb-[18px] max-md:h-11">
            <Icon name="search" size={15} />
            <span className="sr-only">Search conversations</span>
            <input
              className="min-w-0 border-0 bg-transparent outline-0"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search conversations"
              type="search"
              value={query}
            />
          </label>
          <div className="min-h-0 overflow-y-auto">
            {visibleConversations.map((conversation) => (
              <button
                className={`grid h-[82px] w-full grid-cols-[34px_1fr_auto] items-center gap-2.5 border-t border-border px-4 py-3 text-left max-md:h-[104px] max-md:px-2 ${active.name === conversation.name ? 'bg-surface-secondary' : ''}`}
                key={conversation.name}
                onClick={() => setSelected(conversation.name)}
                type="button"
              >
                <Avatar
                  className="!size-[34px] !basis-[34px] !text-[10px]"
                  initials={conversation.initials}
                />
                <span className="grid gap-1.5">
                  <strong className="text-xs font-medium">
                    {conversation.name}
                  </strong>
                  <small className="text-[9px] text-muted">
                    {conversation.preview}
                  </small>
                </span>
                <time className="text-[9px] text-muted">
                  {conversation.time}
                </time>
              </button>
            ))}
            {!visibleConversations.length ? (
              <p className="px-4 py-7 text-center text-[11px] text-muted">
                No conversations found.
              </p>
            ) : null}
          </div>
        </aside>
        <section
          className={`min-h-0 min-w-0 grid-rows-[72px_1fr_82px] ${selected ? 'max-md:grid max-md:h-[calc(100dvh-142px)] max-md:grid-rows-[68px_1fr_72px]' : 'max-md:hidden'} md:grid`}
        >
          <header className="flex items-center gap-2.5 border-b border-border px-[18px] max-md:px-0">
            <IconButton
              className="!hidden max-md:!grid"
              icon="chevron-left"
              label="Back to conversations"
              onClick={() => setSelected(null)}
              size="sm"
            />
            <Avatar
              className="!size-[34px] !basis-[34px] !text-[10px]"
              initials={active.initials}
              online
            />
            <div className="grid flex-1 gap-[3px]">
              <strong className="text-sm">{active.name}</strong>
              <small className="text-[10px] text-muted">
                Online · {active.role}
              </small>
            </div>
            <button
              className="text-[11px] text-primary max-md:hidden"
              onClick={() => onViewTickets(active.name)}
              type="button"
            >
              View tickets (2)
            </button>
          </header>
          <div
            aria-live="polite"
            className="min-h-0 overflow-x-hidden overflow-y-auto p-6 [scroll-behavior:smooth] max-md:px-0.5 max-md:py-5"
            onScroll={(event) => {
              if (event.currentTarget.scrollTop <= 24) {
                void loadOlderMessages();
              }
            }}
            ref={threadBodyRef}
          >
            {loadingOlder ? (
              <LoadingState label="Loading older messages…" />
            ) : null}
            {activeConversationId && !visibleRemoteMessages.length ? (
              <p className="text-center text-xs text-muted">No messages yet.</p>
            ) : null}
            {visibleRemoteMessages.map((item) => (
              <article
                className={`my-5 flex max-w-[82%] gap-2.5 ${item.sender.id === userId ? 'ml-auto justify-end' : ''}`}
                key={item.id}
              >
                <div className="grid gap-[5px]">
                  <p
                    className={`rounded-[4px_12px_12px] bg-surface-secondary p-[13px] text-[11px] leading-[1.5] ${item.sender.id === userId ? 'rounded-[12px_4px_12px_12px] bg-[#dce9e4]' : ''}`}
                  >
                    {item.body}
                  </p>
                  <time
                    className={`text-[9px] text-muted ${item.sender.id === userId ? 'text-right' : ''}`}
                  >
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
            className="grid grid-cols-[1fr_42px] items-center gap-2.5 border-t border-border p-[15px] max-md:px-0 max-md:py-[11px]"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <label className="sr-only" htmlFor="message-composer-input">
              Write a message
            </label>
            <textarea
              className="min-h-12 max-h-28 resize-y rounded-sm border border-border px-[14px] py-3"
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
              className="!min-w-[42px] !p-0"
              aria-label="Send message"
              disabled={!activeConversationId || !message.trim()}
              type="submit"
            >
              →
            </Button>
          </form>
        </section>
        <aside className="border-l border-border px-[22px] py-[30px] text-center md:max-[1100px]:hidden max-md:hidden">
          <Avatar
            alt={active.name}
            className="mx-auto !size-[58px] !basis-[58px]"
            initials={active.initials}
            online
          />
          <h2 className="mt-[14px] mb-[5px] text-base font-medium">
            {active.name}
          </h2>
          <p className="mb-2 text-[11px] text-muted">{active.role}</p>
          <span className="inline-flex items-center gap-[5px] text-[10px] text-success before:size-1.5 before:rounded-full before:bg-current before:content-['']">
            Online
          </span>
          <dl className="my-10 grid gap-2 text-left">
            <dt className="mt-3 text-[9px] text-muted">ORGANIZATION</dt>
            <dd className="text-[11px]">Northstar Studio</dd>
            <dt className="mt-3 text-[9px] text-muted">CONNECTION</dt>
            <dd className="text-[11px]">Connected since Aug 2026</dd>
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
          <div className="grid gap-1.5">
            <input
              className="min-h-10 rounded-sm border border-border px-3"
              aria-label="Search colleagues"
              onChange={(event) => setCandidateQuery(event.target.value)}
              placeholder="Search by username"
              type="search"
              value={candidateQuery}
            />
            {!candidateQuery.trim() || candidateQuery.trim().length < 2 ? (
              <p className="text-xs text-muted">
                Write at least 2 characters to search.
              </p>
            ) : null}
            {visibleCandidates.map((user) => (
              <button
                className="grid grid-cols-[44px_1fr_24px] items-center gap-3 rounded-sm p-2.5 text-left hover:bg-surface-secondary"
                key={user.id}
                onClick={() => void startConversation(user)}
                type="button"
              >
                <Avatar
                  className="!size-[42px] !basis-[42px]"
                  initials={(user.profile?.displayName ?? user.username)
                    .slice(0, 2)
                    .toUpperCase()}
                />
                <span className="grid gap-1">
                  <strong>{user.profile?.displayName ?? user.username}</strong>
                  <small className="text-[11px] text-muted">
                    @{user.username}
                  </small>
                </span>
                <Icon name="chevron-right" size={18} />
              </button>
            ))}
            {candidateQuery.trim().length >= 2 && !visibleCandidates.length ? (
              <p className="text-xs text-muted">No users found.</p>
            ) : null}
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
