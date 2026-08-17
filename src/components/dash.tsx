import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  right,
  className,
  children,
}: {
  title?: string;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("surface-card rise-in p-4 sm:p-5", className)}>
      {(title || right) && (
        <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          {title ? (
            <h2 className="min-w-0 truncate text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <div className="shrink-0">{right}</div>
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Pastel stat card — LuckyJob-style tinted surface with a hairline border.
 * Legacy tones (leaf / mist / deep) map onto the pastel palette so every
 * existing screen inherits the new look without touching each route.
 */
const TINTS = {
  leaf: "bg-[var(--tint-mint)]",
  mist: "bg-[var(--tint-peach)]",
  deep: "bg-[var(--tint-lilac)]",
  sky: "bg-[var(--tint-sky)]",
  blush: "bg-[var(--tint-blush)]",
  plain: "bg-card",
} as const;

export type StatTone = keyof typeof TINTS;

export function Stat({
  label,
  value,
  hint,
  tone = "leaf",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: StatTone;
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rise-in relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-border/70 p-4 shadow-[var(--shadow-soft)] transition-transform duration-500 ease-[var(--ease-quiet)] hover:-translate-y-0.5 sm:p-5",
        TINTS[tone],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
        {icon ? (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-card/70 text-foreground">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="numeric mt-2 break-words font-display text-xl font-semibold leading-tight sm:text-2xl">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}


export function Bars({ data }: { data: { label: string; a: number; b: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.a + d.b));
  return (
    <div className="flex h-52 items-end gap-2">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-44 w-full flex-col justify-end gap-1">
            <div
              className="gradient-bar w-full rounded-full"
              style={{ height: `${(d.a / max) * 100}%`, minHeight: d.a ? 6 : 0 }}
            />
            <div
              className="w-full rounded-full bg-[var(--leaf-deep)]"
              style={{ height: `${(d.b / max) * 100}%`, minHeight: d.b ? 6 : 0 }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ value, total, caption }: { value: number; total: number; caption: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="flex flex-col items-center">
      <div
        className="relative flex size-44 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(var(--leaf) ${pct * 3.6}deg, var(--mist) ${pct * 3.6}deg)`,
        }}
      >
        <div className="flex size-32 flex-col items-center justify-center rounded-full bg-card">
          <span className="font-display text-2xl font-semibold">{pct}%</span>
          <span className="mt-1 text-xs text-muted-foreground">{caption}</span>
        </div>
      </div>
    </div>
  );
}

export function Pill({ children, tone = "leaf" }: { children: ReactNode; tone?: "leaf" | "mist" | "warn" | "muted" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "leaf" && "bg-primary/12 text-primary",
        tone === "mist" && "bg-secondary text-secondary-foreground",
        tone === "warn" && "bg-destructive/10 text-destructive",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function TH({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-2 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:px-4",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TD({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-2 py-3 text-sm sm:px-4", className)}>{children}</td>;
}

/**
 * Tables stay inside the viewport on phones — cells wrap instead of forcing
 * a horizontal scroll. Secondary columns opt out with `hidden md:table-cell`.
 */
export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="w-full">
      <table className="w-full table-fixed border-collapse">
        <thead className="border-b border-border">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

/** Escape hatch for genuinely wide grids (kanban etc.). */
export function ScrollTable({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead className="border-b border-border">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{children}</p>;
}
