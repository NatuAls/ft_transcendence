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
    <div
      aria-label={label}
      className="flex gap-0 overflow-x-auto"
      role="tablist"
    >
      {items.map((item) => (
        <button
          aria-selected={activeTab === item.id}
          className="min-h-12 shrink-0 border-b-2 border-transparent px-4 text-base text-muted aria-selected:border-primary aria-selected:text-primary"
          key={item.id}
          onClick={() => onChange(item.id)}
          role="tab"
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
