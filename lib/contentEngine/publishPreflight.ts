// Location-aware publish guards, run before the transactional RPC. The RPC
// cannot see the hand-written guide registries, so these checks live here:
//   journal_post   → no link to a location guide that is not live, no link
//                    to a blog post that no longer exists, and no named place
//                    the session was not photographed at
//   guide_photo    → the target page exists (static or published database guide)
//   location_guide → the slug/place is not already a hand-written page
import type { SupabaseClient } from "@supabase/supabase-js";
import { brokenGuideLinks } from "@/lib/contentEngine/guideLinks";
import { missingBlogLinks } from "@/lib/contentEngine/relatedPosts";
import { builtInSchool } from "@/lib/contentEngine/schools";
import { unsupportedPlaceMentions, type SessionPlaceContext } from "@/lib/contentEngine/placeMentions";
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

// The session's live recorded locations (Chris may add one after generation)
// plus its school, from the session row and the package snapshot.
async function sessionPlaceContext(client: SupabaseClient, packageId: string): Promise<SessionPlaceContext> {
  const { data: pkg, error } = await client.from("session_content_packages")
    .select("photography_session_id,session_facts_snapshot").eq("id", packageId).single();
  if (error || !pkg) throw new Error(`could not load package for place check: ${error?.message ?? "missing"}`);
  const { data: session, error: sErr } = await client.from("photography_sessions")
    .select("primary_location,secondary_locations,school_slug").eq("id", pkg.photography_session_id).single();
  if (sErr || !session) throw new Error(`could not load session for place check: ${sErr?.message ?? "missing"}`);
  const facts = (pkg.session_facts_snapshot ?? {}) as Record<string, unknown>;
  const school = builtInSchool(String(session.school_slug ?? facts.school_slug ?? ""));
  return {
    locations: [
      ...strings([session.primary_location, facts.primary_location]),
      ...strings(session.secondary_locations), ...strings(facts.secondary_locations),
    ],
    schoolNames: strings([facts.school_name, facts.school_short_name, school?.name, school?.shortName, ...(school?.aliases ?? [])]),
  };
}

async function unsupportedPlaceReason(
  client: SupabaseClient, packageId: string, payload: Record<string, unknown>,
): Promise<string | null> {
  const [ctx, places] = await Promise.all([sessionPlaceContext(client, packageId), loadKnownPlaces(client)]);
  const texts = strings([payload.title, payload.body, payload.meta_description]);
  const named = unsupportedPlaceMentions(texts, ctx, places);
  return named.length
    ? `this post names ${named.join(", ")}, which is not one of this session's locations — remove it from the post, or add it to the session's locations in Session facts if you photographed there`
    : null;
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
