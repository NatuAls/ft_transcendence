export interface TabItem<T extends string> {
  id: T;
  label: string;
}

export interface TabsProps<T extends string> {
  activeTab: T;
  items: readonly TabItem<T>[];
  label: string;
  onChange: (tab: T) => void;
}

export function Tabs<T extends string>({
  activeTab,
  items,
  label,
  onChange,
}: TabsProps<T>) {
  return (
    <div aria-label={label} className="flex gap-0 overflow-x-auto" role="group">
      {items.map((item) => (
        <button
          aria-pressed={activeTab === item.id}
          className="min-h-12 shrink-0 border-b-2 border-transparent px-4 text-base text-muted aria-pressed:border-primary aria-pressed:text-primary"
          key={item.id}
          onClick={() => onChange(item.id)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
