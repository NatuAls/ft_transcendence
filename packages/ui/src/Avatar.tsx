import type { HTMLAttributes } from 'react';

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  alt?: string;
  initials: string;
  online?: boolean;
  src?: string;
}

export function Avatar({
  alt = '',
  className = '',
  initials,
  online = false,
  src,
  ...props
}: AvatarProps) {
  return (
    <span
      aria-label={alt || undefined}
      className={`ui-avatar relative inline-grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[#d8e5df] text-xs leading-none font-medium text-[#29484e] ${className}`.trim()}
      role={alt ? 'img' : undefined}
      {...props}
    >
      {src ? (
        <img alt="" className="size-full object-cover" src={src} />
      ) : (
        initials
      )}
      {online ? (
        <span
          aria-hidden="true"
          className="absolute right-0.5 bottom-0.5 size-2.5 rounded-full border-2 border-surface bg-success"
        />
      ) : null}
    </span>
  );
}
