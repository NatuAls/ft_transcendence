import type { HTMLAttributes, ReactNode } from 'react';

export type StatusBadgeTone =
  'open' | 'progress' | 'resolved' | 'urgent' | 'closed';

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone: StatusBadgeTone;
}

export function StatusBadge({
  children,
  className = '',
  tone,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={`ui-status-badge ui-status-badge--${tone} ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}
