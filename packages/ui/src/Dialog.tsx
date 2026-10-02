import {
  useEffect,
  useId,
  useRef,
  type FormEventHandler,
  type RefObject,
  type ReactNode,
} from 'react';

const focusableSelector = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface DialogProps {
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: string;
  footer?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  title: string;
}

export function Dialog({
  children,
  className = '',
  description,
  eyebrow,
  footer,
  initialFocusRef,
  onClose,
  onSubmit,
  title,
}: DialogProps) {
  const dialogRef = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const firstFocusable =
      dialog?.querySelector<HTMLElement>(focusableSelector);
    (initialFocusRef?.current ?? firstFocusable ?? dialog)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [initialFocusRef]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
    );
    if (!focusable.length) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="ui-dialog-backdrop fixed inset-0 z-100 grid place-items-center overflow-y-auto bg-[rgb(20_32_35/45%)] p-6 max-[560px]:items-end max-[560px]:p-3"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`ui-dialog flex max-h-[calc(100dvh-48px)] w-full max-w-[560px] flex-col overflow-hidden rounded-lg border border-border/70 bg-surface shadow-[0_20px_60px_rgb(0_0_0/20%)] focus:outline-none max-[560px]:max-h-[calc(100dvh-24px)] ${className}`.trim()}
        onKeyDown={handleKeyDown}
        onSubmit={onSubmit ?? ((event) => event.preventDefault())}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 px-6 pt-6 pb-4 max-[560px]:px-4">
          <div>
            {eyebrow ? (
              <span className="text-2xs font-medium tracking-[0.08em] text-muted">
                {eyebrow}
              </span>
            ) : null}
            <h2 className="mt-[3px] text-xl font-medium" id={titleId}>
              {title}
            </h2>
            {description ? (
              <p
                className="mt-2 text-xs leading-6 text-muted"
                id={descriptionId}
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            aria-label="Close dialog"
            className="grid size-9 shrink-0 place-items-center rounded-sm border-0 bg-surface-secondary text-[1.375rem] text-ink"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>
        {children ? (
          <div className="ui-dialog__content grid min-h-0 gap-4 overflow-y-auto px-6 pb-6 max-[560px]:px-4">
            {children}
          </div>
        ) : null}
        {footer ? (
          <footer className="ui-dialog__footer flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4 max-[560px]:flex-wrap max-[560px]:px-4 max-[560px]:[&_.ui-button]:min-w-0 max-[560px]:[&_.ui-button]:flex-[1_1_140px]">
            {footer}
          </footer>
        ) : null}
      </form>
    </div>
  );
}
