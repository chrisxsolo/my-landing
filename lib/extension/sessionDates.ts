// Loose date parsing for what clients write ("July 24th", "7/24") and the
// readable form the extension shows ("July 24th, 2026").

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

/**
 * "July 24th" / "7/24" / "07/24/2026" / "2026-07-24" → ISO date.
 * A missing year resolves to the next occurrence of that month and day.
 */
export function parseLooseDate(raw: string | null | undefined, now: Date = new Date()): string | null {
  if (!raw) return null;
  const text = String(raw).trim();
  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;

  const iso   = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(text);
  const named = /([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/.exec(text);

  if (iso) {
    year = +iso[1]; month = +iso[2]; day = +iso[3];
  } else if (slash) {
    month = +slash[1]; day = +slash[2];
    year = slash[3] ? (+slash[3] < 100 ? 2000 + +slash[3] : +slash[3]) : null;
  } else if (named) {
    const idx = MONTHS.findIndex(m => m.toLowerCase().startsWith(named[1].toLowerCase()));
    if (idx >= 0) {
      month = idx + 1; day = +named[2];
      year = named[3] ? +named[3] : null;
    }
  }

  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;

  if (year == null) {
    year = now.getFullYear();
    const candidate = new Date(year, month - 1, day);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (candidate < today) year += 1;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
