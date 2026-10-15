/** Parse a positive dollar amount without silently dropping signs or text. */
export function parsePositivePaymentCents(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const amount = value.trim();
  if (!/^\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(amount)) return null;
  const [dollars, fraction = ""] = amount.replace(/[$,]/g, "").split(".");
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}
