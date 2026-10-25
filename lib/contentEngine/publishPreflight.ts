// Location-aware publish guards, run before the transactional RPC. The RPC
// cannot see the hand-written guide registries, so these checks live here:
//   journal_post   → no link to a location guide that is not live, and no
//                    link to a blog post that no longer exists
//   guide_photo    → the target page exists (static or published database guide)
//   location_guide → the slug/place is not already a hand-written page
import type { SupabaseClient } from "@supabase/supabase-js";
import { brokenGuideLinks } from "@/lib/contentEngine/guideLinks";
import { missingBlogLinks } from "@/lib/contentEngine/relatedPosts";
import { loadPublishedDbGuides } from "@/lib/locations/registry";
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

/** A reason to block publishing, or null when the item may go live. */
export async function publishBlockReason(
  client: SupabaseClient, contentType: string, payload: Record<string, unknown>,
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
    return missing.length
      ? `this post links to a blog post that no longer exists (${missing.join(", ")}) — remove that link first`
      : null;
  }
  if (contentType === "guide_photo" && isLocationGuideType(payload.guide)) {
    const slug = String(payload.location_key);
    return guideExists(payload.guide, slug, await loadPublishedDbGuides(client))
      ? null
      : `the ${payload.guide} guide page "${slug}" does not exist or is not published`;
  }
  return null;
}
