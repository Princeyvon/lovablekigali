import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Check, ChevronDown, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-8 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-ring/40"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-secondary"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function matches(query: string, ...fields: (string | null | undefined)[]) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(q));
}

/** Shared click-outside popover shell used by the custom dropdowns. */
function useOutside<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, close]);
  return ref;
}

export type ComboOption = { value: string; label: string; hint?: string };

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  emptyText = "No matches",
  className,
}: {
  options: ComboOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));

  const filtered = useMemo(
    () => options.filter((o) => matches(q, o.label, o.hint)).slice(0, 80),
    [options, q],
  );
  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setQ("");
        }}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm transition hover:border-primary/50"
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-md border border-border bg-card p-0 shadow-xl">
          <div className="border-b border-border p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type to search…"
              className="h-8 w-full rounded-sm border border-input bg-background px-2.5 text-sm outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  <Check className={cn("size-3.5", o.value === value ? "text-primary" : "opacity-0")} />
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.hint ? <span className="text-xs text-muted-foreground">{o.hint}</span> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Custom low-roundness dropdown replacing the native <select> filters. */
export function FilterSelect({
  value,
  onChange,
  options,
  label,
  className,
  allLabel = "All",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));
  const active = value !== "all";
  const selected = options.find((o) => o.value === value);
  const searchable = options.length > 8;
  const filtered = useMemo(
    () => (searchable ? options.filter((o) => matches(q, o.label)) : options),
    [options, q, searchable],
  );

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setQ("");
        }}
        className={cn(
          "flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition",
          active
            ? "border-primary/60 bg-primary/10 text-primary"
            : "border-input bg-background text-foreground hover:border-primary/40",
        )}
      >
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="max-w-[10rem] truncate font-medium">{selected?.label ?? allLabel}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-1.5 w-56 overflow-hidden rounded-md border border-border bg-card shadow-xl">
          {searchable ? (
            <div className="border-b border-border p-2">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Filter ${label.toLowerCase()}…`}
                className="h-8 w-full rounded-sm border border-input bg-background px-2.5 text-sm outline-none"
              />
            </div>
          ) : null}
          <div className="max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => {
                onChange("all");
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
            >
              <Check className={cn("size-3.5", value === "all" ? "text-primary" : "opacity-0")} />
              {allLabel}
            </button>
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
              >
                <Check className={cn("size-3.5", value === o.value ? "text-primary" : "opacity-0")} />
                <span className="flex-1 truncate">{o.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type DateRange = { from: string; to: string };
export const EMPTY_RANGE: DateRange = { from: "", to: "" };

export function inRange(date: string | null | undefined, range: DateRange) {
  if (!date) return !range.from && !range.to;
  const t = new Date(date).getTime();
  if (range.from && t < new Date(range.from).getTime()) return false;
  if (range.to && t > new Date(range.to).getTime() + 86_400_000 - 1) return false;
  return true;
}

const PRESETS: { label: string; days: number }[] = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 12 months", days: 365 },
];

export function DateRangeFilter({
  value,
  onChange,
  label = "Date",
  className,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));
  const active = !!(value.from || value.to);
  const summary = active ? `${value.from || "start"} → ${value.to || "today"}` : "Any time";

  const applyPreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    onChange({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
    setOpen(false);
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition",
          active
            ? "border-primary/60 bg-primary/10 text-primary"
            : "border-input bg-background text-foreground hover:border-primary/40",
        )}
      >
        <Calendar className="size-3.5 shrink-0" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="max-w-[12rem] truncate font-medium">{summary}</span>
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-1.5 w-72 rounded-md border border-border bg-card p-3 shadow-xl">
          <div className="grid gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              From
              <input
                type="date"
                value={value.from}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
                className="mt-1 h-9 w-full rounded-sm border border-input bg-background px-2.5 text-sm text-foreground outline-none"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              To
              <input
                type="date"
                value={value.to}
                onChange={(e) => onChange({ ...value, to: e.target.value })}
                className="mt-1 h-9 w-full rounded-sm border border-input bg-background px-2.5 text-sm text-foreground outline-none"
              />
            </label>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.days)}
                className="rounded-sm border border-border px-2 py-1.5 text-xs font-medium hover:bg-secondary"
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(EMPTY_RANGE);
              setOpen(false);
            }}
            className="mt-2 w-full rounded-sm bg-secondary px-2 py-1.5 text-xs font-medium hover:bg-secondary/70"
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function uniqueOptions(values: (string | null | undefined)[]) {
  return [...new Set(values.filter((v): v is string => !!v))]
    .sort((a, b) => a.localeCompare(b))
    .map((v) => ({ value: v, label: v }));
}
