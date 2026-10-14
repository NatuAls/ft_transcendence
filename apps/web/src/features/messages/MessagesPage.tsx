import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ViewerSession } from '../../app/session';
import { previewMode } from '../../app/session';
import { useTranslation } from '../../core/i18n';
import {
  listConversations,
  listMessages,
  markConversationRead,
  openConversation,
  searchUsers,
  sendMessage as sendChatMessage,
  type ApiConversation,
  type ApiMessage,
  type ChatUser,
} from '../../api/messages';
import { RealtimeEvents } from '../../core/realtime/socket';
import {
  useConversationRoom,
  useRealtimeEvent,
} from '../../core/realtime/useRealtime';
import {
  conversationKey,
  initialConversations,
  type Conversation,
  type MessageItem,
} from './messageData';
import { ConversationList } from './ConversationList';
import { MessageComposer } from './MessageComposer';
import { MessageThread } from './MessageThread';

const previewMessages: MessageItem[] = [
  {
    body: 'I reviewed the latest ticket update.',
    conversationId: 'preview-conversation-maya',
    createdAt: '2026-09-28T12:00:00.000Z',
    editedAt: null,
    id: 'preview-message-1',
    sender: { id: 'preview-maya', username: 'maya.singh' },
    status: 'sent',
  },
  {
    body: 'Great, I will follow up with the requester.',
    conversationId: 'preview-conversation-maya',
    createdAt: '2026-09-28T12:05:00.000Z',
    editedAt: null,
    id: 'preview-message-2',
    sender: { id: 'preview-current-user', username: 'preview.user' },
    status: 'sent',
  },
];

function withStatus(
  message: ApiMessage,
  status: MessageItem['status'] = 'sent',
): MessageItem {
  return { ...message, status };
}

function replaceOrAppend(
  messages: MessageItem[],
  next: MessageItem,
): MessageItem[] {
  const index = messages.findIndex((message) => message.id === next.id);
  if (index === -1) return [...messages, next];
  const updated = [...messages];
  updated[index] = { ...updated[index], ...next };
  return updated;
}

function toConversation(row: ApiConversation): Conversation | null {
  if (!row.participant) return null;
  const name = row.participant.profile?.displayName ?? row.participant.username;
  return {
    id: row.id,
    userId: row.participant.id,
    username: row.participant.username,
    avatarUrl: row.participant.profile?.avatarUrl ?? null,
    initials: name.slice(0, 2).toUpperCase(),
    name,
    online: row.participant.profile?.isOnline ?? false,
    preview: row.lastMessage?.body ?? '',
    previewKey: row.lastMessage ? undefined : 'messages.data.noMessages',
    role: 'messages.roles.colleague',
    time: row.lastMessageAt
      ? new Date(row.lastMessageAt).toLocaleDateString()
      : '',
    timeKey: row.lastMessageAt ? undefined : 'messages.data.newConversation',
  };
}

