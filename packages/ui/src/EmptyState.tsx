import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="grid justify-items-center gap-2 rounded-md border border-dashed border-border px-6 py-10 text-center">
      {icon ? (
        <div className="text-primary" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <strong className="font-medium text-ink">{title}</strong>
      {description ? (
        <p className="max-w-md text-sm leading-6 text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
