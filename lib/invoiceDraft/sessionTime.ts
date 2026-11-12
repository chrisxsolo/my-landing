// The invoice's session time and where it came from. An agreed clock time is
// kept exactly; a generic golden-hour request becomes a concrete booking
// window worked out from sunset; anything short of that stays unresolved
// with a reason. This policy is the invoice's own: the email assistant's
// recommendation (lib/ai/goldenHour.ts buildGoldenHourWindow) is separate.

import { clockOf, formatClock, formatClockRange, isRealDate, localDateAndMinutes, localToInstant, zoneAbbreviation } from "./localTime";
import { SF_LOCALITY, usableSunset, type SunsetResolution } from "./sunset";
import type { InvoiceDraft, InvoiceTimeDetail, TimeStatus } from "./types";

const MINUTE_MS = 60_000;
const QUARTER_MS = 15 * MINUTE_MS;
/** Aim to start this long before sunset. */
export const GOLDEN_START_BEFORE_SUNSET_MINUTES = 90;
/** The session must be over at least this long before sunset. */
export const GOLDEN_END_BUFFER_MINUTES = 15;
/** Session lengths the golden-hour window is worked out for. */
export const GOLDEN_SUPPORTED_MINUTES: readonly number[] = [30, 60, 90, 120];

export const GOLDEN_HOUR_HEADLINE = "Golden hour requested — time needs confirmation";

/**
 * The booking window for a golden-hour session: start 90 minutes before
 * sunset on the nearest quarter hour (an exact tie goes earlier), run the
 * full length, and finish at least 15 minutes before sunset. When that
 * finish is too late the start moves back to the latest quarter hour that
 * fits; the length is never shortened.
 */
export function goldenHourWindow(sunset: Date, durationMinutes: number): { start: Date; end: Date } | null {
  const sunsetMs = sunset.getTime();
  if (!Number.isFinite(sunsetMs) || !GOLDEN_SUPPORTED_MINUTES.includes(durationMinutes)) return null;
  const durationMs = durationMinutes * MINUTE_MS;
  const latestEnd = sunsetMs - GOLDEN_END_BUFFER_MINUTES * MINUTE_MS;
  const quarters = (sunsetMs - GOLDEN_START_BEFORE_SUNSET_MINUTES * MINUTE_MS) / QUARTER_MS;
  const below = Math.floor(quarters);
  let startMs = (quarters - below > 0.5 ? below + 1 : below) * QUARTER_MS;
  if (startMs + durationMs > latestEnd) startMs = Math.floor((latestEnd - durationMs) / QUARTER_MS) * QUARTER_MS;
  const endMs = startMs + durationMs;
  return endMs <= latestEnd ? { start: new Date(startMs), end: new Date(endMs) } : null;
}

export type ParsedTime =
  | { kind: "none" }
  | { kind: "golden_hour"; phrase: string }
  | { kind: "clock"; phrase: string; startMinutes: number; endMinutes: number | null }
  /** Names a clock time or golden hour, but not as one clear time ("between 5 and 6 pm", "not golden hour"). */
  | { kind: "unclear"; phrase: string }
  | { kind: "phrase"; phrase: string };

const TIME = String.raw`(\d{1,2})(?::([0-5]\d))?\s*(?:([ap])\.?m\.?)?`;
const SEPARATOR = String.raw`\s*(?:-|–|—|to|until|till)\s*`;
/** The whole phrase is one time or one range: nothing else may ride along. */
const WHOLE_TIME = new RegExp(String.raw`^(?:(?:at|from)\s+)?${TIME}(?:${SEPARATOR}${TIME})?$`, "i");
const GOLDEN_WORDS = String.raw`(?:golden[\s-]*hour|sunset)`;
/** The whole phrase is a plain golden-hour request. */
const WHOLE_GOLDEN = new RegExp(String.raw`^(?:(?:at|around|during)\s+)?${GOLDEN_WORDS}(?:\s*(?:/|,|or|and)\s*${GOLDEN_WORDS})?$`, "i");
const TIME_LIKE = new RegExp(String.raw`\d\s*(?::[0-5]\d)?\s*[ap]\.?m\b|\b\d{1,2}:[0-5]\d\b|\bnoon\b|\bmidnight\b|${GOLDEN_WORDS}`, "i");

