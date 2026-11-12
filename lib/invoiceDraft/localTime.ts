// Wall-clock time in an IANA zone, without the host's zone ever leaking in.
// A "YYYY-MM-DD" here is a local calendar date, never UTC midnight.

const MINUTE_MS = 60_000;

/** Whether the string is a real calendar date (no February 30th, leap days honoured). */
export function isRealDate(iso: string | null | undefined): iso is string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return false;
  const probe = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return probe.getUTCFullYear() === +m[1] && probe.getUTCMonth() === +m[2] - 1 && probe.getUTCDate() === +m[3];
}

function partsIn(instant: Date, timeZone: string): Record<string, number> {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  return Object.fromEntries(formatter.formatToParts(instant).filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]));
}

/** The local calendar date and minutes past midnight of an instant. */
export function localDateAndMinutes(instant: Date, timeZone: string): { date: string; minutes: number } {
  const p = partsIn(instant, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, minutes: p.hour * 60 + p.minute };
}

/** Minutes the zone is ahead of UTC at that instant (PDT is -420). */
export function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const p = partsIn(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - instant.getTime()) / MINUTE_MS);
}

/** "PDT" / "PST" for the instant, read from the zone database rather than assumed. */
export function zoneAbbreviation(instant: Date, timeZone: string): string | null {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(instant).find((p) => p.type === "timeZoneName");
  return part?.value ?? null;
}

export type LocalInstant =
  | { status: "ok"; instant: Date }
  /** The clocks skipped this wall time (spring forward). */
  | { status: "nonexistent" }
  /** The clocks showed this wall time twice (fall back). */
  | { status: "ambiguous" };

/**
 * The instant a local date and time of day names. A wall time the zone
 * skipped or repeated is reported, never silently pinned to one offset.
 */
export function localToInstant(date: string, minutesOfDay: number, timeZone: string): LocalInstant {
  if (!isRealDate(date) || minutesOfDay < 0 || minutesOfDay >= 1440) return { status: "nonexistent" };
  const [y, m, d] = date.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minutesOfDay);
  const day = 24 * 60 * MINUTE_MS;
  const offsets = new Set([zoneOffsetMinutes(new Date(wall - day), timeZone), zoneOffsetMinutes(new Date(wall + day), timeZone)]);
  const matches = [...offsets]
    .map((offset) => new Date(wall - offset * MINUTE_MS))
    .filter((candidate) => {
      const local = localDateAndMinutes(candidate, timeZone);
      return local.date === date && local.minutes === minutesOfDay;
    });
  if (matches.length === 0) return { status: "nonexistent" };
  if (matches.length > 1) return { status: "ambiguous" };
  return { status: "ok", instant: matches[0] };
}

/** 1110 → "18:30". */
export function clockOf(minutesOfDay: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(minutesOfDay / 60))}:${pad(minutesOfDay % 60)}`;
}

function twelveHour(minutesOfDay: number): { text: string; meridiem: "am" | "pm" } {
  const hour24 = Math.floor(minutesOfDay / 60);
  const minute = String(minutesOfDay % 60).padStart(2, "0");
  return { text: `${hour24 % 12 || 12}:${minute}`, meridiem: hour24 < 12 ? "am" : "pm" };
}

/** 1110 → "6:30 pm". */
export function formatClock(minutesOfDay: number): string {
  const t = twelveHour(minutesOfDay);
  return `${t.text} ${t.meridiem}`;
}

/** 1110, 1170 → "6:30–7:30 pm"; a range across noon keeps both halves labelled. */
export function formatClockRange(startMinutes: number, endMinutes: number): string {
  const start = twelveHour(startMinutes);
  const end = twelveHour(endMinutes);
  return start.meridiem === end.meridiem ? `${start.text}–${end.text} ${end.meridiem}` : `${start.text} ${start.meridiem}–${end.text} ${end.meridiem}`;
}
