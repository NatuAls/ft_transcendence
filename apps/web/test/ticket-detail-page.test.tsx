import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../src/core/feedback/ToastProvider';
import { TicketDetailPage } from '../src/features/tickets/TicketDetailPage';
import { apiError, mockApi, reply } from './support/api';
import { ids } from './support/fixtures';

const ticketId = '01a10712-4c1e-7b3d-a0f2-9be1d07c5a12';
const categoryId = '01a10712-4c1e-7b3d-a0f2-9be1d07c5a13';
const commentId = '01a10712-4c1e-7b3d-a0f2-9be1d07c5a14';
const at = '2026-10-04T09:30:00.000Z';

const listeners = new Map<string, Array<(payload: unknown) => void>>();

vi.mock('../src/core/realtime/socket', async () => {
  const real = await vi.importActual<
    typeof import('../src/core/realtime/socket')
  >('../src/core/realtime/socket');
  return {
    ...real,
    connectRealtime: vi.fn(),
    onRealtime: (event: string, handler: (payload: unknown) => void) => {
      const handlers = listeners.get(event) ?? [];
      handlers.push(handler);
      listeners.set(event, handlers);
      return () =>
        listeners.set(
          event,
          (listeners.get(event) ?? []).filter((item) => item !== handler),
        );
    },
    rooms: {
      subscribeTicket: vi.fn(async () => true),
      unsubscribeTicket: vi.fn(),
    },
  };
});

const { RealtimeEvents } = await import('../src/core/realtime/socket');

function emit(event: string, payload: unknown) {
  for (const handler of listeners.get(event) ?? []) handler(payload);
}

function user(id: string, displayName: string) {
  return {
    id,
    username: displayName.toLowerCase().replace(' ', '.'),
    profile: { displayName, avatarUrl: null },
  };
}

function detail(overrides: Record<string, unknown> = {}) {
  return {
    id: ticketId,
    reference: 'HD-0242',
    title: 'Payment page unavailable',
    description: 'The payment page returns an error after submitting the form.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    organizationId: ids.organization,
    category: {
      id: categoryId,
      name: 'Billing',
      description: 'Billing requests',
      color: '#ff0000',
      isActive: true,
      _count: { tickets: 1 },
    },
    createdBy: user(ids.member, 'John Lee'),
    assignedTo: user(ids.agent, 'Maya Singh'),
    resolution: null,
    createdAt: at,
    updatedAt: at,
    firstResponseAt: at,
    resolvedAt: null,
    closedAt: null,
    _count: { comments: 1, attachments: 0 },
    ...overrides,
  };
}

function comment(body = 'We are investigating the payment provider.') {
  return {
    id: commentId,
    body,
    isInternal: false,
    author: user(ids.agent, 'Maya Singh'),
    createdAt: at,
    updatedAt: at,
  };
}

function routes(
  extra: Record<
    string,
    ReturnType<typeof reply> | (() => ReturnType<typeof reply>)
  > = {},
) {
  return mockApi({
    [`GET /tickets/${ticketId}`]: reply('GET /tickets/{id}', 200, detail()),
    [`GET /tickets/${ticketId}/comments`]: reply(
      'GET /tickets/{id}/comments',
      200,
      [comment()],
    ),
    ...extra,
  });
}

function renderDetail(
  props: Partial<React.ComponentProps<typeof TicketDetailPage>> = {},
) {
  return render(
    <ToastProvider>
      <TicketDetailPage
        canChangeStatus={false}
        canReassign={false}
        canReopenTickets={false}
        canSelfAssign={false}
        currentUserId={ids.member}
        onBack={vi.fn()}
        organizationId={ids.organization}
        organizationName="Northstar Team"
        ticketId={ticketId}
        {...props}
      />
    </ToastProvider>,
  );
}

