import type { HTMLAttributes, ReactNode } from 'react';

export type StatusBadgeTone =
  'open' | 'progress' | 'resolved' | 'urgent' | 'closed';

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone: StatusBadgeTone;
}

const tones: Record<StatusBadgeTone, string> = {
  open: 'bg-info-surface text-info',
  progress: 'bg-warning-surface text-warning',
  resolved: 'bg-success-surface text-success',
  urgent: 'bg-danger-surface text-danger',
  closed: 'bg-[#e8ebea] text-muted',
};

export function StatusBadge({
  children,
  className = '',
  tone,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={`ui-status-badge inline-flex min-h-6 items-center justify-center rounded-full px-2.5 py-[3px] text-xs leading-[18px] font-medium whitespace-nowrap ${tones[tone]} ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}