/** Minutes past midnight for one side of a time; a bare hour needs a meridiem, "18:30" does not. */
function minutesOf(hour: string, minute: string | undefined, meridiem: string | undefined): number | null {
  const h = Number(hour);
  if (!meridiem) return minute !== undefined && h >= 13 && h <= 23 ? h * 60 + Number(minute) : null;
  if (h < 1 || h > 12) return null;
  return ((h % 12) + (meridiem.toLowerCase() === "p" ? 12 : 0)) * 60 + Number(minute);
}

function parseClock(phrase: string): { startMinutes: number; endMinutes: number | null } | null {
  const m = WHOLE_TIME.exec(phrase);
  if (!m) return null;
  if (m[4] === undefined) {
    const only = minutesOf(m[1], m[2] ?? "0", m[3]);
    return only === null ? null : { startMinutes: only, endMinutes: null };
  }
  const end = minutesOf(m[4], m[5] ?? (m[6] ? "0" : undefined), m[6]);
  if (end === null) return null;
  // "6-7 pm" shares the end's meridiem; "11-1 pm" must start in the morning.
  const same = minutesOf(m[1], m[2] ?? (m[3] || m[6] ? "0" : undefined), m[3] ?? m[6]);
  const flipped = m[3] || !m[6] ? null : minutesOf(m[1], m[2] ?? "0", m[6].toLowerCase() === "p" ? "a" : "p");
  const start = same !== null && same < end ? same : flipped;
  return start !== null && start < end ? { startMinutes: start, endMinutes: end } : null;
}

/**
 * Reads the thread's time. Only a phrase that is wholly one clock time, one
 * range, or a plain golden-hour request is taken at its word; anything else
 * that mentions a time or golden hour is "unclear" and goes to a person.
 */
export function parseSessionTime(raw: string | null | undefined): ParsedTime {
  const phrase = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!phrase) return { kind: "none" };
  const clock = parseClock(phrase);
  if (clock) return { kind: "clock", phrase, ...clock };
  if (WHOLE_GOLDEN.test(phrase)) return { kind: "golden_hour", phrase };
  return TIME_LIKE.test(phrase) ? { kind: "unclear", phrase } : { kind: "phrase", phrase };
}

export interface SessionTimeInput {
  time: string | null;
  timeStatus: TimeStatus | null;
  date: string | null;
  dateConfidence: InvoiceDraft["session"]["dateConfidence"];
  location: string | null;
  locationSource: InvoiceDraft["session"]["locationSource"];
  travelKind: InvoiceDraft["pricing"]["travel"]["kind"];
  durationMinutes: number | null;
  /** Sunset for `date` in San Francisco, looked up before the draft is built. */
  sunset: SunsetResolution | null;
}

export interface ResolvedSessionTime {
  time: string | null;
  detail: InvoiceTimeDetail;
  reviewReasons: string[];
  warnings: string[];
}

const EMPTY_DETAIL: InvoiceTimeDetail = {
  status: "none", requested: null, start: null, end: null, endDerived: false, startUtc: null, endUtc: null,
  timeZone: null, zoneAbbreviation: null, sourceLabel: "No time in the thread", sunset: null, unresolvedReason: null,
};

function unresolved(phrase: string, headline: string, reason: string): ResolvedSessionTime {
  return {
    time: null,
    detail: { ...EMPTY_DETAIL, status: "unresolved", requested: phrase, sourceLabel: headline, unresolvedReason: reason },
    reviewReasons: [`${headline}: ${reason}`],
    warnings: [],
  };
}

