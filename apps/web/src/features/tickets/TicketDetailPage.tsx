import { Button, Dialog, Icon, IconButton, SelectField, StatusBadge } from 'ui';
import { useEffect, useState } from 'react';
import { getInitials } from '../../app/text';
import { useAsync } from '../../core/async/useAsync';
import { AsyncState } from '../../core/async/AsyncState';
import { isApiError } from '../../core/api/errors';
import {
  assignTicket,
  createTicketComment,
  getTicket,
  listTicketComments,
  updateTicket,
  changeStatus,
  type TicketDetail,
  type TicketComment,
} from '../../api/tickets';
import { listMembers } from '../../api/roles';
import { listCategories } from '../../api/organizations';
import {
  useRealtimeEvent,
  useTicketRoom,
} from '../../core/realtime/useRealtime';
import { RealtimeEvents } from '../../core/realtime/socket';
import { formatRelativeTime } from './ticketTime';
import { useTranslation } from '../../core/i18n';
import { useToast } from '../../core/feedback/useToast';

interface TicketDetailPageProps {
  canReassign: boolean;
  canChangeStatus: boolean;
  canReopenTickets: boolean;
  canSelfAssign: boolean;
  currentUserId: string;
  organizationName: string;
  organizationId: string;
  onBack: () => void;
  ticketId: string;
}

const stateMap: Record<
  string,
  { tone: 'open' | 'progress' | 'resolved' | 'closed' }
> = {
  OPEN: { tone: 'open' },
  IN_PROGRESS: { tone: 'progress' },
  RESOLVED: { tone: 'resolved' },
  CLOSED: { tone: 'closed' },
};

