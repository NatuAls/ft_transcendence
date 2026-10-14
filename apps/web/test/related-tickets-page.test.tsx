import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RelatedTicketsPage } from '../src/features/tickets/RelatedTicketsPage';
import { apiError, mockApi, reply } from './support/api';
import { ids } from './support/fixtures';

const ticketId = '01a10712-4c1e-7b3d-a0f2-9be1d07c5a12';
const at = '2026-10-04T09:30:00.000Z';

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: ticketId,
    reference: 'HD-0242',
    title: 'Payment page unavailable',
    status: 'OPEN',
    priority: 'HIGH',
    organizationId: ids.organization,
    categoryName: 'Billing',
    categoryColor: '#ff0000',
    authorUsername: 'john',
    authorDisplayName: 'John Lee',
    assigneeUsername: null,
    assigneeDisplayName: null,
    commentCount: 0,
    attachmentCount: 0,
    rank: null,
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}

function body(data: unknown[]) {
  return {
    data,
    meta: {
      total: data.length,
      page: 1,
      take: 100,
      pages: 1,
      nextCursor: null,
      facets: {},
    },
  };
}

function renderPage(
  props: Partial<React.ComponentProps<typeof RelatedTicketsPage>> = {},
) {
  return render(
    <RelatedTicketsPage
      onBack={vi.fn()}
      onNewTicket={vi.fn()}
      onOpenTicket={vi.fn()}
      organizationId={ids.organization}
      personId={ids.member}
      personName="John Lee"
      {...props}
    />,
  );
}

describe('related tickets page', () => {
  it('loads tickets for the person and organization', async () => {
    const { calls } = mockApi({
      'GET /tickets': reply('GET /tickets', 200, body([ticket()])),
    });
    renderPage();
    expect(await screen.findByText('Payment page unavailable')).toBeTruthy();
    const call = calls.find((item) => item.path === '/tickets');
    expect(call?.query.get('createdById')).toBe(ids.member);
    expect(call?.query.get('organizationId')).toBe(ids.organization);
  });

  it('renders the empty state', async () => {
    mockApi({ 'GET /tickets': reply('GET /tickets', 200, body([])) });
    renderPage();
    expect(await screen.findByText('No related tickets match.')).toBeTruthy();
  });

  it('keeps the page usable when the API rejects the list', async () => {
    mockApi({
      'GET /tickets': apiError(
        'GET /tickets',
        401,
        'FORBIDDEN',
        'You cannot view these tickets.',
      ),
    });
    renderPage();
    expect(await screen.findByText('No related tickets match.')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search these tickets')).toBeTruthy();
  });

  it('filters loaded rows by status and priority', async () => {
    mockApi({
      'GET /tickets': reply(
        'GET /tickets',
        200,
        body([
          ticket(),
          ticket({
            id: ids.primary,
            title: 'VPN request',
            status: 'IN_PROGRESS',
            priority: 'MEDIUM',
          }),
        ]),
      ),
    });
    renderPage();
    await screen.findByText('Payment page unavailable');
    fireEvent.change(screen.getByLabelText('Statuses'), {
      target: { value: 'IN_PROGRESS' },
    });
    expect(screen.queryByText('Payment page unavailable')).toBeNull();
    expect(screen.getByText('VPN request')).toBeTruthy();
  });

  it('navigates back, creates and opens a ticket', async () => {
    const onBack = vi.fn();
    const onNewTicket = vi.fn();
    const onOpenTicket = vi.fn();
    mockApi({ 'GET /tickets': reply('GET /tickets', 200, body([ticket()])) });
    renderPage({ onBack, onNewTicket, onOpenTicket });
    await screen.findByText('Payment page unavailable');
    fireEvent.click(screen.getByRole('button', { name: /^←/ }));
    fireEvent.click(screen.getByRole('button', { name: /New ticket/ }));
    fireEvent.click(
      screen.getByRole('button', { name: /Payment page unavailable/ }),
    );
    expect(onBack).toHaveBeenCalledOnce();
    expect(onNewTicket).toHaveBeenCalledOnce();
    expect(onOpenTicket).toHaveBeenCalledWith(ticketId);
  });

  it('refetches when the search query changes', async () => {
    const { calls } = mockApi({
      'GET /tickets': reply('GET /tickets', 200, body([ticket()])),
    });
    renderPage();
    await screen.findByText('Payment page unavailable');
    fireEvent.change(screen.getByPlaceholderText('Search these tickets'), {
      target: { value: 'payment' },
    });
    await waitFor(() =>
      expect(calls.some((call) => call.query.get('q') === 'payment')).toBe(
        true,
      ),
    );
  });
});
