import { Button } from './Button';

interface ErrorStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Fallo al cargar: mensaje traducido y botón de reintento. */
export function ErrorState({
  title,
  description,
  actionLabel,
  onAction,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="grid justify-items-center gap-2 rounded-md border border-danger/30 bg-danger-surface px-6 py-10 text-center"
    >
      <p className="font-medium text-ink">{title}</p>
      {description ? (
        <p className="max-w-md text-sm leading-6 text-muted">{description}</p>
      ) : null}
      {onAction && actionLabel ? (
        <Button variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
