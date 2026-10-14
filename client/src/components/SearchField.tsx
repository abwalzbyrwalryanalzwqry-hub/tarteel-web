import { Search, X } from "lucide-react";

/** حقل بحث موحد مع زر مسح بنقرة واحدة. */
export function SearchField({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            onChange("");
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="search"
        className="tarteel-input pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="مسح البحث"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** شرائح تصفية أفقية (الحلقة، الحالة…): نقرة واحدة بدل قائمة منسدلة. */
export function FilterChips<T extends string | number>({
  options,
  value,
  onChange,
  allLabel = "الكل",
}: {
  options: { value: T; label: string; count?: number }[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  allLabel?: string;
}) {
  if (options.length < 2) return null;
  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-background/70 text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={value === undefined}
        onClick={() => onChange(undefined)}
        className={chip(value === undefined)}
      >
        {allLabel}
      </button>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() =>
            onChange(value === option.value ? undefined : option.value)
          }
          className={chip(value === option.value)}
        >
          {option.label}
          {option.count != null && (
            <span className="mr-1.5 text-xs opacity-75">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
