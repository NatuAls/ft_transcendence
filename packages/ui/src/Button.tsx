import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-surface hover:not-disabled:bg-primary-hover',
  secondary:
    'border-border bg-surface text-ink hover:not-disabled:bg-surface-secondary',
  ghost: 'bg-surface-secondary text-primary hover:not-disabled:bg-[#e6ebe6]',
  destructive: 'bg-danger text-surface hover:not-disabled:bg-[#7f4343]',
};

export function Button({
  className = '',
  variant = 'primary',
  fullWidth = false,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = [
    'ui-button',
    'inline-flex min-h-11 min-w-[170px] items-center justify-center rounded-sm border border-transparent px-6 text-sm leading-[1.2] font-medium transition-colors duration-160 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus/40 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-secondary disabled:text-[#9aa5a3]',
    variants[variant],
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <button className={classes} type={type} {...props} />;
}
