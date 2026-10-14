import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GlobalSearchDialog } from '../src/layout/GlobalSearchDialog';
import { mockApi, reply } from './support/api';
import { ids } from './support/fixtures';

const ticketId = '01a10712-4c1e-7b3d-a0f2-9be1d07c5a12';
const personId = '01a10712-4c1e-7b3d-a0f2-9be1d07c5a13';
const at = '2026-10-04T09:30:00.000Z';

function searchBody(data: unknown[]) {
  return {
    data,
    meta: {
      total: data.length,
      page: 1,
      take: 5,
      pages: 1,
      nextCursor: null,
      facets: {},
    },
  };
}

function renderSearch(
  props: Partial<React.ComponentProps<typeof GlobalSearchDialog>> = {},
) {
  return render(
    <GlobalSearchDialog
      onClose={vi.fn()}
      onNavigate={vi.fn()}
      organizationId={ids.organization}
      {...props}
    />,
  );
}

describe('global search dialog', () => {
  it('renders the fixed Tickets, People and Messages sections', () => {
    renderSearch();
    expect(screen.getByText('Tickets')).toBeTruthy();
    expect(screen.getByText('People')).toBeTruthy();
    expect(screen.getByText('Messages')).toBeTruthy();
  });

  it('waits 300ms before searching tickets and people', async () => {
    const { calls } = mockApi({
      'GET /tickets': reply(
        'GET /tickets',
        200,
        searchBody([
          {
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
          },
        ]),
      ),
      'GET /users/search': reply('GET /users/search', 200, [
        {
          id: personId,
          username: 'maya',
          profile: { displayName: 'Maya Singh', avatarUrl: null },
        },
      ]),
    });
    renderSearch();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'pay' },
    });
    expect(calls).toHaveLength(0);
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(calls).toHaveLength(0);
    await waitFor(() => expect(calls).toHaveLength(2), { timeout: 1000 });
    expect(await screen.findByText('Payment page unavailable')).toBeTruthy();
    expect(screen.getByText('Maya Singh')).toBeTruthy();
  });

  it('navigates with keyboard selection', () => {
    const onNavigate = vi.fn();
    renderSearch({ onNavigate });
    const input = screen.getByRole('searchbox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledWith('people', {});
  });

  it('shows an empty state when no search results exist', async () => {
    mockApi({
      'GET /tickets': reply('GET /tickets', 200, searchBody([])),
      'GET /users/search': reply('GET /users/search', 200, []),
    });
    renderSearch();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'nothing' },
    });
    await waitFor(() => expect(screen.getByText('No results')).toBeTruthy(), {
      timeout: 1500,
    });
  });
});
