export type PaymentSyncMonth = {
  year: number;
  month: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function parsePaymentSyncMonth(input: unknown): PaymentSyncMonth | null {
  if (!input || typeof input !== "object") return null;
  const value = input as { year?: unknown; month?: unknown };
  if (typeof value.year !== "number" || typeof value.month !== "number") return null;
  if (!Number.isInteger(value.year) || !Number.isInteger(value.month)) return null;
  if (value.year < 2000 || value.year > 2100) return null;
  if (value.month < 1 || value.month > 12) return null;
  return { year: value.year, month: value.month };
}

export function buildGmailMonthFilter(year: number, month: number): string {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const startPart = `${start.getFullYear()}/${pad2(start.getMonth() + 1)}/${pad2(start.getDate())}`;
  const endPart = `${end.getFullYear()}/${pad2(end.getMonth() + 1)}/${pad2(end.getDate())}`;
  return `after:${startPart} before:${endPart}`;
}

export function withGmailMonthFilter(query: string, month: PaymentSyncMonth | null): string {
  if (!month) return query;
  return `${query} ${buildGmailMonthFilter(month.year, month.month)}`;
}
