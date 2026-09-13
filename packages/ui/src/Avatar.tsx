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
      className={`ui-avatar ${online ? 'ui-avatar--online' : ''} ${className}`.trim()}
      role={alt ? 'img' : undefined}
      {...props}
    >
      {src ? <img alt="" src={src} /> : initials}
      {online ? (
        <span aria-hidden="true" className="ui-avatar__presence" />
      ) : null}
    </span>
  );
}
