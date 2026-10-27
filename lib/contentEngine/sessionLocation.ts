// Location intelligence for one session: gathers the evidence (entered
// location → photo GPS → analysis tags as hints only), resolves it to a known
// place, and derives everything location-dependent the generators need —
// which guide covers the place, which location links are allowed, and the
// pending link for a guide that does not exist yet. All deterministic; no AI.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveLocation, medianCoordinates, type Coordinates, type LocationResolution,
} from "@/lib/locations/match";
import type { KnownPlace } from "@/lib/locations/places";
import {
  findGuideForPlace, guideSlugForPlace, isLocationGuideType, parseGuideLocationPath,
  GUIDE_LABEL, LOCATION_GUIDE_TYPES, type DbGuideRef, type GuideMatch, type LocationGuideType,
} from "@/lib/locations/guideCoverage";
import { loadKnownPlaces, loadPublishedDbGuides } from "@/lib/locations/registry";
import { guideTypeForService, internalLinksForService, type ServiceType } from "@/lib/contentEngine/taxonomy";
import type { PendingGuideLink, SessionFactsSnapshot } from "@/lib/contentEngine/payloads";
import { fetchAllPages } from "@/lib/supabasePaging";

export interface SessionLocation {
  resolution: LocationResolution;
  places: KnownPlace[];
  dbGuides: DbGuideRef[];
}

const HINT_COUNT = 6;
const OPEN_PROPOSAL_STATUSES = ["draft", "approved", "failed", "publishing"];

/** Most frequent analysis tags — displayed as hints, never used as identity. */
export function topTags(tagLists: string[][], count = HINT_COUNT): string[] {
  const freq = new Map<string, number>();
  for (const tags of tagLists) {
    for (const tag of new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))) {
      freq.set(tag, (freq.get(tag) ?? 0) + 1);
    }
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, count).map(([tag]) => tag);
}

// Every photo counts: the median GPS of a partial read (a session past the
// 1000-row cap) can name another place.
async function photoEvidence(client: SupabaseClient, sessionId: string) {
  const rows = await fetchAllPages<{ gps_latitude: unknown; gps_longitude: unknown; tags: string[] | null }>(
    (from, to) => client.from("session_photos")
      .select("id,gps_latitude,gps_longitude,tags")
      .eq("photography_session_id", sessionId)
      .eq("excluded", false)
      .order("id").range(from, to),
    "photo location evidence",
  );
  const points: Coordinates[] = rows
    .filter((r) => typeof r.gps_latitude === "number" && typeof r.gps_longitude === "number")
    .map((r) => ({ latitude: r.gps_latitude as number, longitude: r.gps_longitude as number }));
  return {
    gps: medianCoordinates(points),
    hints: topTags(rows.map((r) => (r.tags ?? []) as string[])),
  };
}

export async function loadSessionLocation(
  client: SupabaseClient, sessionId: string, primaryLocation: string | null | undefined,
): Promise<SessionLocation> {
  const [places, dbGuides, evidence] = await Promise.all([
    loadKnownPlaces(client), loadPublishedDbGuides(client), photoEvidence(client, sessionId),
  ]);
  const resolution = resolveLocation(
    { sessionLocation: primaryLocation, gps: evidence.gps, visualHints: evidence.hints },
    places,
  );
  return { resolution, places, dbGuides };
}

/** The location-guide type this service publishes to (grads use campus spots). */
export function locationGuideTypeFor(serviceType: unknown): LocationGuideType | null {
  const guide = guideTypeForService(serviceType);
  return isLocationGuideType(guide) ? guide : null;
}

export function guideForSession(
  location: SessionLocation, guide: LocationGuideType,
): GuideMatch | null {
  if (location.resolution.status !== "verified") return null;
  return findGuideForPlace(guide, location.resolution.place.key, location.dbGuides);
}

export function pendingGuideLinkFor(place: KnownPlace, guide: LocationGuideType): PendingGuideLink {
  return {
    guide,
    location_key: place.key,
    place_name: place.name,
    slug: guideSlugForPlace(place),
    label: `${place.name} ${GUIDE_LABEL[guide].toLowerCase()} photography guide`,
    status: "pending",
  };
}

