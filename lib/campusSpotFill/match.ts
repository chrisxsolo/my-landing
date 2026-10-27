// Decides which existing public photo fills an EMPTY spot on
// /grad-guide/campus-spots. Pure — the sync, the backfill report and the tests
// all call it, so they can never disagree. Which evidence may place a photo
// lives in lib/campusSpotFill/evidence.ts.
//
// Existing photos always win: a spot that already shows a photo is never
// planned, and a photo tagged for a spot replaces an automatic pick there.
// A previous automatic pick is re-checked on every run and released when
//   • the spot left the page or now shows a chosen photo
//   • the photo stopped being public for that school (unpublished, hidden,
//     excluded, marketing permission revoked, school changed)
//   • the page now shows the same photo at another spot
//   • its evidence no longer holds (a tag removed, a session or photo
//     location changed) — the spot is re-planned in the same run
import {
  matchEvidence, type FillCandidate, type FillEvidence, type Match, type SpotSlot,
} from "@/lib/campusSpotFill/evidence";
import { sectionSpotKeys } from "@/lib/schoolSpots";

export { matchEvidence };
export type { FillCandidate, FillEvidence, Match, PhotoLocationFact, SpotSlot } from "@/lib/campusSpotFill/evidence";

export const CAMPUS_SPOT_AUTO_PHOTOS_TABLE = "campus_spot_auto_photos";
export const CLAIM_CAMPUS_SPOT_PHOTO_RPC = "claim_campus_spot_photo";

// Photos without an AI score (older uploads) rank as solid, not top picks.
const UNSCORED_QUALITY = 6;

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

interface Scored { photo: FillCandidate; match: Match }

const slotId = (schoolSlug: string, spotKey: string) => `${schoolSlug}:${spotKey}`;
const isPortrait = (p: FillCandidate) => (p.width && p.height ? p.height >= p.width : true);

function rank(a: Scored, b: Scored): number {
  return a.match.strength - b.match.strength
    || Number(b.photo.tag?.featured ?? false) - Number(a.photo.tag?.featured ?? false)
    || (b.photo.quality ?? UNSCORED_QUALITY) - (a.photo.quality ?? UNSCORED_QUALITY)
    || Number(isPortrait(b.photo)) - Number(isPortrait(a.photo))
    || Number(b.photo.featured) - Number(a.photo.featured)
    || a.photo.order - b.photo.order;
}

interface PlanContext {
  slotById: ReadonlyMap<string, SpotSlot>;
  photoByKey: ReadonlyMap<string, FillCandidate>;
  shownUrls: ReadonlySet<string>;
}

/** Why a previous automatic pick must go, or null to keep it. */
function releaseReason(row: AutoRow, ctx: PlanContext): string | null {
  const slot = ctx.slotById.get(slotId(row.schoolSlug, row.spotKey));
  if (!slot) return "the spot is no longer on the page";
  if (slot.shownUrl) return "the spot now shows a chosen photo";
  const photo = ctx.photoByKey.get(`${row.schoolSlug}|${row.imageUrl}`);
  if (!photo) return "the photo is no longer public for this school";
  if (ctx.shownUrls.has(row.imageUrl)) return "the page already shows this photo at another spot";
  if (photo.tag && !sectionSpotKeys(row.schoolSlug, row.spotKey).includes(photo.tag.spotKey)) {
    return `the photographer tagged it ${photo.tag.spotKey}`;
  }
  return matchEvidence(slot, photo) ? null : "its location evidence no longer holds";
}

/** A photographer-tagged photo for this slot that nothing else uses yet. */
function freeTaggedPhoto(slot: SpotSlot, candidates: readonly FillCandidate[], used: ReadonlySet<string>): boolean {
  return candidates.some((photo) => photo.tag && !used.has(photo.url) && matchEvidence(slot, photo)?.evidence === "tag");
}

function reviewExisting(
  slots: readonly SpotSlot[], candidates: readonly FillCandidate[], existing: readonly AutoRow[],
): Pick<FillPlan, "keep" | "release"> {
  const ctx: PlanContext = {
    slotById: new Map(slots.map((s) => [slotId(s.schoolSlug, s.spotKey), s])),
    photoByKey: new Map(candidates.map((p) => [`${p.schoolSlug}|${p.url}`, p])),
    shownUrls: new Set(slots.flatMap((s) => (s.shownUrl ? [s.shownUrl] : []))),
  };
  const release: FillPlan["release"] = [];
  const valid: AutoRow[] = [];
  for (const row of existing) {
    const reason = releaseReason(row, ctx);
    if (reason) release.push({ row, reason });
    else valid.push(row);
  }
  // A spot tag is the photographer's choice: it replaces a weaker automatic pick.
  const used = new Set([...ctx.shownUrls, ...valid.map((row) => row.imageUrl)]);
  const keep = valid.filter((row) => {
    const slot = ctx.slotById.get(slotId(row.schoolSlug, row.spotKey)) as SpotSlot;
    if (row.evidence === "tag" || !freeTaggedPhoto(slot, candidates, used)) return true;
    release.push({ row, reason: "a photo tagged for this spot replaces it" });
    return false;
  });
  return { keep, release };
}

/**
 * The full plan for one run. Idempotent: run it again on the result and it
 * keeps every row and claims nothing new. Never touches a spot that shows a
 * photo, and never uses a photo the page already shows elsewhere.
 */
export function planFill(
  slots: readonly SpotSlot[], candidates: readonly FillCandidate[], existing: readonly AutoRow[],
): FillPlan {
  const { keep, release } = reviewExisting(slots, candidates, existing);
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
      .filter((m): m is Scored => m.match !== null);
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
