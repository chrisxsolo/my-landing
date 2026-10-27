// Fills empty campus spots on /grad-guide/campus-spots from photos already
// public for each school (Portfolio + Content Engine). Server-only.
//
// Reads everything fresh (no page cache), plans with lib/campusSpotFill/match,
// then releases stale automatic picks and claims new ones. Never writes
// location_spots, so a chosen photo can't be overwritten. Any read that could
// not complete (the pool, the paged photo facts, the spots, the existing
// picks) aborts the run BEFORE any write: missing data must never look like
// "this photo is no longer public".
import type { SupabaseClient } from "@supabase/supabase-js";
import { withGuideCampusSpots } from "@/app/(professional)/grad-guide/campus-spots/guideSpots";
import type { LocationSpot } from "@/lib/gradGuideData";
import { loadKnownPlaces } from "@/lib/locations/registry";
import { loadPhotoPool } from "@/lib/pagePhotos/pool";
import { buildSchoolSpotsGuidePhotos } from "@/lib/pagePhotos/publicPages";
import { planFill, type FillPlan } from "@/lib/campusSpotFill/match";
import { CAMPUS_SPOT_SCHOOLS, campusSpotSlots, fillCandidates, spotKeyOf } from "@/lib/campusSpotFill/pageSpots";
import { loadPhotoFacts } from "@/lib/campusSpotFill/photoFacts";
import { claimSpotPhoto, readAutoRows, releaseAutoRow } from "@/lib/campusSpotFill/store";

export interface CampusSpotSyncReport {
  applied: boolean;
  /** Spots the page lists. */
  totalSpots: number;
  /** Spots showing a photo before automatic fills (chosen or guide photo). */
  withPhoto: number;
  /** Spots with no photo of their own. */
  missing: number;
  /** Missing spots that have no spot definition, so nothing can be matched to them. */
  notMatchable: string[];
  /** Automatic photos already in place and still valid. */
  kept: FillPlan["keep"];
  claimed: FillPlan["claim"];
  /** Planned claims another sync got to first. */
  lostRaces: number;
  released: FillPlan["release"];
  unmatched: { spot: string; reason: string }[];
}

async function loadSpotRows(client: SupabaseClient): Promise<LocationSpot[]> {
  const { data, error } = await client.from("location_spots").select("*")
    .order("school_id").order("order", { ascending: true });
  if (error) throw new Error(`could not read location_spots: ${error.message}`);
  return (data ?? []) as LocationSpot[];
}

async function applyPlan(client: SupabaseClient, plan: FillPlan): Promise<{ claimed: FillPlan["claim"]; lost: number }> {
  // Releases first: a stale pick must leave its spot before the spot is refilled.
  for (const { row } of plan.release) await releaseAutoRow(client, row);
  const claimed: FillPlan["claim"] = [];
  for (const claim of plan.claim) {
    if (await claimSpotPhoto(client, claim)) claimed.push(claim);
  }
  return { claimed, lost: plan.claim.length - claimed.length };
}

/** Dry run by default; pass apply to write. */
export async function syncCampusSpotPhotos(
  client: SupabaseClient, { apply }: { apply: boolean },
): Promise<CampusSpotSyncReport> {
  const [rows, pool, existing, facts] = await Promise.all([
    loadSpotRows(client), loadPhotoPool(client), readAutoRows(client),
    loadKnownPlaces(client).then((places) => loadPhotoFacts(client, places)),
  ]);
  if (pool.errors.length > 0) throw new Error(`photo pool incomplete — ${pool.errors.join("; ")}`);

  const spots = await withGuideCampusSpots(rows,
    async (slug, schoolShort) => buildSchoolSpotsGuidePhotos(pool, rows, slug, schoolShort));
  const slots = campusSpotSlots(spots);
  const candidates = CAMPUS_SPOT_SCHOOLS.flatMap((slug) => fillCandidates(pool, slug, facts));
  const plan = planFill(slots, candidates, existing);
  const { claimed, lost } = apply ? await applyPlan(client, plan) : { claimed: plan.claim, lost: 0 };

  const missingSpots = spots.filter((s) => !s.image_url);
  return {
    applied: apply,
    totalSpots: spots.length,
    withPhoto: spots.length - missingSpots.length,
    missing: missingSpots.length,
    notMatchable: missingSpots.filter((s) => !spotKeyOf(s)).map((s) => `${s.school_short} → ${s.name.trim()}`),
    kept: plan.keep,
    claimed,
    lostRaces: lost,
    released: plan.release,
    unmatched: plan.unmatched.map(({ slot, reason }) => ({ spot: `${slot.schoolSlug} → ${slot.name}`, reason })),
  };
}
