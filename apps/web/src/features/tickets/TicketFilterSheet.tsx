import { Button, SelectField } from 'ui';
import { useEffect, useRef } from 'react';
import type { Ticket } from './ticketData';

export function TicketFilterSheet({
  category,
  onCategoryChange,
  onClose,
  onPriorityChange,
  onSortChange,
  onStatusChange,
  priority,
  sort,
  status,
  tickets,
}: {
  category: string;
  onCategoryChange: (value: string) => void;
  onClose: () => void;
  onPriorityChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  priority: string;
  sort: string;
  status: string;
  tickets: Ticket[];
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    headingRef.current?.focus();

    function handleDialogKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled]), input:not([disabled])',
        ) ?? [],
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleDialogKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleDialogKey);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div
      aria-labelledby="ticket-filter-title"
      aria-modal="true"
      className="ticket-filter-sheet"
      ref={dialogRef}
      role="dialog"
    >
      <header>
        <button onClick={onClose} type="button">
          ← Tickets
        </button>
        <h2 id="ticket-filter-title" ref={headingRef} tabIndex={-1}>
          Filter tickets
        </h2>
        <p>Combine fields to narrow the ticket list.</p>
      </header>
      <div>
        <SelectField
          label="Category"
          onChange={(event) => onCategoryChange(event.target.value)}
          value={category}
        >
          <option value="all">All categories</option>
          {[...new Set(tickets.map((ticket) => ticket.category))].map(
            (value) => (
              <option key={value}>{value}</option>
            ),
          )}
        </SelectField>
        <SelectField
          label="Status"
          onChange={(event) => onStatusChange(event.target.value)}
          value={status}
        >
          <option value="all">All statuses</option>
          <option>Open</option>
          <option>In progress</option>
          <option>Resolved</option>
          <option>Closed</option>
        </SelectField>
        <SelectField
          label="Priority"
          onChange={(event) => onPriorityChange(event.target.value)}
          value={priority}
        >
          <option value="all">All priorities</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </SelectField>
        <SelectField
          label="Sort order"
          onChange={(event) => onSortChange(event.target.value)}
          value={sort}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </SelectField>
      </div>
      <Button fullWidth onClick={onClose}>
        Apply filters
      </Button>
    </div>
  );
}
