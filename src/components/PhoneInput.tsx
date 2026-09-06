import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type Country = { code: string; name: string; dial: string; flag: string };

/** Focused list: East/Central Africa first, then the countries we deal with most. */
export const COUNTRIES: readonly Country[] = [
  { code: "RW", name: "Rwanda", dial: "+250", flag: "🇷🇼" },
  { code: "KE", name: "Kenya", dial: "+254", flag: "🇰🇪" },
  { code: "UG", name: "Uganda", dial: "+256", flag: "🇺🇬" },
  { code: "TZ", name: "Tanzania", dial: "+255", flag: "🇹🇿" },
  { code: "BI", name: "Burundi", dial: "+257", flag: "🇧🇮" },
  { code: "CD", name: "DR Congo", dial: "+243", flag: "🇨🇩" },
  { code: "ET", name: "Ethiopia", dial: "+251", flag: "🇪🇹" },
  { code: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦" },
  { code: "NG", name: "Nigeria", dial: "+234", flag: "🇳🇬" },
  { code: "GH", name: "Ghana", dial: "+233", flag: "🇬🇭" },
  { code: "EG", name: "Egypt", dial: "+20", flag: "🇪🇬" },
  { code: "MA", name: "Morocco", dial: "+212", flag: "🇲🇦" },
  { code: "QA", name: "Qatar", dial: "+974", flag: "🇶🇦" },
  { code: "AE", name: "United Arab Emirates", dial: "+971", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { code: "TR", name: "Türkiye", dial: "+90", flag: "🇹🇷" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { code: "IE", name: "Ireland", dial: "+353", flag: "🇮🇪" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { code: "BE", name: "Belgium", dial: "+32", flag: "🇧🇪" },
  { code: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { code: "NL", name: "Netherlands", dial: "+31", flag: "🇳🇱" },
  { code: "ES", name: "Spain", dial: "+34", flag: "🇪🇸" },
  { code: "IT", name: "Italy", dial: "+39", flag: "🇮🇹" },
  { code: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹" },
  { code: "SE", name: "Sweden", dial: "+46", flag: "🇸🇪" },
  { code: "NO", name: "Norway", dial: "+47", flag: "🇳🇴" },
  { code: "CH", name: "Switzerland", dial: "+41", flag: "🇨🇭" },
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { code: "BR", name: "Brazil", dial: "+55", flag: "🇧🇷" },
  { code: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { code: "PK", name: "Pakistan", dial: "+92", flag: "🇵🇰" },
  { code: "CN", name: "China", dial: "+86", flag: "🇨🇳" },
  { code: "JP", name: "Japan", dial: "+81", flag: "🇯🇵" },
  { code: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬" },
  { code: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
] as const;

const DEFAULT = COUNTRIES[0]!;

function split(value: string) {
  const v = (value ?? "").trim();
  const match = [...COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => v.startsWith(c.dial));
  if (match) return { country: match, rest: v.slice(match.dial.length).trim() };
  return { country: DEFAULT, rest: v.replace(/^\+/, "") };
}

/** Phone field with a standard country-code dropdown. Stores "+250 788123456". */
export function PhoneInput({
  value,
  onChange,
  placeholder = "788 123 456",
  className,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const { country, rest } = split(value);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return COUNTRIES;
    return COUNTRIES.filter((c) => `${c.name} ${c.dial} ${c.code}`.toLowerCase().includes(s));
  }, [q]);

  const emit = (dial: string, number: string) => onChange(number ? `${dial} ${number}`.trim() : dial);

  return (
    <div ref={ref} className={cn("relative flex", className)}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setQ("");
        }}
        aria-label="Country code"
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-l-md border border-r-0 border-input bg-secondary/60 px-2.5 text-sm font-medium hover:bg-secondary"
      >
        <span className="text-base leading-none">{country.flag}</span>
        <span className="numeric">{country.dial}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        value={rest}
        placeholder={placeholder}
        onChange={(e) => emit(country.dial, e.target.value.replace(/[^\d\s-]/g, ""))}
        className="h-9 w-full min-w-0 rounded-r-md border border-input bg-background px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/40"
      />

      {open ? (
        <div className="absolute left-0 top-11 z-50 w-72 overflow-hidden rounded-md border border-border bg-popover shadow-[var(--shadow-soft)]">
          <div className="relative border-b border-border">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search country…"
              className="h-9 w-full bg-transparent pl-9 pr-3 text-sm outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {list.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  emit(c.dial, rest);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm hover:bg-secondary"
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="numeric text-xs text-muted-foreground">{c.dial}</span>
                {c.code === country.code ? <Check className="size-3.5 text-primary" /> : null}
              </button>
            ))}
            {list.length === 0 ? <p className="px-3 py-4 text-sm text-muted-foreground">No match</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
