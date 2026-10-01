import { previewIdentityOptions, type PreviewIdentity } from './session';

export function PreviewIdentitySelect({
  className = '',
  onChange,
  value,
}: {
  className?: string;
  onChange: (identity: PreviewIdentity) => void;
  value: PreviewIdentity;
}) {
  return (
    <label
      className={`grid gap-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted ${className}`.trim()}
    >
      Preview as
      <select
        aria-label="Preview identity"
        className="min-h-9 max-w-[210px] rounded-sm border border-border bg-surface px-2 text-xs normal-case tracking-normal text-ink"
        onChange={(event) => onChange(event.target.value as PreviewIdentity)}
        value={value}
      >
        {previewIdentityOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
