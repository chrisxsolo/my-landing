// Why one photo shows one campus spot. Pure — the planner, the sync report
// and the tests all call it.
//
// The school is settled first: candidates are only photos already matched to
// the spot's school page (lib/pagePhotos), so a UC Berkeley photo can never
// reach an SJSU spot. Then, strongest evidence first:
//   1. tag     — the photographer tagged it with this spot (decisive either way)
//   2. place   — photo-level facts: its own confirmed location
//                (session_photos.photo_location, manual or GPS-matched, else
//                the Portfolio photo's location tag), then its own GPS inside
//                an off-campus spot's place, then the pool's place for it
//   3. session — its session names ONE location and that location is this spot
//   4. text    — its own title / alt names this spot, and its session (if any)
//                has exactly one location that names no other spot
// Photo-level facts veto weaker evidence: a photo whose own location or GPS
// says it was taken somewhere else never matches by place, session or text.
// A session-level location is context, not a fact about every photo, so a
// session with several locations never places a photo by session or text.
import { inferSchoolFromText } from "@/lib/pagePhotos/resolve";
import { sectionSpotKeys, spotCandidatesFromText, spotKeysByPlace, spotsForSchool, type SchoolSpotDef } from "@/lib/schoolSpots";

export type FillEvidence = "tag" | "place" | "session" | "text";

/** One campus spot as the page shows it without automatic photos. */
export interface SpotSlot {
  schoolSlug: string;
  spotKey: string;
  name: string;
  /** The photo already shown (a chosen location_spots photo or a guide section photo). */
  shownUrl: string | null;
}

/** Where the photo itself was taken, confirmed for this photo only. */
export interface PhotoLocationFact {
  text: string;
  /** manual / gps = session_photos.photo_location_source; tag = the Portfolio photo's location tag. */
  source: "manual" | "gps" | "tag";
  /** The known place the text names (exactly one), else null. */
  placeKey: string | null;
}

/** One photo eligible for its school page, with the facts that can place it. */
export interface FillCandidate {
  url: string;
  schoolSlug: string;
  /** The photo's own title and alt text. */
  text: string;
  width: number | null;
  height: number | null;
  quality: number | null;
  featured: boolean;
  /** Position in the school page's curated order. */
  order: number;
  /** The pool's place for the photo (location tag, single session location, or GPS). */
  placeKey: string | null;
  /** The photographer's spot tag on this school, if any. */
  tag: { spotKey: string; featured: boolean } | null;
  /** Locations typed on its Content Engine session (empty for older uploads). */
  sessionLocations: readonly string[];
  /** True when the photo belongs to a Content Engine session. */
  fromSession?: boolean;
  photoLocation?: PhotoLocationFact | null;
  /** The known place the photo's own GPS falls inside, if any. */
  gpsPlace?: { key: string; name: string } | null;
}

export interface Match {
  evidence: FillEvidence;
  detail: string;
  /** Lower is stronger; ranks matches inside the same evidence kind. */
  strength: number;
}

type Verdict = Match | "contradicts" | null;

interface SpotContext { slot: SpotSlot; def: SchoolSpotDef | undefined; keys: ReadonlySet<string> }

/** Every spot the text names: all this spot → yes, none of them → no, a mix → unclear. */
function namesSpot(ctx: SpotContext, text: string): "yes" | "no" | "unclear" | "none" {
  const named = spotCandidatesFromText(ctx.slot.schoolSlug, text).map((s) => s.key);
  if (named.length === 0) return "none";
  const inside = named.filter((key) => ctx.keys.has(key)).length;
  return inside === named.length ? "yes" : inside === 0 ? "no" : "unclear";
}

/** A known place: this spot's place, a neutral place (the campus itself), or somewhere else. */
function placeIs(ctx: SpotContext, placeKey: string, placeName: string | null): "this" | "neutral" | "other" {
  if (ctx.def?.placeKey === placeKey) return "this";
  if (ctx.def?.placeKey || spotKeysByPlace(ctx.slot.schoolSlug)[placeKey]) return "other";
  return placeName && inferSchoolFromText(placeName).school === ctx.slot.schoolSlug ? "neutral" : "other";
}

function photoLocationVerdict(ctx: SpotContext, loc: PhotoLocationFact): Verdict {
  const match: Match = { evidence: "place", detail: `photo location "${loc.text}" (${loc.source})`, strength: 1 };
  const named = namesSpot(ctx, loc.text);
  if (named === "yes") return match;
  if (named === "no") return "contradicts";
  if (named === "unclear") return null;
  if (loc.placeKey) {
    const where = placeIs(ctx, loc.placeKey, loc.text);
    return where === "this" ? match : where === "other" ? "contradicts" : null;
  }
  // Text that names no spot and no known place only stays neutral when it names this campus.
  return !ctx.def?.placeKey && inferSchoolFromText(loc.text).school === ctx.slot.schoolSlug ? null : "contradicts";
}

function placeVerdict(ctx: SpotContext, photo: FillCandidate): Verdict {
  if (photo.gpsPlace) {
    const where = placeIs(ctx, photo.gpsPlace.key, photo.gpsPlace.name);
    if (where === "this") return { evidence: "place", detail: `photo GPS is at ${photo.gpsPlace.name}`, strength: 2 };
    if (where === "other") return "contradicts";
  }
  if (photo.placeKey) {
    if (ctx.def?.placeKey === photo.placeKey) return { evidence: "place", detail: `shot at ${photo.placeKey}`, strength: 3 };
    if (ctx.def?.placeKey || spotKeysByPlace(ctx.slot.schoolSlug)[photo.placeKey]) return "contradicts";
  }
  return null;
}

/** Session and text evidence: only for a photo whose session (if any) names exactly one location. */
function contextMatch(ctx: SpotContext, photo: FillCandidate): Match | null {
  const locations = photo.sessionLocations;
  if (locations.length > 1 || (photo.fromSession && locations.length === 0)) return null;
  const session = locations.length === 1 ? namesSpot(ctx, locations[0]) : "none";
  const text = namesSpot(ctx, photo.text);
  if (session === "yes" && (text === "none" || text === "yes")) {
    return { evidence: "session", detail: `session location "${locations[0]}"`, strength: 4 };
  }
  // Text must name exactly one spot: "Doe Library" alone names two compositions.
  const named = spotCandidatesFromText(ctx.slot.schoolSlug, photo.text);
  if (text === "yes" && session === "none" && named.length === 1) {
    return { evidence: "text", detail: `photo text names ${named[0].key}`, strength: 5 };
  }
  return null;
}

/** Why this photo shows this spot, or null when it is not proven. */
export function matchEvidence(slot: SpotSlot, photo: FillCandidate): Match | null {
  if (photo.schoolSlug !== slot.schoolSlug) return null;
  const keys = new Set(sectionSpotKeys(slot.schoolSlug, slot.spotKey));
  if (photo.tag) {
    return keys.has(photo.tag.spotKey) ? { evidence: "tag", detail: `tagged ${photo.tag.spotKey}`, strength: 0 } : null;
  }
  const ctx: SpotContext = { slot, keys, def: spotsForSchool(slot.schoolSlug).find((s) => s.key === slot.spotKey) };
  for (const verdict of [photo.photoLocation ? photoLocationVerdict(ctx, photo.photoLocation) : null, placeVerdict(ctx, photo)]) {
    if (verdict === "contradicts") return null;
    if (verdict) return verdict;
  }
  return contextMatch(ctx, photo);
}
