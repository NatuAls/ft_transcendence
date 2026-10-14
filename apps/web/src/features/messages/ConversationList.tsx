import { Avatar, Dialog, Icon, IconButton } from 'ui';
import type { ChatUser } from '../../api/messages';
import { useTranslation } from '../../core/i18n';
import {
  conversationKey,
  newConversationCandidates,
  type Conversation,
} from './messageData';

export function ConversationList({
  conversations,
  active,
  query,
  onQueryChange,
  onSelect,
  newConversationOpen,
  onNewConversation,
  onCloseNewConversation,
  candidateQuery,
  onCandidateQueryChange,
  candidates,
  onStartConversation,
  previewMode,
}: {
  conversations: Conversation[];
  active: Conversation;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (conversation: Conversation) => void;
  newConversationOpen: boolean;
  onNewConversation: () => void;
  onCloseNewConversation: () => void;
  candidateQuery: string;
  onCandidateQueryChange: (value: string) => void;
  candidates: ChatUser[];
  onStartConversation: (user: ChatUser) => void;
  previewMode: boolean;
}) {
  const { t } = useTranslation();
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
            profile: { avatarUrl: null, displayName: candidate.name },
            username: candidate.name.toLowerCase().replaceAll(' ', '.'),
          }))
      : []
    : newConversationOpen &&
        candidateQuery.trim().length >= 2 &&
        candidates.length
      ? candidates
      : [];

  return (
    <>
      <aside className="conversation-list flex min-h-0 flex-col border-r border-border max-md:border-0">
        <div className="flex h-[62px] items-center justify-between px-5 max-md:hidden">
          <h2 className="text-base font-medium">
            {t('messages.sidebar.title')}
          </h2>
          <IconButton
            icon="plus"
            label={t('messages.sidebar.newConversation')}
            onClick={onNewConversation}
            size="sm"
          />
        </div>
        <label className="mx-4 mb-2 flex h-[38px] items-center gap-2 rounded-sm border border-border px-2.5 focus-within:border-focus focus-within:outline-3 focus-within:outline-focus max-md:mx-0 max-md:mt-4 max-md:mb-[18px] max-md:h-11">
          <Icon name="search" size={15} />
          <span className="sr-only">{t('messages.sidebar.searchLabel')}</span>
          <input
            className="min-w-0 border-0 bg-transparent outline-0 focus-visible:!outline-none"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t('messages.sidebar.searchPlaceholder')}
            type="search"
            value={query}
          />
        </label>
        <div className="min-h-0 overflow-y-auto">
          {conversations.map((conversation) => (
            <button
              className={`grid h-[82px] w-full grid-cols-[34px_1fr_auto] items-center gap-2.5 border-t border-border px-4 py-3 text-left max-md:h-[104px] max-md:px-2 ${conversationKey(active) === conversationKey(conversation) ? 'bg-surface-secondary' : ''}`}
              key={conversationKey(conversation)}
              onClick={() => onSelect(conversation)}
              type="button"
            >
              <Avatar
                className="!size-[34px] !basis-[34px] !text-2xs"
                initials={conversation.initials}
                online={conversation.online}
                src={conversation.avatarUrl ?? undefined}
              />
              <span className="grid min-w-0 gap-1.5">
                <strong className="text-xs font-medium">
                  {conversation.name}
                </strong>
                <small className="truncate text-3xs text-muted">
                  {conversation.previewKey
                    ? t(conversation.previewKey)
                    : conversation.preview}
                </small>
              </span>
              <span className="grid justify-items-end gap-1">
                <time className="text-3xs text-muted">
                  {conversation.timeKey
                    ? t(conversation.timeKey)
                    : conversation.time}
                </time>
                {conversation.unreadCount ? (
                  <span
                    aria-label={t('messages.sidebar.unreadCount', {
                      count: conversation.unreadCount,
                    })}
                    className="grid min-w-4 place-items-center rounded-full bg-primary px-1 text-3xs text-surface"
                  >
                    {conversation.unreadCount}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
          {!conversations.length ? (
            <p className="px-4 py-7 text-center text-xs2 text-muted">
              {t('messages.sidebar.empty')}
            </p>
          ) : null}
        </div>
      </aside>
      {newConversationOpen ? (
        <Dialog
          description={t('messages.sidebar.dialogDescription')}
          eyebrow={t('messages.sidebar.dialogEyebrow')}
          onClose={onCloseNewConversation}
          title={t('messages.sidebar.newConversation')}
        >
          <div className="grid min-w-0 gap-1.5 p-[5px]">
            <input
              className="min-h-10 w-full min-w-0 rounded-sm border border-border px-3"
              aria-label={t('messages.sidebar.colleagueSearchLabel')}
              onChange={(event) => onCandidateQueryChange(event.target.value)}
              placeholder={t('messages.sidebar.colleagueSearchPlaceholder')}
              type="search"
              value={candidateQuery}
            />
            {!candidateQuery.trim() || candidateQuery.trim().length < 2 ? (
              <p className="text-xs text-muted">
                {t('messages.sidebar.minimumSearch')}
              </p>
            ) : null}
            {visibleCandidates.map((user) => (
              <button
                className="grid grid-cols-[44px_1fr_24px] items-center gap-3 rounded-sm p-2.5 text-left hover:bg-surface-secondary"
                key={user.id}
                onClick={() => onStartConversation(user)}
                type="button"
              >
                <Avatar
                  className="!size-[42px] !basis-[42px]"
                  initials={(user.profile?.displayName ?? user.username)
                    .slice(0, 2)
                    .toUpperCase()}
                  src={user.profile?.avatarUrl ?? undefined}
                />
                <span className="grid gap-1">
                  <strong>{user.profile?.displayName ?? user.username}</strong>
                  <small className="text-xs2 text-muted">
                    @{user.username}
                  </small>
                </span>
                <Icon name="chevron-right" size={18} />
              </button>
            ))}
            {candidateQuery.trim().length >= 2 && !visibleCandidates.length ? (
              <p className="text-xs text-muted">
                {t('messages.sidebar.noUsers')}
              </p>
            ) : null}
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
