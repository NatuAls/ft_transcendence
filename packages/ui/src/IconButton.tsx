import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: IconName;
  size?: 'sm' | 'md';
}

export function IconButton({
  className = '',
  icon,
  label,
  size = 'md',
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={`inline-grid shrink-0 place-items-center rounded-sm text-ink transition-colors hover:bg-surface-secondary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 ${size === 'sm' ? 'size-8' : 'size-10'} ${className}`.trim()}
      title={label}
      type={type}
      {...props}
    >
      <Icon name={icon} size={size === 'sm' ? 18 : 20} />
    </button>
  );
}