export function MessagesPage({
  viewer,
  initialPerson,
  onOpenProfile,
  onViewTickets,
}: {
  viewer: ViewerSession;
  initialPerson?: string;
  onOpenProfile: (personName: string) => void;
  onViewTickets: (personId: string, personName: string) => void;
}) {
  const { t } = useTranslation();
  const previewInitialConversation =
    initialConversations.find(
      (conversation) => conversation.name === initialPerson,
    ) ?? initialConversations[0];
  const [conversations, setConversations] = useState<Conversation[]>(
    previewMode ? initialConversations : [],
  );
  const [selected, setSelected] = useState<string | null>(
    previewMode && previewInitialConversation
      ? conversationKey(previewInitialConversation)
      : null,
  );
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [candidates, setCandidates] = useState<ChatUser[]>([]);
  const [candidateResultsQuery, setCandidateResultsQuery] = useState('');
  const [remoteMessages, setRemoteMessages] = useState<MessageItem[]>(
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
  const [scrollToBottomToken, setScrollToBottomToken] = useState(0);
  const active = conversations.find(
    (conversation) => conversationKey(conversation) === selected,
  ) ??
    conversations[0] ?? {
      initials: '?',
      name: t('messages.data.selectConversation'),
      preview: '',
      role: '',
      time: '',
    };
  const activeConversationId = active.id;

  const loadConversations = useCallback(() => {
    if (previewMode) return;
    void listConversations()
      .then((rows) => {
        const loaded = rows
          .map(toConversation)
          .filter((conversation): conversation is Conversation =>
            Boolean(conversation),
          );
        setConversations(loaded);
        if (initialPerson) {
          const matching = loaded.find((conversation) =>
            [conversation.name, conversation.username].includes(initialPerson),
          );
          if (matching) setSelected(conversationKey(matching));
        }
      })
      .catch((error: unknown) => console.error('Unable to load chat', error));
  }, [initialPerson, setConversations, setSelected]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (previewMode || !newConversationOpen || candidateQuery.trim().length < 2)
      return;
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

  useConversationRoom(activeConversationId);

  const loadThread = useCallback(
    (conversationId: string) => {
      if (previewMode) return;
      void listMessages(conversationId)
        .then((page) => {
          if (conversationId !== activeConversationId) return;
          // setRemoteMessages(page.data.map(withStatus));
          setRemoteMessages(page.data.map((message) => withStatus(message)));
          setMessagesConversationId(conversationId);
          setMessagePage(page.meta.page);
          setHasMoreMessages(page.meta.page < page.meta.pages);
          setScrollToBottomToken((token) => token + 1);
        })
        .catch((error: unknown) =>
          console.error('Unable to load messages', error),
        );
    },
    [activeConversationId],
  );

  useEffect(() => {
    if (!activeConversationId) return;
    if (previewMode) return;
    loadThread(activeConversationId);
    void markConversationRead(activeConversationId).catch(() => undefined);
  }, [activeConversationId, loadThread]);

  function recargarHilo() {
    if (activeConversationId) loadThread(activeConversationId);
  }

  useRealtimeEvent(RealtimeEvents.connected, () => {
    recargarHilo();
    loadConversations();
  });
  useRealtimeEvent(RealtimeEvents.messageCreated, (payload) => {
    const incoming = (payload as { message?: ApiMessage }).message;
    if (!incoming || incoming.conversationId !== activeConversationId) return;
    setRemoteMessages((current) =>
      replaceOrAppend(current, withStatus(incoming)),
    );
    setScrollToBottomToken((token) => token + 1);
  });
  useRealtimeEvent(RealtimeEvents.messageRead, (payload) => {
    const conversationId = (payload as { conversationId?: string })
      .conversationId;
    if (conversationId !== activeConversationId) return;
    setRemoteMessages((current) =>
      current.map((item) =>
        item.sender.id === viewer.id ? { ...item, read: true } : item,
      ),
    );
  });

  async function loadOlderMessages() {
    if (!activeConversationId || !hasMoreMessages || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await listMessages(activeConversationId, messagePage + 1);
      setRemoteMessages((current) => [
        // ...page.data.map(withStatus),
        ...page.data.map((message) => withStatus(message)),
        ...current.filter(
          (item) => !page.data.some((older) => older.id === item.id),
        ),
      ]);
      setMessagePage(page.meta.page);
      setHasMoreMessages(page.meta.page < page.meta.pages);
    } catch (error) {
      console.error('Unable to load older messages', error);
    } finally {
      setLoadingOlder(false);
    }
  }

  async function postMessage(
    localId: string,
    conversationId: string,
    body: string,
  ) {
    setRemoteMessages((current) =>
      current.map((item) =>
        item.id === localId ? { ...item, status: 'sending' } : item,
      ),
    );
    try {
      const created = await sendChatMessage(conversationId, body);
      setRemoteMessages((current) =>
        replaceOrAppend(
          current.filter((item) => item.id !== localId),
          withStatus(created),
        ),
      );
    } catch (error) {
      setRemoteMessages((current) =>
        current.map((item) =>
          item.id === localId ? { ...item, status: 'error' } : item,
        ),
      );
      console.error('Unable to send message', error);
    }
  }

  function sendMessage() {
    const text = message.trim();
    if (!text || !activeConversationId) return;
    if (previewMode) {
      setRemoteMessages((current) => [
        ...current,
        withStatus({
          body: text,
          conversationId: activeConversationId,
          createdAt: new Date().toISOString(),
          editedAt: null,
          id: `preview-message-${current.length + 1}`,
          sender: { id: viewer.id, username: viewer.profile.username },
        }),
      ]);
      setScrollToBottomToken((token) => token + 1);
      setMessage('');
      return;
    }
    const localId = `local-message-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: MessageItem = {
      body: text,
      conversationId: activeConversationId,
      createdAt: new Date().toISOString(),
      editedAt: null,
      id: localId,
      sender: { id: viewer.id, username: viewer.profile.username },
      status: 'sending',
    };
    setRemoteMessages((current) => [...current, optimistic]);
    setScrollToBottomToken((token) => token + 1);
    setMessage('');
    void postMessage(localId, activeConversationId, text);
  }

  function retryMessage(item: MessageItem) {
    if (item.conversationId)
      void postMessage(item.id, item.conversationId, item.body);
  }

  async function startConversation(user: ChatUser) {
    try {
      const conversation = previewMode
        ? { id: `preview-conversation-${user.id}` }
        : await openConversation(user.id);
      const name = user.profile?.displayName ?? user.username;
      const item: Conversation = {
        id: conversation.id,
        userId: user.id,
        username: user.username,
        avatarUrl: user.profile?.avatarUrl ?? null,
        initials: name.slice(0, 2).toUpperCase(),
        name,
        online: user.profile?.isOnline,
        preview: '',
        previewKey: 'messages.data.noMessages',
        role: 'messages.roles.colleague',
        time: '',
        timeKey: 'messages.data.now',
      };
      setConversations((current) => [
        item,
        ...current.filter(
          (existing) => conversationKey(existing) !== conversationKey(item),
        ),
      ]);
      setSelected(conversationKey(item));
      setRemoteMessages([]);
      setMessagesConversationId(item.id ?? null);
      setScrollToBottomToken((token) => token + 1);
      setNewConversationOpen(false);
      setCandidateQuery('');
    } catch (error) {
      console.error('Unable to open conversation', error);
    }
  }

  const visibleConversations = useMemo(
    () =>
      conversations.filter((conversation) =>
        conversation.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [conversations, query],
  );
  const visibleMessages =
    activeConversationId && messagesConversationId === activeConversationId
      ? remoteMessages
      : [];
  const visibleCandidates =
    newConversationOpen &&
    candidateQuery.trim().length >= 2 &&
    candidateResultsQuery === candidateQuery.trim()
      ? candidates
      : [];

  return (
    <div
      className={`mx-auto w-[calc(100%_-_48px)] max-w-[1480px] pt-8 pb-12 min-[1100px]:flex min-[1100px]:h-[calc(100dvh-80px)] min-[1100px]:flex-col md:max-[1100px]:flex md:max-[1100px]:h-[calc(100dvh-142px)] md:max-[1100px]:flex-col md:max-[1100px]:p-8 max-md:w-auto max-md:px-4 max-md:pt-0 max-md:pb-5 ${selected ? 'max-md:[&_.conversation-list]:hidden' : ''}`}
    >
      <header className="messages-heading shrink-0 max-[1100px]:hidden">
        <span className="text-xs2 tracking-[.08em] text-muted">
          {t('messages.eyebrow')}
        </span>
        <h1 className="my-2 text-[1.875rem] font-medium">
          {t('messages.title')}
        </h1>
        <p className="mb-7 text-sm text-muted">{t('messages.description')}</p>
      </header>
      <section className="grid min-h-0 flex-1 grid-cols-[330px_minmax(0,1fr)] overflow-hidden rounded-md border border-border bg-surface md:max-[1100px]:grid-cols-[260px_minmax(0,1fr)] max-md:block max-md:h-auto max-md:overflow-visible max-md:border-0">
        <ConversationList
          conversations={visibleConversations}
          active={active}
          query={query}
          onQueryChange={setQuery}
          onSelect={(conversation) => {
            setSelected(conversationKey(conversation));
            if (previewMode) {
              setRemoteMessages(
                conversation.id === 'preview-conversation-maya'
                  ? previewMessages
                  : [],
              );
              setMessagesConversationId(conversation.id ?? null);
            }
          }}
          newConversationOpen={newConversationOpen}
          onNewConversation={() => setNewConversationOpen(true)}
          onCloseNewConversation={() => setNewConversationOpen(false)}
          candidateQuery={candidateQuery}
          onCandidateQueryChange={setCandidateQuery}
          candidates={visibleCandidates}
          onStartConversation={(user) => void startConversation(user)}
          previewMode={previewMode}
        />
        {activeConversationId ? (
          <div
            className={`min-h-0 min-w-0 md:grid md:grid-rows-[1fr_82px] max-md:grid max-md:grid-rows-[1fr_72px] ${selected ? '' : 'max-md:hidden'}`}
          >
            <MessageThread
              active={active}
              messages={visibleMessages}
              viewerId={viewer.id}
              loadingOlder={loadingOlder}
              hasMoreMessages={hasMoreMessages}
              onLoadOlder={() => void loadOlderMessages()}
              onBack={() => setSelected(null)}
              onOpenProfile={() =>
                onOpenProfile(
                  previewMode ? active.name : (active.username ?? active.name),
                )
              }
              onViewTickets={() =>
                onViewTickets(active.userId ?? '', active.name)
              }
              onRetry={retryMessage}
              scrollToBottomToken={scrollToBottomToken}
            />
            <MessageComposer
              value={message}
              onChange={setMessage}
              onSendMessage={sendMessage}
              disabled={!activeConversationId || !message.trim()}
            />
          </div>
        ) : (
          <section className="hidden md:block" />
        )}
      </section>
    </div>
  );
}
