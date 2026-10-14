import { Avatar, IconButton, LoadingState } from 'ui';
import { useEffect, useRef } from 'react';
import { useTranslation } from '../../core/i18n';
import type { MessageItem } from './messageData';
import type { Conversation } from './messageData';

export function MessageThread({
  active,
  messages,
  viewerId,
  loadingOlder,
  hasMoreMessages,
  onLoadOlder,
  onBack,
  onOpenProfile,
  onViewTickets,
  onRetry,
  scrollToBottomToken,
}: {
  active: Conversation;
  messages: MessageItem[];
  viewerId: string;
  loadingOlder: boolean;
  hasMoreMessages: boolean;
  onLoadOlder: () => void;
  onBack: () => void;
  onOpenProfile: () => void;
  onViewTickets: () => void;
  onRetry: (message: MessageItem) => void;
  scrollToBottomToken: number;
}) {
  const { t } = useTranslation();
  const threadBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const body = threadBodyRef.current;
    if (!body) return;
    requestAnimationFrame(() => {
      body.scrollTop = body.scrollHeight;
    });
  }, [scrollToBottomToken]);

  return (
    <section className="min-h-0 min-w-0 grid-rows-[72px_1fr] md:grid max-md:grid max-md:h-[calc(100dvh-142px)] max-md:grid-rows-[68px_1fr]">
      <header className="flex items-center gap-2.5 border-b border-border px-[18px] max-md:px-0">
        <IconButton
          className="!hidden max-md:!grid"
          icon="chevron-left"
          label={t('messages.thread.backToConversations')}
          onClick={onBack}
          size="sm"
        />
        <button
          aria-label={t('messages.thread.viewProfile', { name: active.name })}
          className="-m-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-sm border-0 bg-transparent p-1 text-left hover:bg-surface-secondary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
          onClick={onOpenProfile}
          title={t('messages.thread.viewProfile', { name: active.name })}
          type="button"
        >
          <Avatar
            className="!size-[34px] !basis-[34px] !text-2xs"
            initials={active.initials}
            online={Boolean(active.online)}
            src={active.avatarUrl ?? undefined}
          />
          <span className="grid min-w-0 gap-[3px]">
            <strong className="truncate text-sm">{active.name}</strong>
            <small className="truncate text-2xs text-muted">
              {active.online
                ? t('messages.thread.online')
                : t('messages.thread.offline')}{' '}
              · {active.role ? t(active.role) : ''}
            </small>
          </span>
        </button>
        <button
          aria-label={t('messages.thread.viewTicketsAria', {
            name: active.name,
            count: 2,
          })}
          className="min-h-10 shrink-0 rounded-sm px-2 text-xs2 text-primary hover:bg-surface-secondary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus max-[360px]:px-1.5"
          onClick={onViewTickets}
          type="button"
        >
          <span className="max-md:hidden">
            {t('messages.thread.viewTickets', { count: 2 })}
          </span>
          <span className="hidden max-md:inline">
            {t('messages.thread.mobileTickets', { count: 2 })}
          </span>
        </button>
      </header>
      <div
        aria-live="polite"
        className="min-h-0 overflow-x-hidden overflow-y-auto overscroll-x-none p-6 [scroll-behavior:smooth] max-md:px-0.5 max-md:py-5"
        ref={threadBodyRef}
        onScroll={(event) => {
          if (event.currentTarget.scrollTop <= 24 && hasMoreMessages)
            onLoadOlder();
        }}
      >
        {loadingOlder ? (
          <LoadingState label={t('messages.thread.loadingOlder')} />
        ) : null}
        {active.id && !messages.length ? (
          <p className="text-center text-xs text-muted">
            {t('messages.thread.empty')}
          </p>
        ) : null}
        {messages.map((item) => {
          const mine = item.sender.id === viewerId;
          return (
            <article
              className={`my-5 flex min-w-0 max-w-[82%] gap-2.5 ${mine ? 'ml-auto justify-end' : ''}`}
              key={item.id}
            >
              <div className="grid gap-[5px]">
                <p
                  className={`min-w-0 max-w-full rounded-[4px_12px_12px] bg-surface-secondary p-[13px] text-xs2 leading-[1.5] whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] ${mine ? 'rounded-[12px_4px_12px_12px] bg-success-surface' : ''} ${item.status === 'error' ? 'border border-danger text-danger' : ''}`}
                >
                  {item.body}
                </p>
                {item.status === 'error' ? (
                  <button
                    className="text-left text-3xs text-danger underline"
                    onClick={() => onRetry(item)}
                    type="button"
                  >
                    {t('messages.status.failedRetry')}
                  </button>
                ) : (
                  <small className="text-3xs text-muted">
                    {item.status === 'sending'
                      ? t('messages.status.sending')
                      : t('messages.status.sent')}
                    {mine ? ` · ${item.read ? '✓✓' : '✓'}` : ''}
                  </small>
                )}
                <time
                  className={`text-3xs text-muted ${mine ? 'text-right' : ''}`}
                >
                  {new Date(item.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