export function TicketDetailPage({
  canReassign,
  canChangeStatus,
  canReopenTickets,
  canSelfAssign,
  currentUserId,
  organizationName,
  organizationId,
  onBack,
  ticketId,
}: TicketDetailPageProps) {
  const { i18n, t } = useTranslation();
  const toast = useToast();

  const apiResponse = useAsync(
    async (signal) => {
      return getTicket(ticketId, signal);
    },
    [ticketId],
  );
  const ticket = apiResponse.data;
  const canAccessConversation =
    canReassign ||
    ticket?.assigneeId === currentUserId ||
    ticket?.authorId === currentUserId;
  const showStaffMetadata = canReassign || canChangeStatus;

  const commentsResponse = useAsync(
    async (signal) => {
      if (!canAccessConversation) return [];
      return listTicketComments(ticketId, signal);
    },
    [ticketId, canAccessConversation],
  );

  const membersResponse = useAsync(
    async (signal) => {
      if (!organizationId || !canReassign) return [];
      return listMembers(organizationId, signal);
    },
    [organizationId, canReassign],
  );

  const categoriesResponse = useAsync(
    async (signal) => {
      if (!organizationId || !canChangeStatus) return [];
      return listCategories(organizationId, signal);
    },
    [organizationId, canChangeStatus],
  );

  const [reply, setReply] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [resolution, setResolution] = useState('');
  const [resolutionDialogOpen, setResolutionDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [isReplying, setIsReplying] = useState(false);

  const currentStatus = ticket?.status ?? 'OPEN';
  const assignee = ticket?.assigneeDisplayName || 'Unassigned';
  const currentUiState = stateMap[currentStatus] || stateMap.OPEN;
  const isRequester = ticket?.authorId === currentUserId;

  useTicketRoom(ticketId);

  useRealtimeEvent(RealtimeEvents.commentCreated, (payload) => {
    const event = payload as { ticket?: { id?: string } } | undefined;
    if (event?.ticket?.id === ticketId) commentsResponse.reload();
  });
  useRealtimeEvent(RealtimeEvents.commentUpdated, (payload) => {
    const event = payload as { ticketId?: string } | undefined;
    if (event?.ticketId === ticketId) commentsResponse.reload();
  });
  useRealtimeEvent(RealtimeEvents.commentDeleted, (payload) => {
    const event = payload as { ticketId?: string } | undefined;
    if (event?.ticketId === ticketId) commentsResponse.reload();
  });

  useRealtimeEvent(RealtimeEvents.ticketUpdated, (payload) => {
    const event = payload as { ticket?: { id?: string } } | undefined;
    if (event?.ticket?.id === ticketId) {
      apiResponse.reload();
    }
  });

  useRealtimeEvent(RealtimeEvents.connected, () => {
    apiResponse.reload();
    commentsResponse.reload();
  });

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  async function sendReply() {
    const text = reply.trim();
    if (!text || isReplying) return;
    setIsReplying(true);
    try {
      if (!canAccessConversation) return;
      await createTicketComment(ticketId, text);
      setReply('');
      toast.success(t('tickets.detail.feedback.replyAdded'));
      commentsResponse.reload();
    } catch (error) {
      toast.error(error);
    } finally {
      setIsReplying(false);
    }
  }

  async function changePriority(priority: TicketDetail['priority']) {
    if (!ticket || priority === ticket.priority) return;
    try {
      const updated = await updateTicket(ticket.id, { priority });
      apiResponse.setData(() => updated);
      toast.success(t('tickets.detail.feedback.priorityUpdated'));
    } catch (error) {
      toast.error(error);
    }
  }

  async function changeAssignee(nextAssigneeId: string | null) {
    if (!ticket || nextAssigneeId === ticket.assigneeId) return;
    try {
      const updated = await assignTicket(ticket.id, nextAssigneeId);
      apiResponse.setData(() => updated);
      toast.success(t('tickets.detail.feedback.assigneeUpdated'));
    } catch (error) {
      toast.error(error);
    }
  }

  async function changeCategory(nextCategoryId: string | null) {
    if (!ticket || nextCategoryId === ticket.categoryId) return;
    try {
      const updated = await updateTicket(ticket.id, {
        categoryId: nextCategoryId,
      });
      apiResponse.setData(() => updated);
      toast.success(t('tickets.detail.feedback.categoryUpdated'));
    } catch (error) {
      toast.error(error);
    }
  }

  async function updateStatus(
    nextState: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
    nextResolution: string | null = null,
    note: string | null = null,
  ) {
    if (!ticket || nextState === currentStatus || statusBusy) return;
    if (nextState === 'RESOLVED' && !nextResolution) {
      setResolutionDialogOpen(true);
      return;
    }
    setStatusBusy(true);
    try {
      const updated = await changeStatus(ticket.id, {
        status: nextState,
        resolution: nextResolution,
        note,
      });
      apiResponse.setData(() => updated);
      setResolution('');
      setResolutionDialogOpen(false);
      toast.success(
        nextState === 'CLOSED'
          ? t('tickets.detail.feedback.closed')
          : nextState === 'RESOLVED'
            ? t('tickets.detail.feedback.resolved')
            : t('tickets.detail.feedback.reopened'),
      );
    } catch (error) {
      toast.error(error);
    } finally {
      setStatusBusy(false);
    }
  }

  async function assignToMe() {
    if (!ticket || currentStatus !== 'OPEN' || statusBusy) return;
    setStatusBusy(true);
    try {
      const statusUpdated = await changeStatus(ticket.id, {
        status: 'IN_PROGRESS',
      });
      const updated =
        statusUpdated.assigneeId === currentUserId
          ? statusUpdated
          : await assignTicket(ticket.id, currentUserId);
      apiResponse.setData(() => updated);
      toast.success(t('tickets.detail.feedback.assignedToMe'));
    } catch (error) {
      toast.error(error);
    } finally {
      setStatusBusy(false);
    }
  }

  async function copyTicketId() {
    try {
      await navigator.clipboard.writeText(ticketId);
      toast.success(t('tickets.detail.feedback.idCopied'));
    } catch {
      toast.show({
        tone: 'warning',
        title: t('tickets.detail.feedback.copyUnavailable', { id: ticketId }),
      });
    }
    setMenuOpen(false);
  }

  return (
    <div className="mx-auto max-w-[1160px] px-10 pt-8 pb-[50px] max-md:px-4 max-md:pt-0 max-md:pb-6">
      <header className="sticky top-0 z-20 -mx-4 hidden h-[58px] grid-cols-[32px_1fr_32px] items-center border-b border-border bg-surface/96 px-4 backdrop-blur max-md:grid">
        <IconButton
          icon="chevron-left"
          label={t('tickets.detail.back')}
          onClick={onBack}
          size="sm"
        />
        <strong className="text-[0.9375rem]">
          {t('tickets.detail.title')}
        </strong>
        <IconButton
          icon="more"
          label={t('tickets.detail.actions')}
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

      <AsyncState
        errorTitle={t('tickets.detail.loadError')}
        error={
          isApiError(apiResponse.error) && apiResponse.error.status === 404
            ? undefined
            : apiResponse.error
        }
        isEmpty={
          isApiError(apiResponse.error) && apiResponse.error.status === 404
        }
        emptyTitle={t('tickets.detail.notFound')}
        emptyDescription={t('tickets.detail.notFoundDescription')}
        onRetry={apiResponse.reload}
        status={apiResponse.status}
      >
        {ticket ? (
          <>
            <section className="my-4 mb-7 flex items-center justify-between gap-6 max-md:mx-0.5 max-md:mt-8 max-md:mb-7 max-md:items-end">
              <div>
                <span className="text-xs2 text-muted">
                  #{ticketId.split('-')[0]}
                </span>
                <h1 className="my-3 mt-[7px] text-[1.75rem] font-medium max-md:max-w-[310px] max-md:text-[1.375rem]">
                  {ticket.title}
                </h1>
                <div className="flex items-center gap-[14px]">
                  <small className="text-xs2 text-muted max-md:hidden">
                    {t('tickets.detail.updated', {
                      date: new Date(
                        ticket.updatedAt ?? ticket.createdAt,
                      ).toLocaleDateString(),
                    })}
                  </small>
                </div>
              </div>
              {currentStatus === 'OPEN' && canSelfAssign && (
                <Button
                  className="max-md:!min-w-[100px] max-md:!px-3"
                  disabled={statusBusy}
                  onClick={() => void assignToMe()}
                >
                  {t('tickets.detail.assignToMe')}
                </Button>
              )}
              {currentStatus === 'IN_PROGRESS' && canChangeStatus && (
                <Button
                  className="max-md:!min-w-[100px] max-md:!px-3"
                  disabled={statusBusy}
                  onClick={() => void updateStatus('RESOLVED')}
                >
                  {t('tickets.detail.markResolved')}
                </Button>
              )}
              {currentStatus === 'RESOLVED' &&
                (canChangeStatus || isRequester) && (
                  <div className="flex items-center gap-[14px] max-md:flex-col max-md:items-end max-md:gap-2 max-md:[&_.ui-button]:!min-h-[38px] max-md:[&_.ui-button]:!px-3">
                    {canReopenTickets ? (
                      <Button
                        onClick={() => void updateStatus('IN_PROGRESS')}
                        disabled={statusBusy}
                        variant="ghost"
                      >
                        {t('tickets.detail.reopen')}
                      </Button>
                    ) : null}
                    {isRequester ? (
                      <Button
                        disabled={statusBusy}
                        onClick={() => setCloseDialogOpen(true)}
                      >
                        {t('tickets.detail.confirmClose')}
                      </Button>
                    ) : null}
                  </div>
                )}
              {currentStatus === 'CLOSED' && (
                <div className="flex items-center gap-2 max-md:flex-col max-md:items-end">
                  <span className="rounded-sm bg-success-surface px-4 py-3 text-xs font-medium text-success">
                    ✓ {t('tickets.detail.ticketClosed')}
                  </span>
                  {canReopenTickets ? (
                    <Button
                      onClick={() => void updateStatus('IN_PROGRESS')}
                      disabled={statusBusy}
                      variant="secondary"
                    >
                      {t('tickets.detail.reopen')}
                    </Button>
                  ) : null}
                </div>
              )}
            </section>

            <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-5 max-md:block">
              <div className="grid content-start gap-5 max-md:gap-4">
                <section className="rounded-md border border-border bg-surface p-[26px] max-md:p-4">
                  <h2 className="mb-[7px] text-base font-medium">
                    {t('tickets.detail.issueDescription')}
                  </h2>
                  <small className="text-xs2 text-muted">
                    {showStaffMetadata ? `${ticket.authorDisplayName} · ` : ''}
                    {t('tickets.detail.requester')}
                  </small>
                  <p className="mt-[18px] max-w-[670px] text-[0.8125rem] leading-[1.65] text-muted max-md:text-xs2">
                    {ticket.description}
                  </p>
                </section>

                <details className="hidden rounded-md border border-border bg-surface p-4 max-md:block">
                  <summary className="grid cursor-pointer grid-cols-[92px_1fr] items-center text-2xs">
                    <strong className="text-xs">
                      {t('tickets.detail.details')}
                    </strong>
                    <span>
                      {t(`tickets.status.${currentStatus}`)} ·{' '}
                      {ticket.categoryName || t('tickets.list.noCategory')} ·{' '}
                      {assignee}
                    </span>
                  </summary>
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-xs2 [&_dd]:m-0">
                    <dt>{t('tickets.detail.organization')}</dt>
                    <dd>{organizationName}</dd>
                    <dt>{t('tickets.detail.created')}</dt>
                    <dd>{new Date(ticket.createdAt).toLocaleDateString()}</dd>
                  </dl>
                </details>

                <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-[26px] max-md:border-0 max-md:px-0 max-md:py-2">
                  <h2 className="mb-[7px] text-base font-medium">
                    {t('tickets.detail.conversation')}
                  </h2>
                  {!canAccessConversation ? (
                    <p className="rounded-sm bg-surface-secondary px-4 py-3 text-xs text-muted">
                      {t('tickets.detail.conversationRestricted')}
                    </p>
                  ) : null}
                  {canAccessConversation &&
                    (commentsResponse.data ?? []).map(
                      (comment: TicketComment) => (
                        <article
                          className={`flex gap-3 ${comment.author.id === currentUserId ? 'justify-end' : ''}`}
                          key={comment.id}
                        >
                          {comment.author.id !== currentUserId ? (
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#d8e5df] text-2xs text-primary">
                              {getInitials(comment.author.displayName)}
                            </span>
                          ) : null}
                          <div className="max-w-[78%] max-md:max-w-[82%]">
                            <small className="text-xs2 text-muted">
                              {comment.author.displayName} ·{' '}
                              {formatRelativeTime(
                                comment.createdAt,
                                i18n.language,
                                now,
                              )}
                            </small>
                            <p className="mt-2 rounded-[4px_12px_12px] bg-[#e1ece8] px-4 py-[13px] text-xs leading-[1.5] max-md:text-2xs">
                              {comment.body}
                            </p>
                          </div>
                          {comment.author.id === currentUserId ? (
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e9e2d8] text-2xs text-[#6e573c]">
                              {getInitials(comment.author.displayName)}
                            </span>
                          ) : null}
                        </article>
                      ),
                    )}
                  {canAccessConversation &&
                  commentsResponse.status === 'loading' &&
                  !commentsResponse.data ? (
                    <p className="text-xs text-muted">
                      {t('tickets.detail.loadingConversation')}
                    </p>
                  ) : null}
                  {canAccessConversation &&
                  commentsResponse.status === 'error' ? (
                    <p className="text-xs text-danger">
                      {t('tickets.detail.conversationFailed')}
                    </p>
                  ) : null}
                  {canAccessConversation && currentStatus === 'CLOSED' ? (
                    <p className="rounded-sm bg-surface-secondary px-4 py-3 text-xs text-muted">
                      {t('tickets.detail.closedReadOnly')}
                    </p>
                  ) : canAccessConversation ? (
                    <form
                      className="relative grid min-w-0 gap-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        sendReply();
                      }}
                    >
                      <label className="relative grid min-w-0 gap-2 text-xs">
                        <span className="max-md:hidden">
                          {t('tickets.detail.reply')}
                        </span>
                        <textarea
                          className="min-h-24 min-w-0 resize-y rounded-sm border border-border p-[13px] max-md:min-h-12 max-md:pr-14"
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
                          placeholder={t('tickets.detail.replyPlaceholder')}
                          value={reply}
                        />
                        <small className="absolute bottom-[9px] left-3 text-2xs text-muted max-md:hidden">
                          {t('tickets.detail.newLineHint')}
                        </small>
                      </label>
                      <Button
                        aria-label={t('tickets.detail.sendReply')}
                        className="self-end justify-self-end max-md:absolute max-md:top-1/2 max-md:right-1.5 max-md:bottom-auto max-md:-translate-y-1/2 max-md:!size-10 max-md:!min-h-10 max-md:!min-w-10 max-md:!p-0"
                        disabled={!reply.trim() || isReplying}
                        type="submit"
                      >
                        <span className="max-md:sr-only">
                          {t('tickets.detail.send')}
                        </span>
                        <span className="hidden max-md:block">
                          <Icon name="send" size={17} />
                        </span>
                      </Button>
                    </form>
                  ) : null}
                </section>
              </div>

              <aside className="grid content-start gap-5 max-md:hidden">
                <section className="rounded-md border border-border bg-surface p-[26px]">
                  <h2 className="mb-[7px] text-base font-medium">
                    {t('tickets.detail.details')}
                  </h2>
                  <dl className="my-[22px] mb-7 grid grid-cols-[100px_1fr] gap-x-3 gap-y-[18px] text-xs [&_dt]:text-muted [&_dd]:m-0">
                    <dt>{t('tickets.detail.status')}</dt>
                    <dd>
                      <StatusBadge tone={currentUiState.tone}>
                        {t(`tickets.status.${currentStatus}`)}
                      </StatusBadge>
                    </dd>
                    <dt>{t('tickets.detail.priority')}</dt>
                    <dd className="inline-flex items-center gap-2">
                      <span
                        className={`size-[7px] rounded-full ${
                          ticket.priority === 'HIGH'
                            ? 'bg-danger'
                            : ticket.priority === 'MEDIUM'
                              ? 'bg-warning'
                              : 'bg-success'
                        }`}
                      />
                      {t(`tickets.priority.${ticket.priority}`)}
                    </dd>
                    <dt>{t('tickets.detail.category')}</dt>
                    <dd>
                      {ticket.categoryName || t('tickets.list.noCategory')}
                    </dd>
                    <dt>{t('tickets.detail.organization')}</dt>
                    <dd>{organizationName}</dd>
                    <dt>{t('tickets.detail.created')}</dt>
                    <dd>{new Date(ticket.createdAt).toLocaleDateString()}</dd>
                  </dl>
                  {showStaffMetadata ? (
                    <>
                      <h3 className="mb-3 border-t border-border pt-[18px] text-xs2 font-medium">
                        {t('tickets.detail.requester')}
                      </h3>
                      <div className="flex items-center gap-2.5 text-xs">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-warning-surface text-2xs text-warning">
                          {ticket.authorDisplayName
                            .split(' ')
                            .map((part) => part[0])
                            .join('')}
                        </span>
                        {ticket.authorDisplayName}
                      </div>
                    </>
                  ) : null}
                </section>
                <section className="rounded-md border border-border bg-surface p-[26px]">
                  <h2 className="mb-[7px] text-base font-medium">
                    {t('tickets.detail.assignment')}
                  </h2>
                  <p className="mb-5 text-xs2 leading-[1.5] text-muted">
                    {t('tickets.detail.assignmentDescription')}
                  </p>
                  {currentStatus === 'CLOSED' ? (
                    <div className="grid gap-2 rounded-sm bg-surface-secondary p-[14px] text-xs">
                      <strong>{t('tickets.detail.ticketClosed')}</strong>
                      <span className="text-xs2 leading-[1.5] text-muted">
                        {t('tickets.detail.closedDescription')}
                      </span>
                    </div>
                  ) : canReassign ? (
                    <div className="grid gap-4">
                      <SelectField
                        label={t('tickets.detail.assignee')}
                        disabled={statusBusy}
                        onChange={(event) =>
                          void changeAssignee(event.target.value || null)
                        }
                        value={ticket.assigneeId ?? ''}
                      >
                        <option value="">{t('tickets.list.unassigned')}</option>
                        {(membersResponse.data ?? [])
                          .filter(
                            (member) =>
                              member.role === 'AGENT' ||
                              member.role === 'ORG_ADMIN',
                          )
                          .map((member) => (
                            <option key={member.userId} value={member.userId}>
                              {member.displayName}
                            </option>
                          ))}
                      </SelectField>
                    </div>
                  ) : (
                    <div className="grid gap-2 rounded-sm bg-surface-secondary p-[14px] text-xs">
                      <strong>{assignee}</strong>
                      <span className="text-xs2 leading-[1.5] text-muted">
                        {t('tickets.detail.adminReassignOnly')}
                      </span>
                    </div>
                  )}
                </section>
                {canChangeStatus ? (
                  <section className="rounded-md border border-border bg-surface p-[26px]">
                    <h2 className="mb-[7px] text-base font-medium">
                      {t('tickets.detail.agentOptions')}
                    </h2>
                    <p className="mb-5 text-xs2 leading-[1.5] text-muted">
                      {t('tickets.detail.agentOptionsDescription')}
                    </p>
                    <div className="grid gap-4">
                      <SelectField
                        label={t('tickets.detail.priority')}
                        disabled={statusBusy}
                        onChange={(event) =>
                          void changePriority(
                            event.target.value as TicketDetail['priority'],
                          )
                        }
                        value={ticket.priority}
                      >
                        <option value="LOW">{t('tickets.priority.LOW')}</option>
                        <option value="MEDIUM">
                          {t('tickets.priority.MEDIUM')}
                        </option>
                        <option value="HIGH">
                          {t('tickets.priority.HIGH')}
                        </option>
                      </SelectField>
                      <SelectField
                        label={t('tickets.detail.category')}
                        disabled={statusBusy}
                        onChange={(event) =>
                          void changeCategory(event.target.value || null)
                        }
                        value={ticket.categoryId ?? ''}
                      >
                        <option value="">{t('tickets.list.noCategory')}</option>
                        {(categoriesResponse.data ?? [])
                          .filter((category) => category.isActive)
                          .map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                      </SelectField>
                    </div>
                  </section>
                ) : null}
              </aside>
            </div>
          </>
        ) : null}
      </AsyncState>

      {resolutionDialogOpen ? (
        <Dialog
          description={t('tickets.detail.resolutionDescription')}
          eyebrow={t('tickets.detail.resolutionEyebrow')}
          footer={
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setResolutionDialogOpen(false)}
                variant="secondary"
              >
                {t('common.actions.cancel')}
              </Button>
              <Button
                disabled={resolution.trim().length < 20 || statusBusy}
                onClick={() => void updateStatus('RESOLVED', resolution)}
              >
                {statusBusy
                  ? t('tickets.detail.saving')
                  : t('tickets.detail.markResolved')}
              </Button>
            </div>
          }
          onClose={() => setResolutionDialogOpen(false)}
          title={t('tickets.detail.resolveTicket')}
        >
          <label className="grid gap-2 text-xs">
            <span>{t('tickets.detail.resolution')}</span>
            <textarea
              className="min-h-28 resize-y rounded-sm border border-border p-3"
              onChange={(event) => setResolution(event.target.value)}
              placeholder={t('tickets.detail.resolutionPlaceholder')}
              value={resolution}
            />
          </label>
        </Dialog>
      ) : null}

      {closeDialogOpen ? (
        <Dialog
          description={t('tickets.detail.closeDescription')}
          eyebrow={t('tickets.detail.resolutionEyebrow')}
          footer={
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setCloseDialogOpen(false)}
                variant="secondary"
              >
                {t('common.actions.cancel')}
              </Button>
              <Button
                disabled={statusBusy}
                onClick={() => {
                  setCloseDialogOpen(false);
                  void updateStatus('CLOSED');
                }}
              >
                {statusBusy
                  ? t('tickets.detail.saving')
                  : t('tickets.detail.confirmClose')}
              </Button>
            </div>
          }
          onClose={() => setCloseDialogOpen(false)}
          title={t('tickets.detail.closeTicket')}
        >
          <div className="grid gap-2 rounded-sm bg-surface-secondary p-3 text-sm">
            <strong>{t('tickets.detail.resolution')}</strong>
            <p className="m-0 whitespace-pre-wrap text-muted">
              {ticket?.resolution || t('tickets.detail.noResolution')}
            </p>
          </div>
        </Dialog>
      ) : null}

      {menuOpen ? (
        <Dialog
          description={t('tickets.detail.actionsDescription', { id: ticketId })}
          eyebrow={t('tickets.detail.eyebrow')}
          footer={
            <Button onClick={onBack} variant="secondary">
              {t('tickets.detail.returnToTickets')}
            </Button>
          }
          onClose={() => setMenuOpen(false)}
          title={t('tickets.detail.actions')}
        >
          <Button fullWidth onClick={copyTicketId} variant="ghost">
            {t('tickets.detail.copyId')}
          </Button>
        </Dialog>
      ) : null}
    </div>
  );
}
