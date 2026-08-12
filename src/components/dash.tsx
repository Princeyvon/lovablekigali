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
    <section className={cn("surface-card p-5", className)}>
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 className="text-base font-semibold">{title}</h2> : <span />}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

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
  tone?: "leaf" | "mist" | "deep";
  icon?: ReactNode;
}) {
  return (
    <div className="surface-card relative overflow-hidden p-5">
      <div
        className={cn(
          "absolute -right-10 -top-10 size-28 rounded-full blur-2xl opacity-70",
          tone === "leaf" && "gradient-leaf",
          tone === "mist" && "gradient-mist",
          tone === "deep" && "bg-[var(--leaf-deep)]",
        )}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {icon ? (
          <span className="gradient-leaf flex size-10 items-center justify-center rounded-xl text-primary-foreground">
            {icon}
          </span>
        ) : null}
      </div>
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

export function TH({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th className={cn("px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground", className)}>
      {children}
    </th>
  );
}

export function TD({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 text-sm", className)}>{children}</td>;
}

export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
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