export interface AllowedLinks {
  /** URLs the generator may use. */
  urls: string[];
  /** Set when the session's own guide type has no page for this place yet. */
  pending: PendingGuideLink | null;
}

/**
 * Service links that are not location pages (hubs, pricing) are always
 * allowed. A location page is allowed ONLY when it covers the session's
 * verified place — never a "similar" place.
 */
export function allowedInternalLinks(
  serviceType: ServiceType, location: SessionLocation,
): AllowedLinks {
  const serviceLinks = internalLinksForService(serviceType);
  const general = serviceLinks.filter((l) => !parseGuideLocationPath(l));
  if (location.resolution.status !== "verified") return { urls: general, pending: null };

  const place = location.resolution.place;
  const guidesInScope = LOCATION_GUIDE_TYPES.filter((g) => serviceLinks.includes(`/${g}-guide`));
  const locationUrls = guidesInScope
    .map((g) => findGuideForPlace(g, place.key, location.dbGuides)?.url)
    .filter((u): u is string => !!u);

  const own = locationGuideTypeFor(serviceType);
  const pending = own && !findGuideForPlace(own, place.key, location.dbGuides)
    ? pendingGuideLinkFor(place, own)
    : null;
  return { urls: [...general, ...locationUrls], pending };
}

export interface OpenProposal {
  itemId: string;
  status: string;
  sessionId: string;
}

/** A not-yet-terminal location_guide proposal for this place, in any live package. */
export async function findOpenProposal(
  client: SupabaseClient, guide: LocationGuideType, locationKey: string,
): Promise<OpenProposal | null> {
  const { data, error } = await client.from("session_content_items")
    .select("id,status,session_content_packages!inner(photography_session_id,archived_at)")
    .eq("content_type", "location_guide")
    .eq("payload->>guide", guide)
    .eq("payload->>location_key", locationKey)
    .in("status", OPEN_PROPOSAL_STATUSES)
    .is("session_content_packages.archived_at", null)
    .limit(1);
  if (error) throw new Error(`could not check for an existing guide proposal: ${error.message}`);
  const row = data?.[0];
  if (!row) return null;
  const pkg = row.session_content_packages as unknown as { photography_session_id: string };
  return { itemId: row.id as string, status: row.status as string, sessionId: pkg.photography_session_id };
}

/** Plain-language reason a location could not be used, for skip notes and the UI. */
export function confirmationMessage(resolution: LocationResolution): string {
  if (resolution.status === "verified") return "";
  switch (resolution.reason) {
    case "missing":
      return "No session location — add it in Session facts (photo analysis alone never identifies a place).";
    case "unrecognized":
      return `"${resolution.text}" is not a verified location yet — confirm its city and county in the Location panel.`;
    case "ambiguous":
      return `"${resolution.text}" matches more than one place — pick the right one in the Location panel.`;
    case "conflict":
      return `Photo GPS disagrees with "${resolution.text}" — confirm the location in the Location panel.`;
  }
}

/** Facts about the verified place that prompts may state. Nothing else is allowed. */
export function verifiedPlaceBlock(location: SessionLocation): string {
  if (location.resolution.status !== "verified") {
    return "Verified location: NONE. Do not name a city, county, or landmark the session facts do not state.";
  }
  const p = location.resolution.place;
  const facts = p.verifiedFacts.length ? p.verifiedFacts.map((f) => `- ${f}`).join("\n") : "- (none)";
  return (
    `Verified location (the ONLY geography you may state): ${p.name} — ${p.city}, ${p.county}, ${p.state}. ` +
    `People search for this area as "${p.searchArea}". Never place this session in any other city or region.\n` +
    `Photographer-verified practical facts (parking, access, permits — only these may be stated):\n${facts}`
  );
}

export function keywordGeography(facts: SessionFactsSnapshot, location: SessionLocation | null) {
  if (location?.resolution.status === "verified") {
    const p = location.resolution.place;
    return { placeName: p.name, searchArea: p.searchArea };
  }
  return { placeName: facts.primary_location?.trim() || null, searchArea: null };
}
