// Sunset for the session's own local date, for the invoice's golden-hour
// booking window. Two sources, each named truthfully to the reviewer:
//
//   1. The US Naval Observatory's published ephemeris, looked up live. Only
//      the date and coordinates are sent: never a name, email or thread.
//   2. The repository's solar calculator, when the lookup fails. It is
//      labelled "calculated sunset" and is validated against USNO values in
//      tests/unit/invoiceSunset.test.ts to within CALCULATED_TOLERANCE_MINUTES.
//
// A sunset a model remembered or wrote is never accepted here.

import { SF_COORDS, SF_TIME_ZONE, computeSunsetUtc } from "../ai/goldenHour";
import { isRealDate, localDateAndMinutes, localToInstant, zoneOffsetMinutes } from "./localTime";

const USNO_ENDPOINT = "https://aa.usno.navy.mil/api/rstt/oneday";
const LOOKUP_TIMEOUT_MS = 4_000;
const MINUTE_MS = 60_000;
/** How far the calculator may sit from the published minute (see the validation test). */
export const CALCULATED_TOLERANCE_MINUTES = 2;

export const USNO_SOURCE = "US Naval Observatory";
export const CALCULATED_SOURCE = `calculated sunset (NOAA solar equations, ±${CALCULATED_TOLERANCE_MINUTES} min)`;

/** The only locality the invoice resolves sunset for; any other shoot location needs a person. */
export const SF_LOCALITY = { name: "San Francisco", ...SF_COORDS, timeZone: SF_TIME_ZONE } as const;
export type SunsetLocality = { name: string; latitude: number; longitude: number; timeZone: string };

export type SunsetResolution =
  | { status: "resolved"; date: string; locality: string; latitude: number; longitude: number; timeZone: string; sunsetUtc: string; source: string }
  | { status: "failed"; date: string; reason: string };

export type SunsetFetch = (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/** A published sunset further than this from the calculation is not believed. */
const PUBLISHED_MAX_DRIFT_MINUTES = 5;
const CACHE_LIMIT = 400;
const sunsetCache = new Map<string, SunsetResolution>();

const resolved = (date: string, where: SunsetLocality, instant: Date, source: string): SunsetResolution => ({
  status: "resolved", date, locality: where.name, latitude: where.latitude, longitude: where.longitude,
  timeZone: where.timeZone, sunsetUtc: new Date(Math.round(instant.getTime() / MINUTE_MS) * MINUTE_MS).toISOString(), source,
});

/**
 * Whether a resolution may be used for this date and place: the same local
 * calendar date, the same zone, and a finite instant that falls in the
 * afternoon or evening of that local day.
 */
export function usableSunset(sunset: SunsetResolution | null | undefined, date: string, where: SunsetLocality = SF_LOCALITY): sunset is Extract<SunsetResolution, { status: "resolved" }> {
  if (!sunset || sunset.status !== "resolved") return false;
  const instant = new Date(sunset.sunsetUtc);
  if (!Number.isFinite(instant.getTime())) return false;
  if (sunset.date !== date || sunset.timeZone !== where.timeZone || sunset.locality !== where.name) return false;
  if (Math.abs(sunset.latitude - where.latitude) > 0.01 || Math.abs(sunset.longitude - where.longitude) > 0.01) return false;
  const local = localDateAndMinutes(instant, where.timeZone);
  return local.date === date && local.minutes >= 15 * 60;
}

/** The fallback: the validated solar calculator, labelled as a calculation. */
export function calculatedSunset(date: string, where: SunsetLocality = SF_LOCALITY): SunsetResolution {
  const instant = isRealDate(date) ? computeSunsetUtc(date, where.latitude, where.longitude) : null;
  if (!instant) return { status: "failed", date, reason: "the sunset could not be calculated for that date" };
  const sunset = resolved(date, where, instant, CALCULATED_SOURCE);
  return usableSunset(sunset, date, where) ? sunset : { status: "failed", date, reason: "the calculated sunset did not fall on the session date" };
}

const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? value as Record<string, unknown> : {});

/** Reads USNO's answer, accepting it only when it is for the date, place and offset asked. */
export function parseUsnoSunset(body: unknown, date: string, where: SunsetLocality, offsetHours: number): Date | null {
  const feature = record(body);
  const data = record(record(feature.properties).data);
  const [y, m, d] = date.split("-").map(Number);
  if (data.year !== y || data.month !== m || data.day !== d || data.tz !== offsetHours) return null;
  const coordinates = record(feature.geometry).coordinates;
  if (!Array.isArray(coordinates) || Math.abs(Number(coordinates[0]) - where.longitude) > 0.01 || Math.abs(Number(coordinates[1]) - where.latitude) > 0.01) return null;
  const sets = Array.isArray(data.sundata) ? data.sundata.map(record).filter((row) => row.phen === "Set") : [];
  const time = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(sets.length === 1 && typeof sets[0].time === "string" ? sets[0].time : "");
  if (!time) return null;
  const local = localToInstant(date, Number(time[1]) * 60 + Number(time[2]), where.timeZone);
  return local.status === "ok" ? local.instant : null;
}

/** Whether a published instant sits where the calculation says sunset should be. */
function agreesWithCalculation(instant: Date, date: string, where: SunsetLocality): boolean {
  const calculated = computeSunsetUtc(date, where.latitude, where.longitude);
  return calculated !== null && Math.abs(instant.getTime() - calculated.getTime()) <= PUBLISHED_MAX_DRIFT_MINUTES * MINUTE_MS;
}

async function lookupUsno(date: string, where: SunsetLocality, fetcher: SunsetFetch): Promise<SunsetResolution | null> {
  const noon = localToInstant(date, 12 * 60, where.timeZone);
  if (noon.status !== "ok") return null;
  const offsetHours = zoneOffsetMinutes(noon.instant, where.timeZone) / 60;
  const url = `${USNO_ENDPOINT}?date=${date}&coords=${where.latitude},${where.longitude}&tz=${offsetHours}`;
  try {
    const response = await fetcher(url, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    const instant = response.ok ? parseUsnoSunset(await response.json(), date, where, offsetHours) : null;
    const sunset = instant && agreesWithCalculation(instant, date, where) ? resolved(date, where, instant, USNO_SOURCE) : null;
    if (sunset && usableSunset(sunset, date, where)) return sunset;
    console.error(`Invoice sunset lookup for ${date} gave no usable answer; falling back to the calculated sunset.`);
    return null;
  } catch (err) {
    console.error("Invoice sunset lookup failed; falling back to the calculated sunset:", err);
    return null;
  }
}

/**
 * Sunset for a local calendar date in San Francisco. The published value
 * when the lookup answers in time, else the validated calculation. Results
 * are cached by date, place and source; they hold nothing about a client.
 */
export async function resolveSunset(date: string | null, where: SunsetLocality = SF_LOCALITY, fetcher: SunsetFetch = fetch): Promise<SunsetResolution | null> {
  if (!date) return null;
  if (!isRealDate(date)) return { status: "failed", date, reason: "the session date is not a real calendar date" };
  const key = `${date}|${where.name}|${where.timeZone}`;
  const cached = sunsetCache.get(key);
  if (cached) return cached;
  const published = await lookupUsno(date, where, fetcher);
  if (published) {
    if (sunsetCache.size >= CACHE_LIMIT) sunsetCache.clear();
    sunsetCache.set(key, published);
  }
  return published ?? calculatedSunset(date, where);
}

/** For tests: forget every cached lookup. */
export function clearSunsetCache(): void {
  sunsetCache.clear();
}
