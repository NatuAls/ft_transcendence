export interface SkeletonProps {
  /** How many placeholder lines to draw. */
  lines?: number;
  className?: string;
}

/**
 * Loading placeholder: animated blocks roughly the width of the content that
 * is coming. Preferred over a spinner for lists and panels, because it keeps
 * the layout from jumping when the data lands.
 *
 * It announces itself once ("Loading") instead of leaving a screen reader in
 * silence, and carries `aria-busy` so the region is reported as pending.
 */
export function Skeleton({ lines = 3, className = '' }: SkeletonProps) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={`grid gap-2.5 ${className}`.trim()}
      role="status"
    >
      {Array.from({ length: lines }, (_, line) => (
        <span
          aria-hidden="true"
          className="h-3.5 animate-pulse rounded-sm bg-surface-secondary"
          key={line}
          style={{ width: `${100 - (line % 3) * 18}%` }}
        />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}
