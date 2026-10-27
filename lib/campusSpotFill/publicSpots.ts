// What /grad-guide/campus-spots calls. Server-only; cached reads under the
// shared public-content tag, so the sync's revalidation shows a new photo on
// the next visit. Any failure keeps the page exactly as it was without
// automatic photos.
import type { LocationSpot } from "@/lib/gradGuideData";
import { cachePublicContent } from "@/lib/publicContentCache";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getPhotoPool } from "@/lib/pagePhotos/pool";
import { applyAutoPhotos, eligibleUrlsBySchool } from "@/lib/campusSpotFill/pageSpots";
import { readPublicAutoRows } from "@/lib/campusSpotFill/store";

// A failed read throws out of the wrapper, so it is never cached. A pick whose
// Content Engine photo was excluded or lost marketing permission is dropped
// here at render time, before the next sync releases it.
const getAutoRows = cachePublicContent(
  async () => readPublicAutoRows(createSupabaseServerClient()),
  ["campus-spot-auto-photos-v2"],
);

export async function withAutoFilledCampusSpots(spots: LocationSpot[]): Promise<LocationSpot[]> {
  try {
    const [rows, pool] = await Promise.all([getAutoRows(), getPhotoPool()]);
    if (!pool || rows.length === 0) return spots;
    return applyAutoPhotos(spots, rows, eligibleUrlsBySchool(pool));
  } catch (err) {
    console.error("[campus-spots] automatic spot photos failed; showing chosen photos only", err);
    return spots;
  }
}
