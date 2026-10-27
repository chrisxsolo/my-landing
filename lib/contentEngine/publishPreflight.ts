// Location-aware publish guards, run before the transactional RPC. The RPC
// cannot see the hand-written guide registries, so these checks live here:
//   journal_post   → no link to a location guide that is not live, no link
//                    to a blog post that no longer exists, and no named place
//                    the session was not photographed at (current Session
//                    facts first, snapshot only as a fallback)
//   guide_photo    → the target page exists (static or published database guide)
//   location_guide → the slug/place is not already a hand-written page
import type { SupabaseClient } from "@supabase/supabase-js";
import { brokenGuideLinks } from "@/lib/contentEngine/guideLinks";
import { missingBlogLinks } from "@/lib/contentEngine/relatedPosts";
import { builtInSchool } from "@/lib/contentEngine/schools";
import {
  describePlaceIssues, findPlaceIssues, placeContextFor, type LocationFacts, type ResolvedPlaceContext,
} from "@/lib/contentEngine/placeMentions";
import { loadKnownPlaces, loadPublishedDbGuides } from "@/lib/locations/registry";
import {
  collidesWithStaticGuide, isLocationGuideType, parseGuideLocationPath, staticGuideSlugs,
  type DbGuideRef, type LocationGuideType,
} from "@/lib/locations/guideCoverage";

function guideExists(guide: LocationGuideType, slug: string, dbGuides: readonly DbGuideRef[]): boolean {
  return staticGuideSlugs(guide).includes(slug) || dbGuides.some((g) => g.guide === guide && g.slug === slug);
}

export function liveGuidePathChecker(dbGuides: readonly DbGuideRef[]) {
  return (path: string) => {
    const parsed = parseGuideLocationPath(path);
    return parsed !== null && guideExists(parsed.guide, parsed.slug, dbGuides);
  };
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

const PACKAGES_TABLE = "session_content_packages";
const SESSIONS_TABLE = "photography_sessions";
const PHOTOS_TABLE = "session_photos";
const CHECKED_FIELDS = ["title", "body", "meta_description"] as const;

// A session row or a session-facts snapshot: both carry the same location fields.
function locationFacts(row: Record<string, unknown>): LocationFacts {
  const slug = typeof row.school_slug === "string" ? row.school_slug : null;
  const school = slug ? builtInSchool(slug) : null;
  return {
    locations: strings([row.primary_location, ...strings(row.secondary_locations)]),
    schoolSlug: slug,
    schoolNames: strings([
      row.school_name, row.school_short_name, school?.name, school?.shortName, ...(school?.aliases ?? []),
    ]),
  };
}

// Confirmed shooting locations (session_photos.photo_location) of the photos this post shows.
async function postPhotoLocations(
  client: SupabaseClient, sessionId: string, payload: Record<string, unknown>,
): Promise<string[]> {
  const ids = [...new Set(strings([...strings(payload.photo_ids), payload.cover_photo_id]))];
  if (ids.length === 0) return [];
  const { data, error } = await client.from(PHOTOS_TABLE).select("photo_location")
    .eq("photography_session_id", sessionId).in("id", ids).not("photo_location", "is", null);
  if (error) throw new Error(`could not load photo locations for place check: ${error.message}`);
  return strings((data ?? []).map((r) => r.photo_location));
}

// The live session's facts decide; the package snapshot is only a fallback
// for a session with no location facts at all (see placeContextFor).
async function sessionPlaceContext(
  client: SupabaseClient, packageId: string, payload: Record<string, unknown>,
): Promise<ResolvedPlaceContext> {
  const { data: pkg, error } = await client.from(PACKAGES_TABLE)
    .select("photography_session_id,session_facts_snapshot").eq("id", packageId).single();
  if (error || !pkg) throw new Error(`could not load package for place check: ${error?.message ?? "missing"}`);
  const sessionId = pkg.photography_session_id as string;
  const { data: session, error: sErr } = await client.from(SESSIONS_TABLE)
    .select("primary_location,secondary_locations,school_slug").eq("id", sessionId).single();
  if (sErr || !session) throw new Error(`could not load session for place check: ${sErr?.message ?? "missing"}`);
  const photoLocations = await postPhotoLocations(client, sessionId, payload);
  const snapshot = (pkg.session_facts_snapshot ?? {}) as Record<string, unknown>;
  return placeContextFor(locationFacts(session), photoLocations, locationFacts(snapshot));
}

async function unsupportedPlaceReason(
  client: SupabaseClient, packageId: string, payload: Record<string, unknown>,
): Promise<string | null> {
  const [ctx, places] = await Promise.all([
    sessionPlaceContext(client, packageId, payload), loadKnownPlaces(client),
  ]);
  const fields = CHECKED_FIELDS
    .filter((field) => typeof payload[field] === "string")
    .map((field) => ({ field, text: payload[field] as string }));
  const issues = findPlaceIssues(fields, ctx, places);
  return issues.length ? describePlaceIssues(issues, ctx) : null;
}

/** A reason to block publishing, or null when the item may go live. */
export async function publishBlockReason(
  client: SupabaseClient, contentType: string, payload: Record<string, unknown>, packageId?: string,
): Promise<string | null> {
  if (contentType === "location_guide") {
    const guide = payload.guide;
    if (!isLocationGuideType(guide)) return "location guide has an invalid guide type";
    return collidesWithStaticGuide(guide, String(payload.slug), String(payload.location_key))
      ? `a hand-written ${guide} guide page already covers ${String(payload.slug)}`
      : null;
  }
  if (contentType === "journal_post") {
    const broken = brokenGuideLinks(
      payload as { body: string; internal_links?: { url: string; label: string }[] },
      liveGuidePathChecker(await loadPublishedDbGuides(client)),
    );
    if (broken.length) {
      return `this post links to a location guide that is not live yet (${broken.join(", ")}) — publish or remove that guide first`;
    }
    const missing = await missingBlogLinks(client, String(payload.body ?? ""));
    if (missing.length) {
      return `this post links to a blog post that no longer exists (${missing.join(", ")}) — remove that link first`;
    }
    return packageId ? unsupportedPlaceReason(client, packageId, payload) : null;
  }
  if (contentType === "guide_photo" && isLocationGuideType(payload.guide)) {
    const slug = String(payload.location_key);
    return guideExists(payload.guide, slug, await loadPublishedDbGuides(client))
      ? null
      : `the ${payload.guide} guide page "${slug}" does not exist or is not published`;
  }
  return null;
}
