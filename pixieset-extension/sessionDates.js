// SoloXSnaps → PixiSet Autofill: session dates. Every way a client writes a
// date becomes one calendar day, shown as "July 24th, 2026".

// ── DATE FORMATTING ──────────────────────────────────────────────────────────
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

// ── DATE PARSER (mirrors lib/extension/sessionDates.ts parseLooseDate) ───────
// Content scripts cannot import TypeScript, so this is the same parser in
// plain JS. tests/unit/extensionSessionDates.test.ts runs both on the same cases.
const BUSINESS_TIME_ZONE = "America/Los_Angeles";
const SHORT_DATE_CHARS = 14;
const LEAP_SEARCH_YEARS = 8;
const pad2 = n => String(n).padStart(2, "0");

// The calendar date of an instant in the business timezone: "2026-11-13".
function businessDate(at = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

function isCalendarDate(year, month, day) {
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

function monthOf(word) {
  const w = word.toLowerCase();
  if (w.length < 3) return null;
  const idx = MONTH_NAMES.findIndex(m => m.toLowerCase().startsWith(w) || (w === "sept" && m === "September"));
  return idx >= 0 ? idx + 1 : null;
}

// Named dates in the text, day-first ("29th Nov") or month-first
// ("Nov 29"). A number before lowercase "may" in a sentence is usually
// followed by the verb ("June 3 may work"), not the month.
function namedDateParts(text) {
  const isMonthAfterDay = word => word !== "may" || text.length <= SHORT_DATE_CHARS;
  const found = [];
  for (const m of text.matchAll(/(?<!\d)(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]{3,9})\b\.?(?:,?\s*(\d{4})(?!\d))?/g)) {
    const month = monthOf(m[2]);
    if (month && isMonthAfterDay(m[2])) found.push({ year: m[3] ? +m[3] : null, month, day: +m[1], at: m.index });
  }
  for (const m of text.matchAll(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?!\d)(?:st|nd|rd|th)?(?:,?\s*(\d{4})(?!\d))?/g)) {
    const month = monthOf(m[1]);
    if (month) found.push({ year: m[3] ? +m[3] : null, month, day: +m[2], at: m.index });
  }
  return found;
}

// Numeric month/day dates: never a time ("4/5pm", "6:30/7"), a fraction
// ("3/4 of us", "1/2 hour") or a pair that cannot be a month and a day ("24/7").
function numericDateParts(text) {
  return [...text.matchAll(/(?<![\d/:.$])(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?(?![\d/]|\s*(?:[ap]\.?m\b|of\b|hours?\b|hrs?\b))/g)]
    .map(m => ({ year: m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null, month: +m[1], day: +m[2], at: m.index }))
    .filter(found => found.month >= 1 && found.month <= 12 && found.day >= 1 && found.day <= 31);
}

// An ISO date when there is one (anywhere in the text), else the first date
// written, numeric or named.
function dateParts(text) {
  const iso = /(?<![\d-])(\d{4})-(\d{1,2})-(\d{1,2})(?![\d-])/.exec(text);
  if (iso) return { year: +iso[1], month: +iso[2], day: +iso[3] };
  return [...numericDateParts(text), ...namedDateParts(text)].sort((a, b) => a.at - b.at)[0] || null;
}

// "July 24th" / "29th Nov" / "7/24" / "2026-07-24" → "2026-07-24", or null
// when the text names no real calendar date. A missing year is the first
// occurrence on or after `reference` (a business-local "YYYY-MM-DD", default
// today in the business timezone); an explicit year is kept as written.
function parseSessionDate(raw, reference) {
  if (!raw) return null;
  const parts = dateParts(String(raw).trim());
  if (!parts) return null;
  const ref = /^\d{4}-\d{2}-\d{2}$/.test(reference || "") ? reference : businessDate();
  let year = parts.year;
  if (year == null) {
    const start = +ref.slice(0, 4);
    for (let y = start; y <= start + LEAP_SEARCH_YEARS && year == null; y++) {
      if (isCalendarDate(y, parts.month, parts.day) && `${y}-${pad2(parts.month)}-${pad2(parts.day)}` >= ref) year = y;
    }
  }
  if (year == null || !isCalendarDate(year, parts.month, parts.day)) return null;
  return `${year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

// Any of those forms → "July 24th, 2026" for the contract, or null.
function formatSessionDate(raw, reference) {
  const iso = parseSessionDate(raw, reference);
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${ordinal(day)}, ${year}`;
}

