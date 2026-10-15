// ─────────────────────────────────────────────────────────────────────────────
// Sunset and golden-hour timing.
//
// Chris recommends golden hour constantly, and the old prompt let the model
// guess the time — which is how "6:15 pm" became a hand-correction that then
// got saved as a permanent writing rule. This computes sunset from the NOAA
// solar-position equations: no API, no key, no per-call cost, and no invented
// numbers.
//
// Accurate to about a minute for the Bay Area, which is far inside the
// tolerance of "let's start around 6:30". It is sea-level geometric sunset, so
// it does not know about the hill west of the client or the fog bank offshore
// — callers surface it as a recommendation, never as a guarantee.
// ─────────────────────────────────────────────────────────────────────────────

/** Default coordinates: San Francisco. */
export const SF_COORDS = { latitude: 37.7749, longitude: -122.4194 } as const;
export const SF_TIME_ZONE = "America/Los_Angeles";

/** Official sunset zenith — 90°50', which includes refraction and the solar disc. */
const SUNSET_ZENITH_DEG = 90.833;

const DEG = Math.PI / 180;

/** Whole days from the J2000.0 epoch to the given date. */
function julianDayNumber(date: Date): number {
  const julianDate = date.getTime() / 86_400_000 + 2_440_587.5;
  return Math.round(julianDate - 2_451_545.0 + 0.0008);
}

/**
 * Mean solar time at this meridian, in days since J2000.0.
 *
 * Solar noon runs later in UTC the further west you are: l_w/360 of a day,
 * which is 0.34 days (8h10m) at San Francisco. Coordinates here are positive
 * EAST, so l_w is -longitude and the term is subtracted.
 *
 * The day number must be rounded to a whole day BEFORE this offset is added.
 * Rounding afterwards swallows the fraction and leaves every sunset computed
 * from noon UTC instead of local solar noon.
 */
function meanSolarTime(date: Date, longitude: number): number {
  return julianDayNumber(date) - longitude / 360;
}

/**
 * UTC instant of sunset for a date and place, or null above the Arctic/
 * Antarctic circles where the sun does not set that day.
 */
export function computeSunsetUtc(
  dateStr: string,
  latitude: number = SF_COORDS.latitude,
  longitude: number = SF_COORDS.longitude,
): Date | null {
  const noonUtc = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(noonUtc.getTime())) return null;

  const solarTime = meanSolarTime(noonUtc, longitude);

  // Mean solar anomaly, then the true ecliptic longitude via the centre equation.
  const meanAnomaly = (357.5291 + 0.98560028 * solarTime) % 360;
  const center =
    1.9148 * Math.sin(meanAnomaly * DEG) +
    0.02 * Math.sin(2 * meanAnomaly * DEG) +
    0.0003 * Math.sin(3 * meanAnomaly * DEG);
  const eclipticLongitude = (meanAnomaly + center + 180 + 102.9372) % 360;

  // Solar transit (local solar noon) as a Julian date.
  const transit =
    2_451_545.0 + solarTime +
    0.0053 * Math.sin(meanAnomaly * DEG) -
    0.0069 * Math.sin(2 * eclipticLongitude * DEG);

  const declination = Math.asin(
    Math.sin(eclipticLongitude * DEG) * Math.sin(23.4397 * DEG),
  );

  const cosHourAngle =
    (Math.cos(SUNSET_ZENITH_DEG * DEG) -
      Math.sin(latitude * DEG) * Math.sin(declination)) /
    (Math.cos(latitude * DEG) * Math.cos(declination));

  // |cos| > 1 means midnight sun or polar night. Never happens in the Bay Area,
  // but returning null beats returning a NaN date.
  if (cosHourAngle > 1 || cosHourAngle < -1) return null;

  const hourAngleDeg = Math.acos(cosHourAngle) / DEG;
  const sunsetJulian = transit + hourAngleDeg / 360;

  return new Date((sunsetJulian - 2_440_587.5) * 86_400_000);
}

/** Formats an instant as Chris writes times: "7:32 pm", lowercase, in SF. */
export function formatLocalTime(instant: Date, timeZone: string = SF_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone, hour: "numeric", minute: "2-digit", hour12: true,
  })
    .format(instant)
    .replace(/\s*AM$/, " am")
    .replace(/\s*PM$/, " pm");
}

export type GoldenHourWindow = {
  date: string;
  sunset: string;
  /** Where a session should start to land inside golden light. */
  recommendedStart: string;
  /** Latest sensible start for the given duration. */
  latestStart: string;
};

/** Start times round to the quarter hour. */
const START_ROUNDING_MINUTES = 15;

/**
 * Rounds an instant to the nearest quarter hour.
 *
 * Sunset itself is a fact and stays exact, but a START time is a human
 * suggestion and nobody proposes "5:18 pm". Handing the model a
 * to-the-minute figure got exactly that parroted back into drafts.
 */
function roundToQuarterHour(instant: Date): Date {
  const ms = START_ROUNDING_MINUTES * 60_000;
  return new Date(Math.round(instant.getTime() / ms) * ms);
}

/**
 * Golden-hour window for a date, sized to the session.
 *
 * The rule of thumb is to begin about an hour before sunset. A session needs to
 * finish near sunset rather than start at it, so the latest start walks back
 * from sunset by the session duration.
 */
export function buildGoldenHourWindow(
  dateStr: string,
  sessionMinutes = 60,
  coords: { latitude: number; longitude: number } = SF_COORDS,
  timeZone: string = SF_TIME_ZONE,
): GoldenHourWindow | null {
  const sunset = computeSunsetUtc(dateStr, coords.latitude, coords.longitude);
  if (!sunset) return null;

  const recommendedStart = roundToQuarterHour(new Date(sunset.getTime() - 60 * 60_000));
  const latestStart = roundToQuarterHour(new Date(sunset.getTime() - sessionMinutes * 60_000));

  return {
    date: dateStr,
    sunset: formatLocalTime(sunset, timeZone),
    recommendedStart: formatLocalTime(recommendedStart, timeZone),
    latestStart: formatLocalTime(latestStart, timeZone),
  };
}

/**
 * Whether golden hour is the right recommendation at all.
 *
 * Sunrise suits a client who asked for it or who wants an empty location;
 * wooded spots lose usable light well before sunset, so the generic "an hour
 * before sunset" line would send them into the dark.
 */
export function goldenHourCaveat(locationText: string | null | undefined): string | null {
  const text = (locationText ?? "").toLowerCase();
  if (!text.trim()) return null;
  if (/muir|redwood|forest|woods|grove|canyon|lover'?s lane|eucalyptus/.test(text)) {
    return "This location is wooded, so it goes dark well before sunset. Suggest starting earlier than the usual hour-before-sunset.";
  }
  if (/sunrise|morning|early/.test(text)) {
    return "They mentioned mornings, so sunrise timing may suit them better than sunset.";
  }
  return null;
}
