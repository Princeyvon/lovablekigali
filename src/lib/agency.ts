export const SECTORS = [
  "Technology",
  "Healthcare",
  "Finance",
  "Food & Beverage",
  "Legal",
  "Retail",
  "Real Estate",
  "Hospitality",
  "Tourism",
  "Education",
  "Logistics",
  "Construction",
  "Manufacturing",
  "Other",
] as const;

export const REMINDER_CHANNELS = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
] as const;

export const GRACE_DAYS = 14;

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDate(d?: string | Date | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function daysUntil(targetISO: string): number {
  if (!targetISO) return 0;
  const now = new Date();
  const target = new Date(targetISO);
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function money(n?: number | string | null): string {
  if (n === null || n === undefined || n === "") return "$0";
  const num = typeof n === "string" ? Number(n) : n;
  if (isNaN(num)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num);
}

export function shortMoney(n?: number | string | null): string {
  if (n === null || n === undefined || n === "") return "$0";
  const num = typeof n === "string" ? Number(n) : n;
  if (isNaN(num)) return "$0";
  if (Math.abs(num) >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(num) >= 1_000) {
    return `$${(num / 1_000).toFixed(0)}k`;
  }
  return `$${num.toLocaleString("en-US")}`;
}

export function paidThrough(
  payments?: Array<{ covers_period_end?: string | null } | null> | null,
): string | null {
  if (!payments || payments.length === 0) return null;
  const validDates = payments
    .map((p) => p?.covers_period_end)
    .filter((d): d is string => typeof d === "string" && d.length > 0)
    .sort();
  return validDates.length > 0 ? (validDates[validDates.length - 1] ?? null) : null;
}

export interface DueStateResult {
  through: string | null;
  overdue: boolean;
  daysOverdue: number;
  inGrace: boolean;
  suspendable: boolean;
  state: "current" | "due-soon" | "grace" | "overdue";
  canRemind: boolean;
}

export function dueState(
  through?: string | null,
  lastReminderSentAt?: string | null,
  graceDays = GRACE_DAYS,
): DueStateResult {
  if (!through) {
    return {
      through: null,
      overdue: true,
      daysOverdue: 30,
      inGrace: false,
      suspendable: true,
      state: "overdue",
      canRemind: true,
    };
  }

  const daysLeft = daysUntil(through);
  const overdue = daysLeft < 0;
  const daysOverdue = overdue ? -daysLeft : 0;
  const inGrace = overdue && daysOverdue <= graceDays;
  const suspendable = overdue && daysOverdue > graceDays;

  let state: "current" | "due-soon" | "grace" | "overdue" = "current";
  if (suspendable) {
    state = "overdue";
  } else if (inGrace) {
    state = "grace";
  } else if (daysLeft <= 5) {
    state = "due-soon";
  }

  let canRemind = overdue;
  if (overdue && lastReminderSentAt) {
    const daysSinceReminder = -daysUntil(lastReminderSentAt);
    canRemind = daysSinceReminder >= 2;
  }

  return {
    through,
    overdue,
    daysOverdue,
    inGrace,
    suspendable,
    state,
    canRemind,
  };
}
