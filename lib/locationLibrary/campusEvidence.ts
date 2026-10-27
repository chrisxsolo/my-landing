// A campus is not a Bay Area place. A graduation session's location text
// ("Sather gate, doe library", "Stanford University") names a school or its
// campus spots; those belong to the school's campus-spot guide
// (lib/schoolSpots), never to bay_area_locations. This module decides, from
// text alone, which parts of a session location are campus evidence, so the
// location sync can set them aside BEFORE trying to match places. Pure.
//
// Off-campus spots that name a verified place (placeKey set — Palace of Fine
// Arts for SF State) stay places: a Legion of Honor graduation is a real
// library location, so only on-campus spots count as campus evidence.
import { BUILT_IN_SCHOOL_OPTIONS, BUILT_IN_SCHOOLS, schoolMatchesText } from "@/lib/contentEngine/schools";
import { isSchoolSlug, type SchoolSlug } from "@/lib/contentEngine/taxonomy";
import { detectSchoolsInText } from "@/lib/schoolDetection";
import { spotCandidatesFromText } from "@/lib/schoolSpots";

export interface CampusEvidence {
  schoolSlug: SchoolSlug;
  schoolName: string;
  /** The location text (or part of it) that named the campus. */
  text: string;
  /** On-campus spot keys the text names (lib/schoolSpots), possibly empty. */
  spotKeys: string[];
}

export interface CampusSplit {
  campus: CampusEvidence[];
  /** Location text parts that are not campus evidence — resolved as places. */
  remainder: string[];
}

/** Same separators the sync uses for "A, B and C" location texts. */
export const LOCATION_SPLIT = /,|\/|;|\s+and\s+|\s+&\s+|\s+\+\s+/i;

/** Only an unambiguous school name counts: bare "cal" or "usf" alone do not. */
const DETECTION_CONFIDENCE_MIN = 0.9;

const slugByCanonicalName = new Map<string, SchoolSlug>(
  (Object.keys(BUILT_IN_SCHOOLS) as SchoolSlug[]).map((slug) => [BUILT_IN_SCHOOLS[slug].name, slug]),
);

/** The one built-in school this text names (name, alias or a confident detection), else null. */
export function schoolNamedBy(text: string): SchoolSlug | null {
  const exact = BUILT_IN_SCHOOL_OPTIONS.filter((s) => schoolMatchesText(s, text)).map((s) => s.slug);
  if (exact.length === 1 && isSchoolSlug(exact[0])) return exact[0];
  if (exact.length > 1) return null;
  const detected = detectSchoolsInText(text)
    .filter((d) => d.confidence >= DETECTION_CONFIDENCE_MIN)
    .map((d) => slugByCanonicalName.get(d.canonicalName))
    .filter((slug): slug is SchoolSlug => slug !== undefined);
  return detected.length === 1 ? detected[0] : null;
}

/** On-campus spots (no placeKey) the text names for this school. */
function campusSpotKeys(school: SchoolSlug, text: string): string[] {
  const candidates = spotCandidatesFromText(school, text);
  if (candidates.length === 0 || candidates.some((c) => c.placeKey)) return [];
  return candidates.map((c) => c.key);
}

function evidence(school: SchoolSlug, text: string, spotKeys: string[]): CampusEvidence {
  return { schoolSlug: school, schoolName: BUILT_IN_SCHOOLS[school].shortName, text, spotKeys };
}

/**
 * Splits one session location text into campus evidence and place text.
 * The school is the session's own (school_slug) or one the text itself names.
 * A part is campus when it names the school or one of its on-campus spots.
 * Without a known school, only parts that name a school are campus.
 */
export function splitCampusText(text: string, sessionSchool: string | null): CampusSplit {
  const trimmed = text.trim();
  if (!trimmed) return { campus: [], remainder: [] };
  const whole = schoolNamedBy(trimmed);
  if (whole) return { campus: [evidence(whole, trimmed, campusSpotKeys(whole, trimmed))], remainder: [] };

  const parts = trimmed.split(LOCATION_SPLIT).map((p) => p.trim()).filter(Boolean);
  const named = parts.map(schoolNamedBy).find((s): s is SchoolSlug => s !== null) ?? null;
  const school = isSchoolSlug(sessionSchool) ? sessionSchool : named;
  if (!school) return { campus: [], remainder: [trimmed] };

  const campusParts = parts.filter((p) => schoolNamedBy(p) === school || campusSpotKeys(school, p).length > 0);
  if (campusParts.length === 0) return { campus: [], remainder: [trimmed] };
  const spotKeys = [...new Set(campusParts.flatMap((p) => campusSpotKeys(school, p)))];
  const remainder = parts.filter((p) => !campusParts.includes(p));
  return { campus: [evidence(school, campusParts.join(", "), spotKeys)], remainder };
}

/** The school a "place" really is, when its key or name is a school (a confirmed verified_locations row, say). */
export function campusOfPlace(place: { key: string; name: string }): SchoolSlug | null {
  return isSchoolSlug(place.key) ? place.key : schoolNamedBy(place.name);
}

/** Campus evidence for a place that turned out to be a school, or null for a real place. */
export function campusPlaceEvidence(place: { key: string; name: string }, text: string): CampusEvidence | null {
  const school = campusOfPlace(place);
  return school ? evidence(school, text, campusSpotKeys(school, text)) : null;
}

/** One evidence entry per school, spots merged, for messages and reports. */
export function mergeCampusEvidence(list: readonly CampusEvidence[]): CampusEvidence[] {
  const bySchool = new Map<SchoolSlug, CampusEvidence>();
  for (const e of list) {
    const prev = bySchool.get(e.schoolSlug);
    bySchool.set(e.schoolSlug, prev
      ? { ...prev, text: `${prev.text}; ${e.text}`, spotKeys: [...new Set([...prev.spotKeys, ...e.spotKeys])] }
      : e);
  }
  return [...bySchool.values()];
}
