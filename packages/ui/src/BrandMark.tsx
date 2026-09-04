import type { HTMLAttributes } from 'react';

export function BrandMark({
  className = '',
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`ui-brand-mark ${className}`.trim()}
      aria-hidden="true"
      {...props}
    >
      <span className="ui-brand-mark__bubble" />
    </span>
  );
}
