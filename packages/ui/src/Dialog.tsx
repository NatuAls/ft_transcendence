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
      className="ui-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`ui-dialog ${className}`.trim()}
        onKeyDown={handleKeyDown}
        onSubmit={onSubmit ?? ((event) => event.preventDefault())}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="ui-dialog__header">
          <div>
            {eyebrow ? (
              <span className="ui-dialog__eyebrow">{eyebrow}</span>
            ) : null}
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button aria-label="Close dialog" onClick={onClose} type="button">
            ×
          </button>
        </header>
        {children ? <div className="ui-dialog__content">{children}</div> : null}
        {footer ? (
          <footer className="ui-dialog__footer">{footer}</footer>
        ) : null}
      </form>
    </div>
  );
}
