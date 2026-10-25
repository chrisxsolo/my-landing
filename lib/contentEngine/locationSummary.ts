// What the admin Location panel shows for one session: the resolved place (or
// why it needs confirmation), the guide page that covers it, and any open
// new-guide proposal. Plain JSON — the route returns it as-is.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnownPlace } from "@/lib/locations/places";
import { guideSlugForPlace, guideLocationPath, type LocationGuideType } from "@/lib/locations/guideCoverage";
import {
  confirmationMessage, findOpenProposal, guideForSession, loadSessionLocation,
  locationGuideTypeFor, type OpenProposal,
} from "@/lib/contentEngine/sessionLocation";

export interface PlaceDto {
  key: string;
  name: string;
  city: string;
  county: string;
  state: string;
  searchArea: string;
}

export interface LocationSummaryDto {
  sessionLocation: string | null;
  status: "verified" | "needs_confirmation";
  reason: string | null;
  message: string;
  place: PlaceDto | null;
  source: "session_location" | "gps" | null;
  gpsDistanceMeters: number | null;
  candidates: PlaceDto[];
  visualHints: string[];
  guide: LocationGuideType | null;
  existingGuide: { slug: string; url: string; source: "static" | "db" } | null;
  proposedGuide: { slug: string; url: string } | null;
  openProposal: OpenProposal | null;
}

const placeDto = (p: KnownPlace): PlaceDto => ({
  key: p.key, name: p.name, city: p.city, county: p.county, state: p.state, searchArea: p.searchArea,
});

export async function buildLocationSummary(
  client: SupabaseClient, sessionId: string,
): Promise<LocationSummaryDto | null> {
  const { data: session, error } = await client.from("photography_sessions")
    .select("primary_location,service_type").eq("id", sessionId).maybeSingle();
  if (error) throw new Error(`could not load session: ${error.message}`);
  if (!session) return null;

  const text = (session.primary_location as string | null)?.trim() || null;
  const location = await loadSessionLocation(client, sessionId, text);
  const guide = locationGuideTypeFor(session.service_type);
  const r = location.resolution;
  const base = {
    sessionLocation: text, guide,
    existingGuide: null, proposedGuide: null, openProposal: null,
  };

  if (r.status !== "verified") {
    return {
      ...base, status: "needs_confirmation", reason: r.reason, message: confirmationMessage(r),
      place: null, source: null, gpsDistanceMeters: null,
      candidates: r.candidates.map(placeDto), visualHints: r.visualHints,
    };
  }

  const match = guide ? guideForSession(location, guide) : null;
  const slug = guideSlugForPlace(r.place);
  return {
    ...base, status: "verified", reason: null,
    message: `${r.place.name} — ${r.place.city}, ${r.place.county}`,
    place: placeDto(r.place), source: r.source, gpsDistanceMeters: r.gpsDistanceMeters,
    candidates: [], visualHints: [],
    existingGuide: match ? { slug: match.slug, url: match.url, source: match.source } : null,
    proposedGuide: guide && !match ? { slug, url: guideLocationPath(guide, slug) } : null,
    openProposal: guide && !match ? await findOpenProposal(client, guide, r.place.key) : null,
  };
}
