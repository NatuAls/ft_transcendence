import type { HTMLAttributes } from 'react';

export function BrandMark({
  className = '',
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`ui-brand-mark relative inline-grid size-11 shrink-0 place-items-center rounded-md bg-[#bfd8cf] ${className}`.trim()}
      aria-hidden="true"
      {...props}
    >
      <span className="ui-brand-mark__bubble relative block h-[17px] w-[22px] rounded-[6px] bg-[#183039] before:absolute before:bottom-[-4px] before:left-[5px] before:size-[7px] before:bg-[#183039] before:[clip-path:polygon(0_0,100%_0,0_100%)] before:content-[''] after:absolute after:top-[6px] after:left-[5px] after:h-0.5 after:w-3 after:rounded-full after:bg-[#bfd8cf] after:shadow-[0_4px_0_-0.25px_#bfd8cf] after:content-['']" />
    </span>
  );
}
