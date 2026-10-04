export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastProps {
  tone?: ToastTone;
  title: string;
  description?: string;
  onClose?: () => void;
}

/** Aviso breve; el apilado y el temporizador los gestiona ToastProvider. */
export function Toast({
  tone = 'info',
  title,
  description,
  onClose,
}: ToastProps) {
  const toneClasses = {
    info: 'border-info bg-info-surface',
    success: 'border-success bg-success-surface',
    warning: 'border-warning bg-warning-surface',
    danger: 'border-danger bg-danger-surface',
  }[tone];

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-md border px-4 py-3 shadow-lg ${toneClasses}`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{title}</p>
        {description ? (
          <p className="mt-1 text-sm leading-5 text-muted">{description}</p>
        ) : null}
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 text-xl leading-none text-muted hover:text-ink"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
