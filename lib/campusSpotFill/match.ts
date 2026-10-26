// Decides which existing public photo fills an EMPTY spot on
// /grad-guide/campus-spots. Pure — the sync, the backfill report and the tests
// all call it, so they can never disagree.
//
// Candidates are only photos already matched to the spot's school page
// (/grads/<slug>, lib/pagePhotos): the school is settled there (photo tag >
// Content Engine session school > the photo's own text naming exactly one
// school), and the photo is public, cleared for marketing and not hidden.
// So a UC Berkeley photo can never reach an SJSU spot.
//
// Which spot a photo shows, strongest evidence first:
//   1. tag     — the photographer tagged it with this spot (Admin → Page Photos)
//   2. place   — an off-campus spot, and the photo's location evidence is that exact place
//   3. session — its Content Engine session names one location, that location
//                names this spot, and the photo's own text names no other spot
//   4. text    — the photo's own title / alt names this spot and no other
// A photo tagged with a different spot never matches by place, session or text.
// Two spots named, or no spot named → no match. Scenery is never evidence.
//
// Existing photos always win: a spot that already shows a photo is never
// planned, and a previous automatic pick stays until it stops being public,
// the spot gets a chosen photo, or the photographer tags it elsewhere.
import { sectionSpotKeys, spotsForSchool, suggestSpotFromText } from "@/lib/schoolSpots";

export const CAMPUS_SPOT_AUTO_PHOTOS_TABLE = "campus_spot_auto_photos";
export const CLAIM_CAMPUS_SPOT_PHOTO_RPC = "claim_campus_spot_photo";

export type FillEvidence = "tag" | "place" | "session" | "text";

const EVIDENCE_RANK: Record<FillEvidence, number> = { tag: 0, place: 1, session: 2, text: 3 };
// Photos without an AI score (older uploads) rank as solid, not top picks.
const UNSCORED_QUALITY = 6;

/** One campus spot as the page shows it without automatic photos. */
export interface SpotSlot {
  schoolSlug: string;
  spotKey: string;
  name: string;
  /** The photo already shown (a chosen location_spots photo or a guide section photo). */
  shownUrl: string | null;
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
  placeKey: string | null;
  /** The photographer's spot tag on this school, if any. */
  tag: { spotKey: string; featured: boolean } | null;
  /** Locations typed on its Content Engine session (empty for older uploads). */
  sessionLocations: readonly string[];
}

export interface AutoRow {
  schoolSlug: string;
  spotKey: string;
  imageUrl: string;
  evidence: FillEvidence;
}

export interface Claim extends AutoRow {
  detail: string;
}

export interface FillPlan {
  keep: AutoRow[];
  release: { row: AutoRow; reason: string }[];
  claim: Claim[];
  unmatched: { slot: SpotSlot; reason: string }[];
}

interface Match { evidence: FillEvidence; detail: string }

const slotId = (schoolSlug: string, spotKey: string) => `${schoolSlug}:${spotKey}`;

function sessionSpot(slug: string, locations: readonly string[]): string | null {
  if (locations.length !== 1) return null;
  return suggestSpotFromText(slug, locations[0])?.key ?? null;
}

/** Why this photo shows this spot, or null when it is not proven. */
export function matchEvidence(slot: SpotSlot, photo: FillCandidate): Match | null {
  if (photo.schoolSlug !== slot.schoolSlug) return null;
  const keys = new Set(sectionSpotKeys(slot.schoolSlug, slot.spotKey));
  if (photo.tag) {
    return keys.has(photo.tag.spotKey) ? { evidence: "tag", detail: `tagged ${photo.tag.spotKey}` } : null;
  }
  const def = spotsForSchool(slot.schoolSlug).find((spot) => spot.key === slot.spotKey);
  if (def?.placeKey && photo.placeKey === def.placeKey) {
    return { evidence: "place", detail: `shot at ${def.placeKey}` };
  }
  const fromText = suggestSpotFromText(slot.schoolSlug, photo.text)?.key ?? null;
  const fromSession = sessionSpot(slot.schoolSlug, photo.sessionLocations);
  if (fromSession && keys.has(fromSession) && (!fromText || keys.has(fromText))) {
    return { evidence: "session", detail: `session location "${photo.sessionLocations[0]}"` };
  }
  if (fromText && keys.has(fromText) && (!fromSession || keys.has(fromSession))) {
    return { evidence: "text", detail: `photo text names ${fromText}` };
  }
  return null;
}

