import { Button, SelectField } from 'ui';
import { useEffect, useRef } from 'react';
import type { CategoryRecord } from '../../api/organizations';
import { useTranslation } from '../../core/i18n';

interface TicketFilterSheetProps {
  activeCategories: CategoryRecord[];
  categoryId: string;
  onCategoryChange: (value: string) => void;
  onClose: () => void;
  onPriorityChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  priority: string;
  sort: string;
  status: string;
}

export function TicketFilterSheet({
  activeCategories,
  categoryId,
  onCategoryChange,
  onClose,
  onPriorityChange,
  onSortChange,
  onStatusChange,
  priority,
  sort,
  status,
}: TicketFilterSheetProps) {
  const { t } = useTranslation();
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
      className="fixed inset-0 z-40 hidden flex-col overflow-auto bg-surface px-[18px] py-[22px] max-md:flex"
      ref={dialogRef}
      role="dialog"
    >
      <header>
        <button className="p-0 text-primary" onClick={onClose} type="button">
          ← {t('tickets.title')}
        </button>
        <h2
          className="mt-7 mb-1.5 text-[1.375rem] font-medium"
          id="ticket-filter-title"
          ref={headingRef}
          tabIndex={-1}
        >
          {t('tickets.filters.title')}
        </h2>
        <p className="text-xs text-muted">{t('tickets.filters.description')}</p>
      </header>

      <div className="my-7 grid gap-4">
        <SelectField
          label={t('tickets.filters.category.label')}
          onChange={(event) => onCategoryChange(event.target.value)}
          value={categoryId}
        >
          <option value="all">{t('tickets.filters.category.all')}</option>
          {activeCategories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          label={t('tickets.filters.status.label')}
          onChange={(event) => onStatusChange(event.target.value)}
          value={status}
        >
          <option value="all">{t('tickets.filters.status.all')}</option>
          <option value="Open">{t('tickets.status.OPEN')}</option>
          <option value="In progress">{t('tickets.status.IN_PROGRESS')}</option>
          <option value="Resolved">{t('tickets.status.RESOLVED')}</option>
          <option value="Closed">{t('tickets.status.CLOSED')}</option>
        </SelectField>

        <SelectField
          label={t('tickets.filters.priority.label')}
          onChange={(event) => onPriorityChange(event.target.value)}
          value={priority}
        >
          <option value="all">{t('tickets.filters.priority.all')}</option>
          <option value="High">{t('tickets.priority.HIGH')}</option>
          <option value="Medium">{t('tickets.priority.MEDIUM')}</option>
          <option value="Low">{t('tickets.priority.LOW')}</option>
        </SelectField>

        <SelectField
          label={t('tickets.filters.sort.label')}
          onChange={(event) => onSortChange(event.target.value)}
          value={sort}
        >
          <option value="newest">{t('tickets.filters.sort.newest')}</option>
          <option value="oldest">{t('tickets.filters.sort.oldest')}</option>
        </SelectField>
      </div>

      <Button className="mt-auto" fullWidth onClick={onClose}>
        {t('tickets.filters.apply')}
      </Button>
    </div>
  );
}
