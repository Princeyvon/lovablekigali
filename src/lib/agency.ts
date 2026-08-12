export const money = (n: number | null | undefined) =>
  `$${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const shortMoney = (n: number | null | undefined) => {
  const v = Number(n ?? 0);
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
};

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function daysUntil(date: string | null | undefined) {
  if (!date) return null;
  const ms = new Date(date).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

export type PaymentRow = {
  client_id: string;
  amount: number;
  payment_date: string;
  months_covered: number;
  covers_period_start: string;
  covers_period_end: string;
};

/** Paid-through = latest covered period end, not "last payment + 30 days". */
export function paidThrough(payments: Pick<PaymentRow, "covers_period_end">[]) {
  if (!payments.length) return null;
  return payments
    .map((p) => p.covers_period_end)
    .sort()
    .at(-1)!;
}

export function startOfWeek(d: Date) {
  const c = new Date(d);
  const day = (c.getDay() + 6) % 7;
  c.setDate(c.getDate() - day);
  c.setHours(0, 0, 0, 0);
  return c;
}

export const REMINDER_WINDOW_DAYS = 5;
export const ROTATION_STALE_DAYS = 365;
