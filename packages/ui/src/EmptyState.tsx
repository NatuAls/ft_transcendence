import type { ReactNode } from 'react';

export interface EmptyStateProps {
  action?: ReactNode;
  description: string;
  title: string;
}

export function EmptyState({ action, description, title }: EmptyStateProps) {
  return (
    <div className="grid justify-items-center gap-2 rounded-md border border-dashed border-border px-6 py-10 text-center">
      <strong className="font-medium text-ink">{title}</strong>
      <p className="max-w-md text-sm leading-6 text-muted">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
