export type RevenuePeriod = "all" | "thisMonth" | "lastMonth" | "thisYear";

export type PaymentPeriod = {
  start: Date | null;
  end: Date | null;
  label: string;
};

export type PaymentPeriodRow = {
  paid_at?: string | null;
  session_date?: string | null;
  status?: string | null;
  source?: string | null;
  note?: string | null;
  amount?: string | null;
  amount_cents?: number | null;
};

function parsePaymentDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = new Date(dateOnly ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parsePaymentCents(amount: string | null | undefined): number {
  if (!amount) return 0;
  const match = amount.match(/[\d,]+(?:\.\d{1,2})?/);
  if (!match) return 0;
  return Math.round(parseFloat(match[0].replace(",", "")) * 100);
}

export function buildMonthPeriod(year: number, month: number): PaymentPeriod {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

  return {
    start,
    end,
    label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
}

export function buildRelativePeriod(period: RevenuePeriod, now = new Date()): PaymentPeriod {
  if (period === "all") return { start: null, end: null, label: "All Time" };
  if (period === "thisMonth") return buildMonthPeriod(now.getFullYear(), now.getMonth());
  if (period === "lastMonth") return buildMonthPeriod(now.getFullYear(), now.getMonth() - 1);

  return {
    start: new Date(now.getFullYear(), 0, 1),
    end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
    label: `${now.getFullYear()}`,
  };
}

export function paymentMatchesPeriod(payment: PaymentPeriodRow, period: PaymentPeriod): boolean {
  const timestamp = payment.paid_at ?? payment.session_date;
  const paidDate = parsePaymentDate(timestamp);
  if (!paidDate) return period.start === null && period.end === null;
  if (period.start && paidDate < period.start) return false;
  if (period.end && paidDate > period.end) return false;
  return true;
}

export function filterPaymentsByPeriod<T extends PaymentPeriodRow>(
  payments: T[],
  period: PaymentPeriod,
): T[] {
  return payments.filter((payment) => payment.status === "active" && paymentMatchesPeriod(payment, period));
}

export function isConfirmedRevenuePayment(payment: PaymentPeriodRow): boolean {
  if (payment.status !== "active") return false;
  const cents = payment.amount_cents ?? parsePaymentCents(payment.amount);
  if (cents <= 0) return false;
  const note = payment.note?.toLowerCase() ?? "";
  return !(payment.source === "auto" && note.includes("auto-recorded"));
}

export function filterRevenuePayments<T extends PaymentPeriodRow>(payments: T[]): T[] {
  return payments.filter(isConfirmedRevenuePayment);
}
