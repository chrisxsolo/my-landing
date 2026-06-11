// Centralized currency / date / percentage formatting for the Revenue dashboard.
// Every component formats numbers through here so the ledger, charts and KPIs
// can never disagree about rounding.

export function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function fmtMoneyPrecise(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = new Date(dateOnly ? `${value}T12:00:00` : value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/** "+12.4%" / "−8.1%" with a true minus sign. */
export function fmtPct(ratio: number): string {
  const pct = ratio * 100;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${Math.abs(pct).toFixed(Math.abs(pct) >= 10 ? 0 : 1)}%`;
}

/** Share of a total as "42%" (no sign). */
export function fmtShare(ratio: number): string {
  if (!Number.isFinite(ratio)) return "0%";
  return `${Math.round(ratio * 100)}%`;
}
