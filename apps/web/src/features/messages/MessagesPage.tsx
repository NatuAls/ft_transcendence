import { Avatar, Button, Dialog, Icon, IconButton, LoadingState } from 'ui';
import { io, type Socket } from 'socket.io-client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  initialConversations,
  newConversationCandidates,
  type Conversation,
} from './messageData';
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
import { previewMode } from '../../app/session';

const previewMessages: ApiMessage[] = [
  {
    body: 'I reviewed the latest ticket update.',
    conversationId: 'preview-conversation-maya',
    createdAt: '2026-09-28T12:00:00.000Z',
    editedAt: null,
    id: 'preview-message-1',
    sender: { id: 'preview-maya', username: 'maya.singh' },
  },
  {
    body: 'Great, I will follow up with the requester.',
    conversationId: 'preview-conversation-maya',
    createdAt: '2026-09-28T12:05:00.000Z',
    editedAt: null,
    id: 'preview-message-2',
    sender: { id: 'preview-current-user', username: 'preview.user' },
  },
];

export function MessagesPage({
  initialPerson,
  onOpenProfile,
  onViewTickets,
}: {
  initialPerson?: string;
  onOpenProfile: (personName: string) => void;
  onViewTickets: (personName: string) => void;
}) {
  const previewInitialConversation =
    initialConversations.find(
      (conversation) => conversation.name === initialPerson,
    ) ?? initialConversations[0];
  const [conversations, setConversations] = useState<Conversation[]>(
    previewMode ? initialConversations : [],
  );
  const [selected, setSelected] = useState<string | null>(
    initialPerson ??
      (previewMode ? (previewInitialConversation?.name ?? null) : null),
  );
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [candidates, setCandidates] = useState<ChatUser[]>([]);
  const [candidateResultsQuery, setCandidateResultsQuery] = useState('');
  const [remoteMessages, setRemoteMessages] = useState<ApiMessage[]>(
    previewMode &&
      previewInitialConversation?.id === 'preview-conversation-maya'
      ? previewMessages
      : [],
  );
  const [messagesConversationId, setMessagesConversationId] = useState<
    string | null
  >(previewMode ? (previewInitialConversation?.id ?? null) : null);
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
  const userId = previewMode ? 'preview-current-user' : currentUserId();

  useEffect(() => {
    if (previewMode) return;
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
              online: row.participant.profile?.isOnline ?? false,
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
    if (previewMode) return;
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
    if (previewMode) return;
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
    if (previewMode) return;
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

  const visibleCandidates = previewMode
    ? newConversationOpen && candidateQuery.trim().length >= 2
      ? newConversationCandidates
          .filter((candidate) =>
            candidate.name
              .toLowerCase()
              .includes(candidateQuery.trim().toLowerCase()),
          )
          .map((candidate) => ({
            id: `preview-${candidate.name.toLowerCase().replaceAll(' ', '-')}`,
            profile: { displayName: candidate.name },
            username: candidate.name.toLowerCase().replaceAll(' ', '.'),
          }))
      : []
    : newConversationOpen &&
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
      if (previewMode) {
        setRemoteMessages((current) => [
          ...current,
          {
            body: text,
            conversationId: activeConversationId,
            createdAt: new Date().toISOString(),
            editedAt: null,
            id: `preview-message-${current.length + 1}`,
            sender: {
              id: 'preview-current-user',
              username: 'preview.user',
            },
          },
        ]);
        setMessage('');
        return;
      }
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
    if (previewMode) {
      const name = user.profile?.displayName ?? user.username;
      const item: Conversation = {
        id: `preview-conversation-${user.id}`,
        initials: name.slice(0, 2).toUpperCase(),
        name,
        online: user.profile?.isOnline,
        preview: 'No messages yet',
        role: 'Colleague',
        time: 'Now',
        userId: user.id,
        username: user.username,
      };
      setConversations((current) => [
        item,
        ...current.filter((existing) => existing.name !== item.name),
      ]);
      setSelected(item.name);
      setRemoteMessages([]);
      setMessagesConversationId(item.id ?? null);
      setNewConversationOpen(false);
      setCandidateQuery('');
      return;
    }
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
      className={`mx-auto w-[calc(100%_-_48px)] max-w-[1480px] pt-8 pb-12 min-[1101px]:flex min-[1101px]:h-[calc(100dvh-80px)] min-[1101px]:flex-col md:max-[1100px]:flex md:max-[1100px]:h-[calc(100dvh-142px)] md:max-[1100px]:flex-col md:max-[1100px]:p-8 max-md:w-auto max-md:px-4 max-md:pt-0 max-md:pb-5 ${selected ? 'max-md:[&_.conversation-list]:hidden' : ''}`}
    >
      <header className="messages-heading shrink-0 max-[1100px]:hidden">
        <span className="text-[11px] tracking-[.08em] text-muted">
          CONVERSATIONS
        </span>
        <h1 className="my-2 text-[30px] font-medium">Messages</h1>
        <p className="mb-7 text-sm text-muted">
          Stay connected with colleagues through persistent conversations.
        </p>
      </header>
      <section className="grid min-h-0 flex-1 grid-cols-[330px_minmax(0,1fr)] overflow-hidden rounded-md border border-border bg-surface md:max-[1100px]:grid-cols-[260px_minmax(0,1fr)] max-md:block max-md:h-auto max-md:overflow-visible max-md:border-0">
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
          <label className="mx-4 mb-2 flex h-[38px] items-center gap-2 rounded-sm border border-border px-2.5 focus-within:border-focus focus-within:outline-3 focus-within:outline-focus max-md:mx-0 max-md:mt-4 max-md:mb-[18px] max-md:h-11">
            <Icon name="search" size={15} />
            <span className="sr-only">Search conversations</span>
            <input
              className="min-w-0 border-0 bg-transparent outline-0 focus-visible:!outline-none"
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
                onClick={() => {
                  setSelected(conversation.name);
                  if (previewMode) {
                    setRemoteMessages(
                      conversation.id === 'preview-conversation-maya'
                        ? previewMessages
                        : [],
                    );
                    setMessagesConversationId(conversation.id ?? null);
                  }
                }}
                type="button"
              >
                <Avatar
                  className="!size-[34px] !basis-[34px] !text-[10px]"
                  initials={conversation.initials}
                  online={conversation.online}
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
            <button
              aria-label={`View ${active.name} profile`}
              className="-m-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-sm border-0 bg-transparent p-1 text-left hover:bg-surface-secondary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
              onClick={() => onOpenProfile(active.name)}
              title={`View ${active.name} profile`}
              type="button"
            >
              <Avatar
                className="!size-[34px] !basis-[34px] !text-[10px]"
                initials={active.initials}
                online={Boolean(active.online)}
              />
              <span className="grid min-w-0 gap-[3px]">
                <strong className="truncate text-sm">{active.name}</strong>
                <small className="truncate text-[10px] text-muted">
                  {active.online ? 'Online' : 'Offline'} · {active.role}
                </small>
              </span>
            </button>
            <button
              aria-label={`View tickets related to ${active.name} (2)`}
              className="min-h-10 shrink-0 rounded-sm px-2 text-[11px] text-primary hover:bg-surface-secondary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus max-[360px]:px-1.5"
              onClick={() => onViewTickets(active.name)}
              type="button"
            >
              <span className="max-md:hidden">View tickets (2)</span>
              <span className="hidden max-md:inline">Tickets (2)</span>
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
      </section>
      {newConversationOpen ? (
        <Dialog
          description="Choose a colleague to begin a conversation."
          eyebrow="MESSAGES"
          onClose={() => setNewConversationOpen(false)}
          title="New conversation"
        >
          <div className="grid min-w-0 gap-1.5 p-[5px]">
            <input
              className="min-h-10 w-full min-w-0 rounded-sm border border-border px-3"
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
