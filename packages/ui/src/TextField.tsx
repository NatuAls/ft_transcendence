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
  disabled,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div
      className={`ui-field grid min-w-0 gap-[7px] ${disabled ? 'opacity-70 cursor-not-allowed' : ''} ${className}`.trim()}
    >
      <label
        className={`ui-field__label text-xs leading-[1.2] font-medium text-ink ${disabled ? 'cursor-not-allowed' : ''}`}
        htmlFor={inputId}
      >
        {label}
      </label>
      <input
        className={`ui-field__input h-[52px] w-full min-w-0 rounded-[10px] border bg-[#f7faf8] px-4 text-sm leading-[1.2] text-ink placeholder:text-[#849397] focus:border-focus focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:text-muted ${disabled ? 'pointer-events-none caret-transparent select-none !outline-none' : ''} ${error ? 'border-danger' : 'border-border'}`}
        id={inputId}
        disabled={disabled}
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
