import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  error?: string;
}

export function TextField({
  className = '',
  error,
  id,
  label,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className={`ui-field grid min-w-0 gap-[7px] ${className}`.trim()}>
      <label
        className="ui-field__label text-xs leading-[1.2] font-medium text-ink"
        htmlFor={inputId}
      >
        {label}
      </label>
      <input
        className={`ui-field__input h-[52px] w-full min-w-0 rounded-[10px] border bg-[#f7faf8] px-4 text-sm leading-[1.2] text-ink placeholder:text-[#849397] focus:border-focus focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus ${error ? 'border-danger' : 'border-border'}`}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error ? (
        <span
          className="ui-field__error text-xs leading-[1.2] text-danger"
          id={errorId}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
