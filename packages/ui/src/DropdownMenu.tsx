import type { HTMLAttributes, ReactNode } from 'react';

export interface DropdownMenuProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  label: string;
}

export function DropdownMenu({
  children,
  className = '',
  label,
  ...props
}: DropdownMenuProps) {
  return (
    <div
      aria-label={label}
      className={`rounded-md border border-border bg-surface p-1.5 shadow-[0_14px_38px_rgb(22_39_43/16%)] ${className}`.trim()}
      role="menu"
      {...props}
    >
      {children}
    </div>
  );
}