describe('ticket detail page', () => {
  beforeEach(() => listeners.clear());

  it('renders ticket data and its conversation', async () => {
    routes();
    renderDetail();
    expect(await screen.findByText('Payment page unavailable')).toBeTruthy();
    expect(
      await screen.findByText('We are investigating the payment provider.'),
    ).toBeTruthy();
    expect(screen.getByText('High')).toBeTruthy();
  });

  it('renders an empty conversation without inventing a comment', async () => {
    routes({
      [`GET /tickets/${ticketId}/comments`]: reply(
        'GET /tickets/{id}/comments',
        200,
        [],
      ),
    });
    renderDetail();
    await screen.findByText('Payment page unavailable');
    await waitFor(() =>
      expect(
        screen.queryByText('We are investigating the payment provider.'),
      ).toBeNull(),
    );
  });

  it('shows a ticket loading error and retries it', async () => {
    let attempts = 0;
    routes({
      [`GET /tickets/${ticketId}`]: () => {
        attempts += 1;
        return attempts === 1
          ? apiError(
              'GET /tickets/{id}',
              500,
              'INTERNAL_ERROR',
              'Unexpected error. Please try again.',
            )
          : reply('GET /tickets/{id}', 200, detail());
      },
    });
    renderDetail();
    expect(
      await screen.findByText('No connection to the server.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Payment page unavailable')).toBeTruthy();
  });

  it('hides staff actions and restricts conversation for a non-author member', async () => {
    routes({
      [`GET /tickets/${ticketId}`]: reply(
        'GET /tickets/{id}',
        200,
        detail({ createdBy: user(ids.agent, 'Maya Singh') }),
      ),
    });
    renderDetail();
    expect(
      await screen.findByText(
        'Only the ticket creator, assigned support agent or organization administrator can access this conversation.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Agent options')).toBeNull();
  });

  it('sends a reply successfully', async () => {
    const { calls } = routes({
      [`POST /tickets/${ticketId}/comments`]: reply(
        'POST /tickets/{id}/comments',
        201,
        comment('Thanks, I will check the logs now.'),
      ),
    });
    renderDetail();
    const input = await screen.findByPlaceholderText('Write a reply…');
    fireEvent.change(input, {
      target: { value: 'Thanks, I will check the logs now.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.method === 'POST' &&
            call.body &&
            (call.body as { body: string }).body ===
              'Thanks, I will check the logs now.',
        ),
      ).toBe(true),
    );
    expect(await screen.findByText('Reply added.')).toBeTruthy();
  });

  it('shows an API rejection when sending a reply', async () => {
    routes({
      [`POST /tickets/${ticketId}/comments`]: apiError(
        'POST /tickets/{id}/comments',
        403,
        'FORBIDDEN',
        'You cannot access this ticket conversation.',
      ),
    });
    renderDetail();
    fireEvent.change(await screen.findByPlaceholderText('Write a reply…'), {
      target: { value: 'A reply that the API will reject.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
    // `apiError()` fabrica una clave que no existe en los idiomas
    // (`errors.test.FORBIDDEN`). Antes salía tal cual en pantalla; ahora una
    // clave de error sin traducir da el mensaje genérico, que es lo que vería
    // la persona. El rechazo se sigue enseñando, sólo que legible.
    expect(
      await screen.findByText('Unexpected error. Please try again.'),
    ).toBeTruthy();
    expect(screen.queryByText('errors.test.FORBIDDEN')).toBeNull();
  });

  it('reloads the ticket when its realtime update arrives', async () => {
    let current = detail();
    const { calls } = routes({
      [`GET /tickets/${ticketId}`]: () =>
        reply('GET /tickets/{id}', 200, current),
    });
    renderDetail();
    await screen.findByText('Payment page unavailable');
    const before = calls.filter(
      (call) => call.path === `/tickets/${ticketId}`,
    ).length;
    current = detail({ title: 'Payment page restored' });
    await act(async () => {
      emit(RealtimeEvents.ticketUpdated, { ticket: { id: ticketId } });
    });
    await waitFor(() =>
      expect(
        calls.filter((call) => call.path === `/tickets/${ticketId}`).length,
      ).toBeGreaterThan(before),
    );
    expect(await screen.findByText('Payment page restored')).toBeTruthy();
  });
});