function sunsetDetail(sunset: Extract<SunsetResolution, { status: "resolved" }>): NonNullable<InvoiceTimeDetail["sunset"]> {
  const instant = new Date(sunset.sunsetUtc);
  return { local: formatClock(localDateAndMinutes(instant, sunset.timeZone).minutes), utc: instant.toISOString(), source: sunset.source, locality: sunset.locality };
}

/** Why a golden-hour request cannot be turned into a time yet, or null when it can. */
function goldenHourBlocker(input: SessionTimeInput): string | null {
  if (input.timeStatus === "conflicting") return "the thread still has more than one time on the table.";
  if (!input.date) return "no session date is known.";
  if (!isRealDate(input.date)) return `${input.date} is not a real calendar date.`;
  if (input.dateConfidence !== "confirmed") return "the session date is not confirmed in email.";
  if (!input.location || input.locationSource === "unknown") return "the shoot location is not known.";
  if (input.locationSource === "school") return "the shoot location is only assumed from the school.";
  if (input.travelKind !== "included") return `sunset is only worked out for San Francisco shoots, and ${input.location} is not confirmed to be one.`;
  if (input.durationMinutes === null) return "the session length is not settled.";
  if (!GOLDEN_SUPPORTED_MINUTES.includes(input.durationMinutes)) return `a ${input.durationMinutes}-minute session has no golden-hour window on file.`;
  if (!input.sunset) return "the sunset lookup did not run. Reload the draft to retry, or set the time by hand.";
  if (input.sunset.status === "failed") return `${input.sunset.reason}. Reload the draft to retry, or set the time by hand.`;
  if (!usableSunset(input.sunset, input.date)) return "the sunset lookup returned a time for a different date or place. Reload the draft to retry, or set the time by hand.";
  return null;
}

function resolveGoldenHour(phrase: string, input: SessionTimeInput): ResolvedSessionTime {
  const blocker = goldenHourBlocker(input);
  if (blocker) return unresolved(phrase, GOLDEN_HOUR_HEADLINE, blocker);
  const sunset = input.sunset as Extract<SunsetResolution, { status: "resolved" }>;
  const zone = sunset.timeZone;
  const window = goldenHourWindow(new Date(sunset.sunsetUtc), input.durationMinutes as number);
  const start = window && localDateAndMinutes(window.start, zone);
  const end = window && localDateAndMinutes(window.end, zone);
  if (!window || !start || !end || start.date !== input.date || end.date !== input.date) {
    return unresolved(phrase, GOLDEN_HOUR_HEADLINE, "no booking window fits before sunset on the session date.");
  }
  return {
    time: formatClockRange(start.minutes, end.minutes),
    detail: {
      status: "calculated", requested: phrase, start: clockOf(start.minutes), end: clockOf(end.minutes), endDerived: false,
      startUtc: window.start.toISOString(), endUtc: window.end.toISOString(), timeZone: zone,
      zoneAbbreviation: zoneAbbreviation(window.start, zone), sourceLabel: "Calculated from sunset",
      sunset: sunsetDetail(sunset), unresolvedReason: null,
    },
    reviewReasons: [], warnings: [],
  };
}

const CLOCK_HEADLINE = "Session time needs confirmation";

/** Warns when an agreed clock time runs past the golden-hour buffer; never moves it. */
function sunsetMarginWarning(display: string, end: Date | null, input: SessionTimeInput): string | null {
  if (!end || !input.date || input.travelKind !== "included" || !usableSunset(input.sunset, input.date)) return null;
  const sunset = sunsetDetail(input.sunset);
  const margin = Math.round((new Date(sunset.utc).getTime() - end.getTime()) / MINUTE_MS);
  if (margin >= GOLDEN_END_BUFFER_MINUTES) return null;
  const where = margin >= 0 ? `${margin} minutes before` : `${-margin} minutes after`;
  return `The ${display} session ends ${where} sunset (${sunset.local}, ${sunset.source}). The time is kept as agreed.`;
}

