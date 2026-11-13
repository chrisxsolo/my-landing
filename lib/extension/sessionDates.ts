// Loose date parsing for what clients write ("July 24th", "29th Nov", "7/24")
// and the readable form the extension shows ("July 24th, 2026").
//
// A calendar date here is always a business-local date (America/Los_Angeles):
// the host's clock and zone never decide which day or year it is. A missing
// year is resolved against an explicit reference date, normally the day the
// message was written, so rereading an old thread never moves its booking.
// pixieset-extension/sessionDates.js carries the same parser in plain JS;
// tests/unit/extensionSessionDates.test.ts runs both on the same cases.

export const BUSINESS_TIME_ZONE = "America/Los_Angeles";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Text this short is a date on its own ("may 16"), not a sentence that happens to contain one. */
const SHORT_DATE_CHARS = 14;
/** How far ahead a yearless February 29th may look for a leap year. */
const LEAP_SEARCH_YEARS = 8;

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/** "2026-07-24" → "July 24th, 2026". */
export function formatReadable(iso: string): string | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(iso);
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return null;
  return `${month} ${ordinal(Number(m[3]))}, ${m[1]}`;
}

/** The calendar date of an instant in the business timezone: "2026-11-13". */
export function businessDate(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

function isCalendarDate(year: number, month: number, day: number): boolean {
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The month a word names ("Nov", "Sept", "November"), 1-based, or null. */
function monthOf(word: string): number | null {
  const w = word.toLowerCase();
  if (w.length < 3) return null;
  const idx = MONTHS.findIndex((m) => m.toLowerCase().startsWith(w) || (w === "sept" && m === "September"));
  return idx >= 0 ? idx + 1 : null;
}

interface Parts { year: number | null; month: number; day: number }

/** Anywhere in the text, so "Saturday 5/16" and "on 2026-11-29" are read too. */
const ISO = /(?<![\d-])(\d{4})-(\d{1,2})-(\d{1,2})(?![\d-])/;
/** Month/day, never a time ("4/5pm", "6:30/7"), a fraction ("3/4 of us", "1/2 hour") or odds ("50/50"). */
const SLASH = /(?<![\d/:.$])(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?(?![\d/]|\s*(?:[ap]\.?m\b|of\b|hours?\b|hrs?\b))/g;
/** "29th Nov", "29 November 2026", "29th of Nov". */
const DAY_FIRST = /(?<!\d)(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]{3,9})\b\.?(?:,?\s*(\d{4})(?!\d))?/g;
/** "Nov 29", "November 29th, 2026", "Nov. 29". */
const MONTH_FIRST = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?!\d)(?:st|nd|rd|th)?(?:,?\s*(\d{4})(?!\d))?/g;

/** A number before lowercase "may" in a sentence is usually followed by the verb ("June 3 may work"), not the month. */
const isMonthAfterDay = (word: string, text: string) => word !== "may" || text.length <= SHORT_DATE_CHARS;

type Found = Parts & { at: number };

/** Numeric month/day dates in the text. A pair that cannot be a month and a day ("24/7") is not a date. */
function numericParts(text: string): Found[] {
  return [...text.matchAll(SLASH)]
    .map((m) => ({ year: m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null, month: +m[1], day: +m[2], at: m.index }))
    .filter((found) => found.month >= 1 && found.month <= 12 && found.day >= 1 && found.day <= 31);
}

/** Named dates in the text, whichever order they were written in. */
function namedParts(text: string): Found[] {
  const found: Found[] = [];
  for (const m of text.matchAll(DAY_FIRST)) {
    const month = monthOf(m[2]);
    if (month && isMonthAfterDay(m[2], text)) found.push({ year: m[3] ? +m[3] : null, month, day: +m[1], at: m.index });
  }
  for (const m of text.matchAll(MONTH_FIRST)) {
    const month = monthOf(m[1]);
    if (month) found.push({ year: m[3] ? +m[3] : null, month, day: +m[2], at: m.index });
  }
  return found;
}

/** An ISO date when there is one, else the first date written, numeric or named. */
function partsOf(text: string): Parts | null {
  const iso = ISO.exec(text);
  if (iso) return { year: +iso[1], month: +iso[2], day: +iso[3] };
  const [first] = [...numericParts(text), ...namedParts(text)].sort((a, b) => a.at - b.at);
  return first ? { year: first.year, month: first.month, day: first.day } : null;
}

/** The first year, from the reference date on, in which month/day exists and is not before it. */
function yearOnOrAfter(month: number, day: number, reference: string): number | null {
  const start = +reference.slice(0, 4);
  for (let year = start; year <= start + LEAP_SEARCH_YEARS; year++) {
    if (isCalendarDate(year, month, day) && `${year}-${pad(month)}-${pad(day)}` >= reference) return year;
  }
  return null;
}

/**
 * "July 24th" / "29th Nov" / "7/24" / "07/24/2026" / "2026-07-24" → ISO date,
 * or null when the text names no real calendar date. Numeric dates are
 * month-first. A missing year resolves to the first occurrence on or after
 * `reference` (a business-local "YYYY-MM-DD", or an instant read in the
 * business timezone); an explicit year is kept as written, past or future.
 */
export function parseLooseDate(raw: string | null | undefined, reference: Date | string = new Date()): string | null {
  if (!raw) return null;
  const parts = partsOf(String(raw).trim());
  if (!parts) return null;
  const ref = typeof reference === "string" && /^\d{4}-\d{2}-\d{2}$/.test(reference)
    ? reference
    : businessDate(reference instanceof Date ? reference : new Date());
  const year = parts.year ?? yearOnOrAfter(parts.month, parts.day, ref);
  if (year === null || !isCalendarDate(year, parts.month, parts.day)) return null;
  return `${year}-${pad(parts.month)}-${pad(parts.day)}`;
}
