import type { HTMLAttributes } from 'react';

export function BrandMark({
  className = '',
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden="true"
      className={`ui-brand-mark relative inline-grid size-11 shrink-0 place-items-center rounded-md bg-[#86afa4]/25 ${className}`.trim()}
      {...props}
    >
      <svg
        className="size-[78%]"
        fill="none"
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 24v-3.5C12 13.6 17.4 8 24 8s12 5.6 12 12.5V24"
          stroke="#365d63"
          strokeLinecap="round"
          strokeWidth="4"
        />
        <path
          d="M16 18h16v15H25l-6 5v-5h-3V18Z"
          fill="#86afa4"
          stroke="#183039"
          strokeLinejoin="round"
          strokeWidth="2.2"
        />
        <path
          d="M20 23h8M20 27h6"
          stroke="#183039"
          strokeLinecap="round"
          strokeWidth="2"
        />
        <rect fill="#183039" height="12" rx="3" width="6" x="8" y="21" />
        <rect fill="#183039" height="12" rx="3" width="6" x="34" y="21" />
        <path
          d="M37 31v1c0 4-3 6-7 6h-2"
          stroke="#183039"
          strokeLinecap="round"
          strokeWidth="3"
        />
      </svg>
    </span>
  );
}
