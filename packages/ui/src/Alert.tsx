import type { HTMLAttributes, ReactNode } from 'react';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
}

const tones = {
  info: 'border-info/30 bg-[#e5eef0] text-info',
  success: 'border-success/30 bg-[#e1ece5] text-success',
  warning: 'border-warning/30 bg-[#efe9dc] text-warning',
  danger: 'border-danger/30 bg-[#f1e3e3] text-danger',
};

export function Alert({
  children,
  className = '',
  title,
  tone = 'info',
  ...props
}: AlertProps) {
  return (
    <div
      className={`rounded-md border p-4 text-sm leading-6 ${tones[tone]} ${className}`.trim()}
      role={tone === 'danger' ? 'alert' : 'status'}
      {...props}
    >
      {title ? (
        <strong className="mb-1 block font-medium">{title}</strong>
      ) : null}
      {children}
    </div>
  );
}
