// Server-side location registry: the code gazetteer merged with places the
// photographer confirmed from the admin (verified_locations), plus the
// published database guides. Code places win on geography; a database row
// with a code place's key only contributes extra aliases.
import type { SupabaseClient } from "@supabase/supabase-js";
import { KNOWN_PLACES, type KnownPlace } from "@/lib/locations/places";
import { isLocationGuideType, type DbGuideRef } from "@/lib/locations/guideCoverage";

export const VERIFIED_LOCATIONS_TABLE = "verified_locations";
export const LOCATION_GUIDES_TABLE = "location_guides";

interface VerifiedLocationRow {
  key: string;
  name: string;
  aliases: string[] | null;
  city: string;
  county: string;
  state: string;
  search_area: string;
  region: string;
  area_terms: string[] | null;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number | null;
  verified_facts: string[] | null;
}

export function placeFromRow(row: VerifiedLocationRow): KnownPlace {
  return {
    key: row.key,
    name: row.name,
    aliases: row.aliases ?? [],
    city: row.city,
    county: row.county,
    state: row.state,
    searchArea: row.search_area,
    region: row.region,
    areaTerms: row.area_terms ?? [],
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    radiusMeters: row.radius_meters ?? undefined,
    verifiedFacts: row.verified_facts ?? [],
  };
}

/** Code places + database places; database aliases/facts extend code places. */
export function mergePlaces(code: readonly KnownPlace[], db: readonly KnownPlace[]): KnownPlace[] {
  const byKey = new Map(db.map((p) => [p.key, p]));
  const merged = code.map((place) => {
    const extra = byKey.get(place.key);
    if (!extra) return place;
    return {
      ...place,
      aliases: [...new Set([...place.aliases, extra.name, ...extra.aliases])]
        .filter((a) => a !== place.name),
      verifiedFacts: [...new Set([...place.verifiedFacts, ...extra.verifiedFacts])],
    };
  });
  const codeKeys = new Set(code.map((p) => p.key));
  return [...merged, ...db.filter((p) => !codeKeys.has(p.key))];
}

export async function loadKnownPlaces(client: SupabaseClient): Promise<KnownPlace[]> {
  const { data, error } = await client.from(VERIFIED_LOCATIONS_TABLE).select("*");
  if (error) throw new Error(`could not load verified locations: ${error.message}`);
  return mergePlaces(KNOWN_PLACES, ((data ?? []) as VerifiedLocationRow[]).map(placeFromRow));
}

/** Published database guides (all guide types), for coverage checks. */
export async function loadPublishedDbGuides(client: SupabaseClient): Promise<DbGuideRef[]> {
  const { data, error } = await client.from(LOCATION_GUIDES_TABLE)
    .select("guide_type,slug,location_key,data")
    .eq("published", true);
  if (error) throw new Error(`could not load location guides: ${error.message}`);
  return (data ?? [])
    .filter((r) => isLocationGuideType(r.guide_type))
    .map((r) => ({
      guide: r.guide_type,
      slug: r.slug as string,
      locationKey: r.location_key as string,
      name: ((r.data as { name?: string } | null)?.name) ?? (r.slug as string),
    }));
}
