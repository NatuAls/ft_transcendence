import { useId, type SelectHTMLAttributes } from 'react';

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hideLabel?: boolean;
}

export function SelectField({
  className = '',
  hideLabel = false,
  id,
  label,
  disabled,
  ...props
}: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <label
      className={`ui-select-field grid min-w-0 gap-[7px] text-xs leading-[1.2] font-medium text-ink ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      htmlFor={selectId}
    >
      <span className={hideLabel ? 'sr-only' : ''}>{label}</span>
      <select
        className={`ui-select-field__control h-[52px] w-full min-w-0 appearance-none rounded-[10px] border border-border bg-[#f7faf8] px-4 pr-[38px] text-sm leading-[1.2] text-ink focus-visible:border-focus focus-visible:outline-3 focus-visible:outline-focus disabled:opacity-60 disabled:cursor-not-allowed ${className}`.trim()}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5 6 6.5l5-5' fill='none' stroke='%235E6B70' stroke-width='1.5'/%3E%3C/svg%3E\")",
          backgroundPosition: 'right 14px center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '12px 8px',
        }}
        id={selectId}
        {...props}
      />
    </label>
  );
}
