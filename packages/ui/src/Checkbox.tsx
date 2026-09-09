import type { InputHTMLAttributes, ReactNode } from 'react';

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  label: ReactNode;
}

export function Checkbox({ className = '', label, ...props }: CheckboxProps) {
  return (
    <label className={`ui-checkbox ${className}`.trim()}>
      <input className="ui-checkbox__input" type="checkbox" {...props} />
      <span className="ui-checkbox__control" aria-hidden="true" />
      <span className="ui-checkbox__label">{label}</span>
    </label>
  );
}
