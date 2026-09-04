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
  ...props
}: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <label
      className={`ui-select-field ${hideLabel ? 'ui-select-field--hidden-label' : ''}`.trim()}
      htmlFor={selectId}
    >
      <span className="ui-select-field__label">{label}</span>
      <select
        className={`ui-select-field__control ${className}`.trim()}
        id={selectId}
        {...props}
      />
    </label>
  );
}