function resolveClock(parsed: Extract<ParsedTime, { kind: "clock" }>, input: SessionTimeInput): ResolvedSessionTime {
  if (input.timeStatus === "conflicting") return unresolved(parsed.phrase, CLOCK_HEADLINE, `the thread still has more than one time on the table (latest: ${parsed.phrase}).`);
  const confirmed = input.timeStatus === "confirmed";
  const derived = parsed.endMinutes === null && input.durationMinutes !== null && parsed.startMinutes + input.durationMinutes < 1440;
  const endMinutes = parsed.endMinutes ?? (derived ? parsed.startMinutes + (input.durationMinutes as number) : null);
  const display = endMinutes === null ? formatClock(parsed.startMinutes) : formatClockRange(parsed.startMinutes, endMinutes);
  const zone = input.date && isRealDate(input.date) && (input.travelKind === "included" || input.travelKind === "verified") ? SF_LOCALITY.timeZone : null;
  const startAt = zone ? localToInstant(input.date as string, parsed.startMinutes, zone) : null;
  const endAt = zone && endMinutes !== null ? localToInstant(input.date as string, endMinutes, zone) : null;
  if ((startAt && startAt.status !== "ok") || (endAt && endAt.status !== "ok")) {
    return unresolved(parsed.phrase, CLOCK_HEADLINE, `${display} falls in a daylight-saving change on ${input.date}, so the clock time is ambiguous.`);
  }
  const start = startAt?.status === "ok" ? startAt.instant : null;
  const end = endAt?.status === "ok" ? endAt.instant : null;
  const mismatch = confirmed && parsed.endMinutes !== null && input.durationMinutes !== null && parsed.endMinutes - parsed.startMinutes !== input.durationMinutes;
  const margin = sunsetMarginWarning(display, end, input);
  return {
    time: display,
    detail: {
      status: confirmed ? "confirmed" : "proposed", requested: parsed.phrase, start: clockOf(parsed.startMinutes),
      end: endMinutes === null ? null : clockOf(endMinutes), endDerived: derived,
      startUtc: start?.toISOString() ?? null, endUtc: end?.toISOString() ?? null, timeZone: zone,
      zoneAbbreviation: start && zone ? zoneAbbreviation(start, zone) : null,
      sourceLabel: `${confirmed ? "Confirmed in email" : "Proposed in email, not confirmed"}${derived ? " · end derived from the session length" : ""}`,
      sunset: null, unresolvedReason: null,
    },
    reviewReasons: mismatch ? [`The agreed time ${display} is ${(parsed.endMinutes as number) - parsed.startMinutes} minutes, but the package is ${input.durationMinutes} minutes. Confirm the time or the package before filling.`] : [],
    warnings: margin ? [margin] : [],
  };
}

/** The session time for the draft: exact when agreed, calculated for golden hour, otherwise unresolved with a reason. */
export function resolveSessionTime(input: SessionTimeInput): ResolvedSessionTime {
  const parsed = parseSessionTime(input.time);
  if (parsed.kind === "none") return { time: null, detail: EMPTY_DETAIL, reviewReasons: [], warnings: [] };
  if (parsed.kind === "golden_hour") return resolveGoldenHour(parsed.phrase, input);
  if (parsed.kind === "clock") return resolveClock(parsed, input);
  if (parsed.kind === "unclear") return unresolved(parsed.phrase, CLOCK_HEADLINE, `the thread says "${parsed.phrase}", which is not one clear time.`);
  const sourceLabel = input.timeStatus === "confirmed" ? "Confirmed in email" : "From the thread, not a clock time";
  return {
    time: parsed.phrase,
    detail: { ...EMPTY_DETAIL, status: input.timeStatus === "confirmed" ? "confirmed" : "proposed", requested: parsed.phrase, sourceLabel },
    reviewReasons: [], warnings: [],
  };
}
