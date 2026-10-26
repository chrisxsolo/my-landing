// Campus Spots entries for schools whose location guide is the source of
// truth (lib/schoolSpots GUIDE_SYNCED_CAMPUS_SPOTS). Text comes from the
// school's data.ts, so /grad-guide/campus-spots and /grads/<slug>/spots never
// disagree. Photos keep coming from that school's location_spots rows (which
// the Content Engine and Admin → Locations fill), then from the guide's own
// section photos (Chris's spot tags). Server-only.
import type { SchoolLandingData, SchoolSpot } from "@/app/components/SchoolLandingTemplate";
import { data as usf } from "@/app/(professional)/grads/usf/data";
import { BUILT_IN_SCHOOLS } from "@/lib/contentEngine/schools";
import type { SchoolSlug } from "@/lib/contentEngine/taxonomy";
import type { LocationSpot } from "@/lib/gradGuideData";
import { getSchoolSpotsGuidePhotos, type SchoolSpotsGuidePhotos } from "@/lib/pagePhotos/publicPages";
import { campusSpotNameKey } from "@/lib/pagePhotos/spotPhotos";
import { GUIDE_SYNCED_CAMPUS_SPOTS, sectionSpotKeys, spotsForSchool } from "@/lib/schoolSpots";

/** Guide data per synced school slug; a test keeps this equal to GUIDE_SYNCED_CAMPUS_SPOTS. */
export const SYNCED_GUIDE_DATA: Partial<Record<SchoolSlug, SchoolLandingData>> = { usf };

// Generated ids sit far above real location_spots ids so React keys never clash.
const GENERATED_ID_BASE = 1_000_000;

/** The location_spots row showing this guide section (its own or a child composition's name). */
function matchingRow(slug: string, key: string, rows: readonly LocationSpot[]): LocationSpot | undefined {
  const keys = new Set(sectionSpotKeys(slug, key));
  const names = new Set(spotsForSchool(slug)
    .filter((def) => keys.has(def.key))
    .flatMap((def) => def.campusSpotNames.map(campusSpotNameKey)));
  return rows.find((row) => names.has(campusSpotNameKey(row.name)));
}

function sectionPhotoUrl(slug: string, key: string, photos: SchoolSpotsGuidePhotos | null): string | null {
  if (!photos) return null;
  const urls = sectionSpotKeys(slug, key).flatMap((k) => photos.bySpot[k] ?? []).map((p) => p.image_url);
  return urls[0] ?? null;
}

export function guideCampusSpots(
  schoolId: string, slug: SchoolSlug, data: SchoolLandingData,
  rows: readonly LocationSpot[], photos: SchoolSpotsGuidePhotos | null,
): LocationSpot[] {
  const school = BUILT_IN_SCHOOLS[slug];
  const ownRows = rows.filter((row) => row.school_id === schoolId);
  return data.spots
    .filter((spot): spot is SchoolSpot & { key: string } => Boolean(spot.key))
    .map((spot, i) => {
      const row = matchingRow(slug, spot.key, ownRows);
      return {
        id: row?.id ?? GENERATED_ID_BASE + i,
        school_id: schoolId,
        school_name: school.name,
        school_short: school.shortName,
        name: spot.name,
        description: spot.description,
        tip: spot.campusTip ?? spot.tip ?? "",
        icon: row?.icon ?? "📍",
        image_url: row?.image_url ?? sectionPhotoUrl(slug, spot.key, photos),
        order: i,
        spot_key: spot.key,
      };
    });
}

type GuidePhotosLoader = (slug: string, schoolShort: string) => Promise<SchoolSpotsGuidePhotos | null>;

/**
 * location_spots rows with each synced school's rows replaced by its guide's
 * spots. The public page uses the cached guide photos; the campus-spot photo
 * sync passes an uncached loader so it sees fresh data.
 */
export async function withGuideCampusSpots(
  rows: LocationSpot[], loadPhotos: GuidePhotosLoader = getSchoolSpotsGuidePhotos,
): Promise<LocationSpot[]> {
  const synced = await Promise.all(Object.entries(GUIDE_SYNCED_CAMPUS_SPOTS).map(async ([schoolId, slug]) => {
    const data = SYNCED_GUIDE_DATA[slug];
    if (!data) return [];
    const photos = await loadPhotos(slug, data.schoolShort).catch((error: unknown) => {
      console.error(`[campus-spots] ${slug} guide photos failed; using location_spots photos only`, error);
      return null;
    });
    return guideCampusSpots(schoolId, slug, data, rows, photos);
  }));
  return [...rows.filter((row) => !(row.school_id in GUIDE_SYNCED_CAMPUS_SPOTS)), ...synced.flat()];
}