const isPortrait = (p: FillCandidate) => (p.width && p.height ? p.height >= p.width : true);

function rank(a: { photo: FillCandidate; match: Match }, b: { photo: FillCandidate; match: Match }): number {
  return EVIDENCE_RANK[a.match.evidence] - EVIDENCE_RANK[b.match.evidence]
    || Number(b.photo.tag?.featured ?? false) - Number(a.photo.tag?.featured ?? false)
    || (b.photo.quality ?? UNSCORED_QUALITY) - (a.photo.quality ?? UNSCORED_QUALITY)
    || Number(isPortrait(b.photo)) - Number(isPortrait(a.photo))
    || Number(b.photo.featured) - Number(a.photo.featured)
    || a.photo.order - b.photo.order;
}

/** Why a previous automatic pick must go, or null to keep it. */
function releaseReason(row: AutoRow, slot: SpotSlot | undefined, photo: FillCandidate | undefined): string | null {
  if (!slot) return "the spot is no longer on the page";
  if (slot.shownUrl) return "the spot now shows a chosen photo";
  if (!photo) return "the photo is no longer public for this school";
  if (photo.tag && !sectionSpotKeys(row.schoolSlug, row.spotKey).includes(photo.tag.spotKey)) {
    return `the photographer tagged it ${photo.tag.spotKey}`;
  }
  return null;
}

/**
 * The full plan for one run. Idempotent: run it again on the result and it
 * keeps every row and claims nothing new. Never touches a spot that shows a
 * photo, and never uses a photo the page already shows elsewhere.
 */
export function planFill(
  slots: readonly SpotSlot[], candidates: readonly FillCandidate[], existing: readonly AutoRow[],
): FillPlan {
  const slotById = new Map(slots.map((s) => [slotId(s.schoolSlug, s.spotKey), s]));
  const photoByUrl = new Map(candidates.map((p) => [`${p.schoolSlug}|${p.url}`, p]));
  const keep: AutoRow[] = [];
  const release: FillPlan["release"] = [];
  for (const row of existing) {
    const reason = releaseReason(row, slotById.get(slotId(row.schoolSlug, row.spotKey)),
      photoByUrl.get(`${row.schoolSlug}|${row.imageUrl}`));
    if (reason) release.push({ row, reason });
    else keep.push(row);
  }

  const used = new Set<string>([
    ...slots.flatMap((s) => (s.shownUrl ? [s.shownUrl] : [])),
    ...keep.map((row) => row.imageUrl),
  ]);
  const filled = new Set(keep.map((row) => slotId(row.schoolSlug, row.spotKey)));
  const claim: Claim[] = [];
  const unmatched: FillPlan["unmatched"] = [];

  for (const slot of slots) {
    if (slot.shownUrl || filled.has(slotId(slot.schoolSlug, slot.spotKey))) continue;
    const matches = candidates
      .map((photo) => ({ photo, match: matchEvidence(slot, photo) }))
      .filter((m): m is { photo: FillCandidate; match: Match } => m.match !== null);
    const best = matches.filter((m) => !used.has(m.photo.url)).sort(rank)[0];
    if (!best) {
      unmatched.push({
        slot,
        reason: matches.length > 0
          ? "every matching photo is already shown on the page"
          : "no public photo of this school is proven to show this spot",
      });
      continue;
    }
    used.add(best.photo.url);
    claim.push({
      schoolSlug: slot.schoolSlug, spotKey: slot.spotKey, imageUrl: best.photo.url,
      evidence: best.match.evidence, detail: best.match.detail,
    });
  }
  return { keep, release, claim, unmatched };
}
