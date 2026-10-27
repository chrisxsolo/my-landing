// Where is the camera going, and what does travel cost there?
//
// One answer for every surface that prices travel: Draft AI facts, the
// contract generator, payment inference. Each used to read travel off its own
// regex over whatever text it had, which is how a Santa Clara graduate who
// moved the shoot to San Francisco was still billed the Santa Clara fee, and
// how an elopement that mentioned "Stanford" picked up Stanford's fee.
//
// Rules, in order:
//   1. The shoot LOCATION decides when it names somewhere recognisable.
//      A campus name → that campus's approved fee. An SF place → included.
//      Elsewhere outside SF → a fee applies but is not in the rate card.
//   2. Otherwise, for a graduation, the SCHOOL's campus decides.
//   3. Otherwise nothing is known.
// Amounts only ever come from PRICING_CATALOG (lib/travelFee.ts underneath).

import { PRICING_CATALOG } from "./pricingCatalog";

type CampusKey = keyof typeof PRICING_CATALOG.graduation.travelFees;

export type TravelResolution =
  | { kind: "verified"; fee: number; place: string; campus: CampusKey }
  | { kind: "included"; place: string }
  | { kind: "unknown"; place: string }
  | { kind: "none" };

/** School-field patterns: a bare "east bay" in a SCHOOL field does mean CSU East Bay. */
const CAMPUS_FEES: [RegExp, CampusKey][] = [
  [/sf ?state|san francisco state|sfsu/, "sf-state"],
  [/usf|university of san francisco/, "usf"],
  // CSU East Bay before Berkeley: "Cal State East Bay" would otherwise match
  // Berkeley's bare "cal" and be billed Berkeley's fee.
  [/csueb|cal state east bay|east bay|hayward/, "csueb"],
  [/uc ?berkeley|berkeley|cal\b(?! state)/, "uc-berkeley"],
  [/sjsu|san jose state/, "sjsu"],
  [/santa clara|scu/, "santa-clara"],
  [/stanford/, "stanford"],
  [/san francisco|\bsf\b/, "sf-other"],
];

/**
 * A location that names an actual campus. Tighter than CAMPUS_FEES on
 * purpose: a couples session somewhere in "East Bay" is not at CSU East Bay.
 */
const NAMED_CAMPUSES: [RegExp, CampusKey][] = [
  [/\bcsueb\b|cal state east bay|california state university,? east bay/, "csueb"],
  [/\bsjsu\b|san jose state/, "sjsu"],
  [/santa clara university|\bscu\b/, "santa-clara"],
  [/stanford university|stanford campus/, "stanford"],
  [/uc ?berkeley|university of california,? berkeley|berkeley campus/, "uc-berkeley"],
];

/** Places that are plainly inside San Francisco, where no travel fee applies. */
export const IN_SAN_FRANCISCO =
  /san francisco|\bsf\b|crissy|baker beach|lands end|palace of fine arts|golden gate park|dolores|presidio|sutro|twin peaks|city hall|legion of honor|ocean beach|marshall'?s beach|bernal|alamo square|fort point|mission district|stern grove|botanical garden/;

/**
 * Somewhere outside the city. Used only to decide whether travel applies,
 * never to derive an amount.
 */
export const OUTSIDE_SAN_FRANCISCO =
  /oakland|berkeley|alameda|richmond|san jose|santa clara|sunnyvale|palo alto|stanford|menlo park|woodside|filoli|redwood city|san mateo|burlingame|peninsula|half moon bay|pacifica|rockaway|daly city|marin|sausalito|tiburon|muir|point reyes|stinson|napa|sonoma|santa cruz|davenport|monterey|walnut creek|livermore|fremont|hayward|concord|dublin|pleasanton|gilroy|morgan hill|san rafael|novato|petaluma|vallejo|east bay|south bay|north bay|wine country/;

const lower = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

function campusFee(key: CampusKey, place: string): TravelResolution {
  const fee = PRICING_CATALOG.graduation.travelFees[key];
  if (fee === null) return { kind: "included", place };
  if (typeof fee === "number") return { kind: "verified", fee, place, campus: key };
  return { kind: "unknown", place };
}

/** Whether a location string names a place this module recognises. */
export function namesAPlace(location: string | null | undefined): boolean {
  const text = lower(location);
  return Boolean(text) && (
    NAMED_CAMPUSES.some(([pattern]) => pattern.test(text))
    || IN_SAN_FRANCISCO.test(text)
    || OUTSIDE_SAN_FRANCISCO.test(text)
  );
}

/** The first out-of-city place named in free text, if any. */
export function outOfCityPlaceIn(text: string | null | undefined): string {
  const match = lower(text).match(OUTSIDE_SAN_FRANCISCO);
  return match ? match[0] : "";
}

/** Travel for a known shoot location, or null when the location says nothing either way. */
export function travelForLocation(place: string): TravelResolution | null {
  const normalized = lower(place);
  if (!normalized) return null;
  const campus = NAMED_CAMPUSES.find(([pattern]) => pattern.test(normalized));
  if (campus) return campusFee(campus[1], place);
  if (IN_SAN_FRANCISCO.test(normalized)) return { kind: "included", place };
  if (OUTSIDE_SAN_FRANCISCO.test(normalized)) return { kind: "unknown", place };
  return null;
}

/** Travel to a school's campus, read off a school field. */
export function travelForSchool(school: string): TravelResolution {
  const normalized = lower(school);
  if (!normalized) return { kind: "none" };
  const match = CAMPUS_FEES.find(([pattern]) => pattern.test(normalized));
  return match ? campusFee(match[1], school) : { kind: "unknown", place: school };
}

export interface TravelInput {
  school?: string | null;
  /** Where the shoot happens, when known. Wins over the school. */
  location?: string | null;
  /** Free text, consulted for an out-of-city place only when the location field names nothing. */
  message?: string | null;
  /**
   * Whether the school may stand in for the shoot location. True for a
   * graduation (they shoot on their campus unless told otherwise); false for
   * every other service, where a school is just where someone studied.
   */
  schoolImpliesLocation?: boolean;
}

export function resolveTravel(input: TravelInput): TravelResolution {
  const school = (input.school ?? "").trim();
  const field = (input.location ?? "").trim();
  const useSchool = input.schoolImpliesLocation !== false && Boolean(school);
  // The location field is not reliably a location (one inquiry carried
  // "September 28" in it), so it counts only when it names a place.
  const place = namesAPlace(field) ? field : outOfCityPlaceIn(input.message) || (useSchool ? "" : field);
  const byPlace = place ? travelForLocation(place) : null;
  if (byPlace) return byPlace;
  if (useSchool) return travelForSchool(school);
  return place ? { kind: "unknown", place } : { kind: "none" };
}

/** The fee in dollars, 0 when travel is included or unknown. Callers that must not guess check `kind` first. */
export function travelFeeAmount(resolution: TravelResolution): number {
  return resolution.kind === "verified" ? resolution.fee : 0;
}
