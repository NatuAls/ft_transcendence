import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketListPage } from '../src/features/tickets/TicketListPage';
import { apiError, mockApi, reply } from './support/api';
import { ids } from './support/fixtures';

const at = '2026-10-04T09:30:00.000Z';
const firstTicketId = '01a10712-4c1e-7b3d-a0f2-9be1d07c5a12';
const secondTicketId = '01a10712-4c1e-7b3d-a0f2-9be1d07c5a13';
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
  };
});

const { RealtimeEvents } = await import('../src/core/realtime/socket');

function emit(event: string, payload: unknown) {
  for (const handler of listeners.get(event) ?? []) handler(payload);
}

function listItem(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    reference: id === firstTicketId ? 'HD-0242' : 'HD-0243',
    title:
      id === firstTicketId ? 'Payment page unavailable' : 'VPN access request',
    status: 'OPEN',
    priority: 'HIGH',
    organizationId: ids.organization,
    categoryName: 'Billing',
    categoryColor: '#ff0000',
    authorUsername: 'john',
    authorDisplayName: 'John Lee',
    assigneeUsername: 'maya',
    assigneeDisplayName: 'Maya Singh',
    commentCount: 0,
    attachmentCount: 0,
    rank: null,
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}

function searchBody(data: unknown[]) {
  return {
    data,
    meta: {
      total: data.length,
      page: 1,
      take: 30,
      pages: 1,
      nextCursor: null,
      tookMs: 1,
      facets: {
        status: { OPEN: 1, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 },
        priority: { HIGH: 1, MEDIUM: 0, LOW: 0 },
      },
    },
  };
}

function routes(
  extra: Record<
    string,
    ReturnType<typeof reply> | (() => ReturnType<typeof reply>)
  > = {},
) {
  return mockApi({
    'GET /tickets': reply(
      'GET /tickets',
      200,
      searchBody([listItem(firstTicketId)]),
    ),
    [`GET /organizations/${ids.organization}/categories`]: reply(
      'GET /organizations/{organizationId}/categories',
      200,
      [],
    ),
    ...extra,
  });
}

function renderList(
  props: Partial<React.ComponentProps<typeof TicketListPage>> = {},
) {
  return render(
    <TicketListPage
      currentUserName="John Lee"
      onBackToCategories={vi.fn()}
      onCreateTicket={vi.fn()}
      onFiltersChange={vi.fn()}
      onOpenTicket={vi.fn()}
      organizationId={ids.organization}
      organizationWide
      {...props}
    />,
  );
}

describe('ticket list page', () => {
  beforeEach(() => listeners.clear());

  it('renders ticket rows and summary counters', async () => {
    routes();
    renderList();
    expect(
      (await screen.findAllByText('Payment page unavailable')).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
    expect(screen.getByText('High priority')).toBeTruthy();
    expect(screen.getByText('Created by John Lee')).toBeTruthy();
  });

  it('renders the empty state when the API returns no tickets', async () => {
    routes({
      'GET /tickets': reply('GET /tickets', 200, searchBody([])),
    });
    renderList();
    expect(await screen.findByText('No tickets yet')).toBeTruthy();
  });

  it('shows a list error and retries it', async () => {
    let attempts = 0;
    routes({
      'GET /tickets': () => {
        attempts += 1;
        return attempts === 1
          ? apiError(
              'GET /tickets',
              500,
              'INTERNAL_ERROR',
              'Unexpected error. Please try again.',
            )
          : reply('GET /tickets', 200, searchBody([listItem(firstTicketId)]));
      },
    });
    renderList();
    expect(await screen.findByText('Could not load tickets')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(
      (await screen.findAllByText('Payment page unavailable')).length,
    ).toBeGreaterThan(0);
  });

  it('hides organization-wide creator metadata for a personal member list', async () => {
    routes();
    renderList({ organizationWide: false });
    await screen.findAllByText('Payment page unavailable');
    expect(screen.queryByText('Created by John Lee')).toBeNull();
    expect(screen.getByText('Your tickets')).toBeTruthy();
  });

  it('refetches when the status filter changes', async () => {
    const { calls } = routes({
      'GET /tickets': reply(
        'GET /tickets',
        200,
        searchBody([listItem(firstTicketId)]),
      ),
    });
    renderList();
    await screen.findAllByText('Payment page unavailable');
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'In progress' },
    });
    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.method === 'GET' &&
            call.path === '/tickets' &&
            call.query.get('status') === 'IN_PROGRESS',
        ),
      ).toBe(true),
    );
  });

  it('keeps the API error visible when a filtered request is rejected', async () => {
    routes({
      'GET /tickets': (call) =>
        call.query.get('status') === 'IN_PROGRESS'
          ? apiError(
              'GET /tickets',
              400,
              'FORBIDDEN',
              'You are not allowed to search these tickets.',
            )
          : reply('GET /tickets', 200, searchBody([listItem(firstTicketId)])),
    });
    renderList();
    await screen.findAllByText('Payment page unavailable');
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'In progress' },
    });
    expect(await screen.findByText('Could not load tickets')).toBeTruthy();
  });

  it('reloads the list after a ticket realtime update', async () => {
    let data = [listItem(firstTicketId)];
    const { calls } = routes({
      'GET /tickets': () => reply('GET /tickets', 200, searchBody(data)),
    });
    renderList();
    await screen.findAllByText('Payment page unavailable');
    const before = calls.filter((call) => call.path === '/tickets').length;
    data = [listItem(secondTicketId, { title: 'VPN access request' })];
    await act(async () => {
      emit(RealtimeEvents.ticketUpdated, {
        ticket: { organizationId: ids.organization },
      });
    });
    await waitFor(() =>
      expect(
        calls.filter((call) => call.path === '/tickets').length,
      ).toBeGreaterThan(before),
    );
    expect(
      (await screen.findAllByText('VPN access request')).length,
    ).toBeGreaterThan(0);
  });
});
