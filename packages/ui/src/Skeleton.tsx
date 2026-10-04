/** Marcador de carga: bloques animados con el ancho del contenido. */
export function Skeleton({
  lines = 3,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`grid gap-3 ${className}`.trim()}
    >
      {Array.from({ length: lines }, (_, i) => (
        <span
          key={i}
          className="block h-4 animate-pulse rounded-sm bg-border"
          style={{ width: `${100 - (i % 3) * 18}%` }}
        />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}
