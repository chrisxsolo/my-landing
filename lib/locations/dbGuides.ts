// Public reads of database location guides (location_guides), adapted to the
// exact config shapes the hand-written guide templates already render. Reads
// go through the shared public-content cache; publishing busts it.
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { cachePublicContent } from "@/lib/publicContentCache";
import { locationGuideDataSchema, type LocationGuideData } from "@/lib/contentEngine/payloads";
import { LOCATION_GUIDES_TABLE } from "@/lib/locations/registry";
import { guideLocationPath, type LocationGuideType } from "@/lib/locations/guideCoverage";
import type { CouplesLocationData } from "@/lib/couplesGuide/types";
import type { FamilyLocationData } from "@/lib/familyGuide/types";
import type { PortraitLocationData } from "@/lib/portraitGuide/types";

export interface DbLocationGuide {
  guide: LocationGuideType;
  slug: string;
  canonicalPath: string;
  /** Search visibility (noindex + out of the sitemap when false). */
  indexable: boolean;
  data: LocationGuideData;
}

interface GuideRow {
  guide_type: LocationGuideType;
  slug: string;
  indexable: boolean;
  data: unknown;
}

function toGuide(row: GuideRow): DbLocationGuide | null {
  const parsed = locationGuideDataSchema.safeParse(row.data);
  if (!parsed.success) {
    console.error(`location guide ${row.guide_type}/${row.slug} has invalid data`, parsed.error.message);
    return null;
  }
  return {
    guide: row.guide_type,
    slug: row.slug,
    canonicalPath: guideLocationPath(row.guide_type, row.slug),
    indexable: row.indexable,
    data: parsed.data,
  };
}

async function fetchGuides(guide: LocationGuideType, slug?: string): Promise<DbLocationGuide[]> {
  try {
    let query = createSupabaseServerClient().from(LOCATION_GUIDES_TABLE)
      .select("guide_type,slug,indexable,data")
      .eq("guide_type", guide)
      .eq("published", true)
      .order("created_at", { ascending: true });
    if (slug) query = query.eq("slug", slug);
    const { data, error } = await query;
    if (error) {
      console.error(`could not load ${guide} location guides`, error);
      return [];
    }
    return ((data ?? []) as GuideRow[]).map(toGuide).filter((g): g is DbLocationGuide => g !== null);
  } catch (err) {
    console.error(`location_guides read threw for ${guide}`, err);
    return [];
  }
}

export const getDbLocationGuides = cachePublicContent(
  (guide: LocationGuideType) => fetchGuides(guide),
  ["db-location-guides"],
);

export const getDbLocationGuide = cachePublicContent(
  async (guide: LocationGuideType, slug: string) => (await fetchGuides(guide, slug))[0] ?? null,
  ["db-location-guide"],
);

function baseFields(g: DbLocationGuide) {
  const { guideSection: _section, ...rest } = g.data;
  void _section;
  return { ...rest, slug: g.slug, canonicalPath: g.canonicalPath, published: g.indexable };
}

export function asCouplesLocation(g: DbLocationGuide): CouplesLocationData {
  return { ...baseFields(g), movementInteraction: g.data.guideSection };
}

export function asFamilyLocation(g: DbLocationGuide): FamilyLocationData {
  return { ...baseFields(g), familyConsiderations: g.data.guideSection };
}

export function asPortraitLocation(g: DbLocationGuide): PortraitLocationData {
  return { ...baseFields(g), posingDirection: g.data.guideSection };
}
