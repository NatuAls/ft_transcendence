import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonSize = 'default' | 'compact';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-surface hover:not-disabled:bg-primary-hover',
  secondary:
    'border-border bg-surface text-ink hover:not-disabled:bg-surface-secondary',
  ghost: 'bg-surface-secondary text-primary hover:not-disabled:bg-[#e6ebe6]',
  destructive: 'bg-danger text-surface hover:not-disabled:bg-[#7f4343]',
};

const sizes: Record<ButtonSize, string> = {
  default: 'min-w-[170px] px-6',
  compact: 'min-w-0 px-3',
};

export function Button({
  className = '',
  variant = 'primary',
  size = 'default',
  fullWidth = false,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = [
    'ui-button',
    'inline-flex min-h-11 items-center justify-center rounded-sm border border-transparent text-sm leading-[1.2] font-medium transition-colors duration-160 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-secondary disabled:text-[#9aa5a3]',
    variants[variant],
    sizes[size],
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <button className={classes} type={type} {...props} />;
}
