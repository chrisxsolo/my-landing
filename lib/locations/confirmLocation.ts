// Photographer confirmation of a session location (the "request confirmation
// instead of guessing" path). Either the typed name becomes an alias of an
// existing place, or a new verified place is recorded with its real city and
// county. Both write verified_locations; nothing is inferred.
import type { SupabaseClient } from "@supabase/supabase-js";
import { matchPlacesByName, slugifyPlace } from "@/lib/locations/match";
import type { KnownPlace } from "@/lib/locations/places";
import { VERIFIED_LOCATIONS_TABLE, loadKnownPlaces } from "@/lib/locations/registry";

export class LocationConfirmError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409) {
    super(message);
    this.name = "LocationConfirmError";
  }
}

export interface NewPlaceInput {
  name: string;
  city: string;
  county: string;
  searchArea?: string;
  region?: string;
  aliases?: string[];
  latitude?: number | null;
  longitude?: number | null;
}

const clean = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function countyName(county: string): string {
  return /county$/i.test(county) ? county : `${county} County`;
}

export function parseNewPlaceInput(body: Record<string, unknown>): NewPlaceInput {
  const name = clean(body.name);
  const city = clean(body.city);
  const county = clean(body.county);
  if (!name || !city || !county) throw new LocationConfirmError("name, city, and county are required", 400);
  const coord = (v: unknown, limit: number) =>
    typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= limit ? v : null;
  return {
    name, city, county: countyName(county),
    searchArea: clean(body.searchArea) || city,
    region: clean(body.region) || countyName(county),
    aliases: Array.isArray(body.aliases) ? body.aliases.map((a) => clean(a)).filter(Boolean).slice(0, 10) : [],
    latitude: coord(body.latitude, 90),
    longitude: coord(body.longitude, 180),
  };
}

function rowFor(place: KnownPlace) {
  return {
    key: place.key, name: place.name, aliases: place.aliases, city: place.city,
    county: place.county, state: place.state, search_area: place.searchArea,
    region: place.region, area_terms: place.areaTerms,
    latitude: place.latitude ?? null, longitude: place.longitude ?? null,
    radius_meters: place.radiusMeters ?? null, verified_facts: place.verifiedFacts,
  };
}

/** Names already owned by another place make the new place ambiguous — refuse. */
function assertNamesFree(names: string[], places: readonly KnownPlace[], exceptKey?: string) {
  for (const name of names) {
    const owner = matchPlacesByName(name, places).find((p) => p.key !== exceptKey);
    if (owner) {
      throw new LocationConfirmError(
        `"${name}" already names ${owner.name} (${owner.city}) — link to it instead`, 409,
      );
    }
  }
}

export async function confirmNewPlace(
  client: SupabaseClient, input: NewPlaceInput, sessionText: string | null,
): Promise<KnownPlace> {
  const places = await loadKnownPlaces(client);
  const aliases = [...new Set([...(input.aliases ?? []), ...(sessionText ? [sessionText] : [])])]
    .filter((a) => a.toLowerCase() !== input.name.toLowerCase());
  assertNamesFree([input.name, ...aliases], places);

  const taken = new Set(places.map((p) => p.key));
  let key = slugifyPlace(input.name);
  if (taken.has(key)) key = `${key}-${slugifyPlace(input.city)}`;
  if (!key || taken.has(key)) throw new LocationConfirmError(`a place with key ${key} already exists`, 409);

  const place: KnownPlace = {
    key, name: input.name, aliases, city: input.city, county: input.county, state: "CA",
    searchArea: input.searchArea ?? input.city, region: input.region ?? input.county,
    areaTerms: [], verifiedFacts: [],
    latitude: input.latitude ?? undefined, longitude: input.longitude ?? undefined,
  };
  const { error } = await client.from(VERIFIED_LOCATIONS_TABLE).insert(rowFor(place));
  if (error) throw new Error(`could not save verified location: ${error.message}`);
  return place;
}

/** Records the session's typed name as another name for an existing place. */
export async function linkToExistingPlace(
  client: SupabaseClient, key: string, sessionText: string,
): Promise<KnownPlace> {
  const places = await loadKnownPlaces(client);
  const place = places.find((p) => p.key === key);
  if (!place) throw new LocationConfirmError(`unknown place ${key}`, 404);
  assertNamesFree([sessionText], places, key);

  const { data: existing, error: readErr } = await client.from(VERIFIED_LOCATIONS_TABLE)
    .select("aliases").eq("key", key).maybeSingle();
  if (readErr) throw new Error(`could not read verified location: ${readErr.message}`);
  const aliases = [...new Set([...((existing?.aliases as string[] | null) ?? []), sessionText])];
  const { error } = existing
    ? await client.from(VERIFIED_LOCATIONS_TABLE).update({ aliases }).eq("key", key)
    : await client.from(VERIFIED_LOCATIONS_TABLE).insert({ ...rowFor(place), aliases });
  if (error) throw new Error(`could not save alias: ${error.message}`);
  return { ...place, aliases: [...new Set([...place.aliases, sessionText])] };
}
