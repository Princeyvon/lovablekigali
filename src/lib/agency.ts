export const CURRENCY = "RWF";

export const money = (n: number | null | undefined) =>
  `${CURRENCY} ${Math.round(Number(n ?? 0)).toLocaleString("en-US")}`;

export const shortMoney = (n: number | null | undefined) => {
  const v = Number(n ?? 0);
  if (Math.abs(v) >= 1_000_000) return `${CURRENCY} ${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `${CURRENCY} ${(v / 1000).toFixed(0)}k`;
  return `${CURRENCY} ${v.toFixed(0)}`;
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

/** An app may only be switched off 14 days after the due date. */
export const GRACE_DAYS = 14;
/** Reminders go out every 2 days while inside the grace window. */
export const REMINDER_EVERY_DAYS = 2;

export const todayISO = () => new Date().toISOString().slice(0, 10);

/** Add whole months to an ISO date (YYYY-MM-DD), clamping to end of month. */
export function addMonths(iso: string, months: number) {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

export const PAYMENT_METHODS = ["MOMO", "Bank", "Cash"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

export const REMINDER_CHANNELS = [
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
] as const;

export const SECTORS = [
  "Agriculture",
  "Automotive",
  "Aviation",
  "Beauty & Wellness",
  "Construction",
  "Consulting",
  "Education",
  "Energy",
  "Environmental",
  "Events",
  "Fashion",
  "Finance",
  "Fitness & Sports",
  "Food & Beverage",
  "Government",
  "Healthcare",
  "Hospitality",
  "Insurance",
  "Legal",
  "Logistics",
  "Manufacturing",
  "Media & Entertainment",
  "Mining",
  "Non-profit",
  "Pharmaceuticals",
  "Printing",
  "Professional Services",
  "Real Estate",
  "Religious Organisations",
  "Retail",
  "Security",
  "Technology",
  "Telecommunications",
  "Textiles",
  "Tourism",
  "Transport",
  "Veterinary",
  "Wholesale",
] as const;

export type DueState = {
  through: string | null;
  daysOverdue: number;
  overdue: boolean;
  suspendable: boolean;
  reminderDue: boolean;
};

/** Billing state derived from the latest covered period end. */
export function dueState(through: string | null, lastReminderAt?: string | null): DueState {
  if (!through) {
    return { through, daysOverdue: 0, overdue: true, suspendable: false, reminderDue: true };
  }
  const days = -(daysUntil(through) ?? 0);
  const overdue = days > 0;
  const sinceReminder = lastReminderAt
    ? Math.floor((Date.now() - new Date(lastReminderAt).getTime()) / 86400000)
    : Infinity;
  return {
    through,
    daysOverdue: Math.max(0, days),
    overdue,
    suspendable: days >= GRACE_DAYS,
    reminderDue: overdue && days < GRACE_DAYS && sinceReminder >= REMINDER_EVERY_DAYS,
  };
}
