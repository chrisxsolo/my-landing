// Local wall time + IANA zone → UTC instant, done honestly. A wall time can
// resolve to one instant (normal), none (a DST gap: 2:30 AM on the spring-
// forward night does not exist) or two (the repeated hour on the fall-back
// night). The admin picks a date and a time to the minute; the server resolves
// it here and persists the instant plus the zone. Nothing here uses the
// machine's own timezone, so the result is the same on a laptop in Tokyo and
// on a Vercel function in Virginia. Pure, no I/O.

export const WALL_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export type Disambiguation = "earlier" | "later";

export interface WallTime {
  year: number; month: number; day: number; hour: number; minute: number;
}

export type ResolveLocalTimeResult =
  | { kind: "ok"; instant: Date; candidates: [Date] }
  | { kind: "ambiguous"; candidates: [Date, Date] }
  | { kind: "nonexistent"; candidates: [] }
  | { kind: "invalid"; reason: string };

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

/** True for a zone Intl knows (IANA names, including links such as US/Pacific). */
export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || !timeZone || timeZone.length > 64) return false;
  try {
    partsFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function parseWallTime(value: unknown): WallTime | null {
  if (typeof value !== "string") return null;
  const m = WALL_TIME_PATTERN.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  // Reject Feb 30 and friends: rebuilding the date must give the same fields.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return { year, month, day, hour, minute };
}

export function formatWallTime(w: WallTime): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${w.year}-${p(w.month)}-${p(w.day)}T${p(w.hour)}:${p(w.minute)}`;
}

/** The wall clock in `timeZone` at `instant`. */
export function wallTimeAt(instant: Date, timeZone: string): WallTime {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  // "24" never appears with hourCycle h23, but guard anyway.
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") % 24, minute: get("minute") };
}

/** The zone's UTC offset in minutes at `instant` (positive east of UTC). */
export function offsetMinutesAt(instant: Date, timeZone: string): number {
  const w = wallTimeAt(instant, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, 0);
  const truncated = Math.floor(instant.getTime() / 60_000) * 60_000;
  return Math.round((asUtc - truncated) / 60_000);
}

const sameWall = (a: WallTime, b: WallTime) =>
  a.year === b.year && a.month === b.month && a.day === b.day && a.hour === b.hour && a.minute === b.minute;

/**
 * Every instant whose wall clock in `timeZone` reads `wall`. The offsets in
 * force a day before and a day after the naive UTC guess bracket any
 * transition, so trying each gives 0, 1 or 2 distinct candidates.
 */
export function resolveLocalTime(wall: WallTime, timeZone: string): ResolveLocalTimeResult {
  if (!isValidTimeZone(timeZone)) return { kind: "invalid", reason: `unknown time zone "${String(timeZone)}"` };
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0);
  const day = 24 * 60 * 60_000;
  const offsets = new Set([
    offsetMinutesAt(new Date(guess - day), timeZone),
    offsetMinutesAt(new Date(guess), timeZone),
    offsetMinutesAt(new Date(guess + day), timeZone),
  ]);
  const candidates = [...offsets]
    .map((offset) => new Date(guess - offset * 60_000))
    .filter((candidate) => sameWall(wallTimeAt(candidate, timeZone), wall))
    .sort((a, b) => a.getTime() - b.getTime());
  const unique = candidates.filter((c, i) => i === 0 || c.getTime() !== candidates[i - 1].getTime());
  if (unique.length === 0) return { kind: "nonexistent", candidates: [] };
  if (unique.length === 1) return { kind: "ok", instant: unique[0], candidates: [unique[0]] };
  return { kind: "ambiguous", candidates: [unique[0], unique[1]] };
}

export interface ScheduleInput {
  /** "YYYY-MM-DDTHH:MM" as entered. */
  localWallTime: unknown;
  timeZone: unknown;
  /** Required only when the wall time falls in a repeated hour. */
  disambiguation?: unknown;
}

export type ScheduleInstantResult =
  | { ok: true; instant: Date; wall: WallTime; timeZone: string }
  | { ok: false; code: "invalid_time" | "invalid_zone" | "nonexistent" | "ambiguous" | "past"; message: string;
      candidates?: Date[] };

/**
 * Server-side validation of a schedule request. Past times are rejected
 * (Publish now is a separate action); a nonexistent time is an error, not a
 * silent shift; a repeated time needs an explicit choice.
 */
export function resolveScheduleInstant(input: ScheduleInput, now: Date, minLeadMs = 0): ScheduleInstantResult {
  const wall = parseWallTime(input.localWallTime);
  if (!wall) return { ok: false, code: "invalid_time", message: "Choose a date and a time (to the minute)." };
  if (!isValidTimeZone(input.timeZone)) {
    return { ok: false, code: "invalid_zone", message: `"${String(input.timeZone)}" is not a known time zone.` };
  }
  const timeZone = input.timeZone;
  const resolved = resolveLocalTime(wall, timeZone);
  if (resolved.kind === "invalid") return { ok: false, code: "invalid_zone", message: resolved.reason };
  if (resolved.kind === "nonexistent") {
    return {
      ok: false, code: "nonexistent", candidates: [],
      message: `${describeWallTime(wall)} does not exist in ${timeZone} (clocks skip forward that night). Pick another time.`,
    };
  }
  let instant: Date;
  if (resolved.kind === "ambiguous") {
    const pick = input.disambiguation;
    if (pick !== "earlier" && pick !== "later") {
      return {
        ok: false, code: "ambiguous", candidates: resolved.candidates,
        message: `${describeWallTime(wall)} happens twice in ${timeZone} that night (clocks fall back). Choose the earlier or the later one.`,
      };
    }
    instant = pick === "earlier" ? resolved.candidates[0] : resolved.candidates[1];
  } else {
    instant = resolved.instant;
  }
  if (instant.getTime() <= now.getTime() + minLeadMs) {
    return { ok: false, code: "past", message: "That time has already passed. Pick a future time, or use Publish now." };
  }
  return { ok: true, instant, wall, timeZone };
}

function describeWallTime(w: WallTime): string {
  const h12 = w.hour % 12 === 0 ? 12 : w.hour % 12;
  const ampm = w.hour < 12 ? "AM" : "PM";
  return `${h12}:${String(w.minute).padStart(2, "0")} ${ampm} on ${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

/** "November 12, 2026 at 9:00 AM — America/Los_Angeles" for an instant, in its zone. */
export function describeScheduledInstant(instant: Date, timeZone: string): string {
  const date = new Intl.DateTimeFormat("en-US", { timeZone, month: "long", day: "numeric", year: "numeric" }).format(instant);
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(instant);
  return `${date} at ${time} — ${timeZone}`;
}

/** Short form for lists: "Nov 12, 9:00 AM PST". */
export function describeScheduledInstantShort(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(instant);
}
