import { Button } from './Button';

export interface ErrorStateProps {
  actionLabel?: string;
  description?: string;
  onAction?: () => void;
  title: string;
}

/**
 * A read that failed, with a way out. `role="alert"` so it is announced the
 * moment it replaces the content, and a retry button rather than asking the
 * person to reload the page.
 */
export function ErrorState({
  actionLabel = 'Try again',
  description,
  onAction,
  title,
}: ErrorStateProps) {
  return (
    <div
      className="grid justify-items-center gap-2 rounded-md border border-danger/30 bg-danger-surface px-6 py-10 text-center"
      role="alert"
    >
      <strong className="font-medium text-danger">{title}</strong>
      {description ? (
        <p className="max-w-md text-sm leading-6 text-danger">{description}</p>
      ) : null}
      {onAction ? (
        <Button className="mt-2" onClick={onAction} variant="secondary">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
