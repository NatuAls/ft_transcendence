import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  label: ReactNode;
}

export function Checkbox({
  className = '',
  id,
  label,
  ...props
}: CheckboxProps) {
  // Sin `id` ni `name`, Chrome avisa de que el autocompletado no lo reconoce.
  const generatedId = useId();

  return (
    <label
      className={`ui-checkbox relative inline-flex cursor-pointer items-center gap-2.5 text-[0.8125rem] leading-[1.2] text-muted ${className}`.trim()}
    >
      <input
        className="peer sr-only"
        id={id ?? generatedId}
        type="checkbox"
        {...props}
      />
      <span
        className="grid size-5 shrink-0 place-items-center rounded-[5px] border border-border bg-surface after:h-1 after:w-2 after:-translate-y-px after:-rotate-45 after:border-b-2 after:border-l-2 after:border-surface after:content-[''] peer-checked:border-primary peer-checked:bg-primary peer-not-checked:after:hidden peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
        aria-hidden="true"
      />
      <span className="peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
        {label}
      </span>
    </label>
  );
}
