// Edits ONE placement of a photo: remove it there, replace it there with
// another photo, or add the photo somewhere it is eligible. Every edit goes
// through the store that already owns that placement (page curation, spot
// tags, the guide RPC, the location library's validated update…), so the
// rules those editors enforce hold here too. Nothing here deletes a media
// record: a Portfolio row is unpublished, a guide row is unpublished, a spot
// is cleared, a setting is removed. Server-only, service role.
import type { SupabaseClient } from "@supabase/supabase-js";
import { releaseAutoRow } from "@/lib/campusSpotFill/store";
import type { LocationGuideType } from "@/lib/locations/guideCoverage";
import { GUIDE_PHOTO_TABLE } from "@/lib/guidePhotoLibrary/load";
import { updateLocation } from "@/lib/locationLibrary/adminEdit";
import { buildPageView } from "@/lib/pagePhotos/adminView";
import { applyCuration } from "@/lib/pagePhotos/curationStore";
import { setSpotTag } from "@/lib/pagePhotos/spotTagStore";
import { isPageKey } from "@/lib/pagePhotos/pageKeys";
import { isEditableSettingKey, type EditableSettingKey } from "@/lib/siteSettingsShared";
import { loadPostImageRow, PostImagesError, removePostGalleryImage, replacePostCover } from "@/lib/blog/publishedImages";
import { loadEngineFacts } from "@/lib/photoSync/placementLoad";
import { PlacementActionError } from "@/lib/photoSync/placementErrors";
import type { PlacementTarget } from "@/lib/photoSync/placements";

export { PlacementActionError };

/** Where a photo can be ADDED (each one an endpoint that already exists). */
export type AddTarget =
  | { kind: "page"; pageKey: string }
  | { kind: "site-slot"; key: EditableSettingKey }
  | { kind: "campus-spot"; spotId: number }
  | { kind: "guide"; guide: LocationGuideType; slug: string; sessionPhotoId: string };

export type PlacementEdit =
  | { action: "remove"; target: PlacementTarget; url: string }
  | { action: "replace"; target: PlacementTarget; url: string; newUrl: string; newAlt: string | null }
  | { action: "add"; target: AddTarget; url: string };

const PORTFOLIO_IMAGES_TABLE = "portfolio_images";
const SCHOOL_PAGE_PHOTOS_TABLE = "school_page_photos";
const LOCATION_SPOTS_TABLE = "location_spots";
const SITE_SETTINGS_TABLE = "site_settings";
const CASE_STUDIES_TABLE = "portfolio_case_studies";
const ATTACH_GUIDE_PHOTO_RPC = "attach_existing_guide_photo";

function ensure(error: { message: string } | null, what: string): void {
  if (error) throw new Error(`could not ${what}: ${error.message}`);
}

/** Updates one row by id, insisting it still shows the URL being edited (another edit may have raced). */
async function updateShowing(
  client: SupabaseClient, table: string, id: string | number, urlColumn: string, url: string, updates: Record<string, unknown>, what: string,
): Promise<void> {
  const { data, error } = await client.from(table).update(updates).eq("id", id).eq(urlColumn, url).select("id");
  ensure(error, what);
  if (!data || data.length === 0) throw new PlacementActionError("that placement no longer shows this photo", 409);
}

/** The same rule as the Page Photos editor: only a photo the page could show may be pinned. */
async function pinEligible(client: SupabaseClient, pageKey: string, url: string): Promise<void> {
  if (!isPageKey(pageKey)) throw new PlacementActionError("page must be a page key like grads/sjsu", 400);
  const view = await buildPageView(client, pageKey);
  if (!view) throw new PlacementActionError("page not found", 404);
  const known = [...view.shown, ...view.overflow, ...view.hidden].some((p) => p.url === url);
  if (!known) throw new PlacementActionError("that photo is not eligible for this page");
  await applyCuration(client, pageKey, url, "pin");
}

async function removeFromPage(client: SupabaseClient, target: Extract<PlacementTarget, { kind: "page" }>, url: string): Promise<string> {
  if (target.explicitId) {
    const { error } = await client.from(SCHOOL_PAGE_PHOTOS_TABLE).update({ active: false }).eq("id", target.explicitId);
    ensure(error, "deactivate the school placement");
  }
  await applyCuration(client, target.pageKey, url, "hide");
  return `Hidden on ${target.pageKey}`;
}

async function heroCarousel(client: SupabaseClient, portfolioId: number, url: string, newUrl: string | null): Promise<string> {
  await updateShowing(client, PORTFOLIO_IMAGES_TABLE, portfolioId, "image_url", url, { hero_carousel: false }, "leave the hero carousel");
  if (!newUrl) return "Removed from the homepage hero carousel";
  const { data, error } = await client.from(PORTFOLIO_IMAGES_TABLE).update({ hero_carousel: true }).eq("image_url", newUrl).select("id");
  ensure(error, "add the new photo to the hero carousel");
  if (!data || data.length === 0) throw new PlacementActionError("the hero carousel only shows Portfolio photos — add that photo to the Portfolio first");
  return "Hero carousel photo replaced";
}

async function siteSlot(client: SupabaseClient, key: string, url: string | null, newUrl: string | null): Promise<string> {
  if (!isEditableSettingKey(key)) throw new PlacementActionError("unknown site photo slot", 400);
  if (newUrl) {
    const { error } = await client.from(SITE_SETTINGS_TABLE)
      .upsert({ key, value: newUrl, updated_at: new Date().toISOString() }, { onConflict: "key" });
    ensure(error, `save ${key}`);
    return `${key} now shows the chosen photo`;
  }
  const { error } = await client.from(SITE_SETTINGS_TABLE).delete().eq("key", key).eq("value", url);
  ensure(error, `clear ${key}`);
  return `${key} cleared — the slot falls back to its automatic photo`;
}

async function caseStudy(
  client: SupabaseClient, target: Extract<PlacementTarget, { kind: "case-study" }>, url: string, newUrl: string | null,
): Promise<string> {
  const { data, error } = await client.from(CASE_STUDIES_TABLE).select("cover_image_url,preview_image_urls").eq("id", target.caseStudyId).maybeSingle();
  ensure(error, "load the case study");
  if (!data) throw new PlacementActionError("case study not found", 404);
  if (target.field === "cover") {
    if (!newUrl) throw new PlacementActionError("a case study needs a cover — replace it instead of removing it");
    await updateShowing(client, CASE_STUDIES_TABLE, target.caseStudyId, "cover_image_url", url, { cover_image_url: newUrl }, "replace the case study cover");
    return "Case study cover replaced";
  }
  const previews = Array.isArray(data.preview_image_urls) ? (data.preview_image_urls as string[]) : [];
  if (!previews.includes(url)) throw new PlacementActionError("that photo is not a preview of this case study", 404);
  const next = newUrl ? previews.map((u) => (u === url ? newUrl : u)) : previews.filter((u) => u !== url);
  const { error: saveErr } = await client.from(CASE_STUDIES_TABLE).update({ preview_image_urls: next }).eq("id", target.caseStudyId);
  ensure(saveErr, "update the case study previews");
  return newUrl ? "Case study preview replaced" : "Removed from the case study previews";
}

async function featuredLocationPhoto(client: SupabaseClient, locationId: number, newUrl: string | null): Promise<string> {
  if (!newUrl) {
    await updateLocation(client, locationId, { featured_photo_id: null });
    return "Featured photo cleared — the location picks its own again";
  }
  const photo = (await loadEngineFacts(client, [newUrl])).get(newUrl);
  if (!photo) throw new PlacementActionError("a location's featured photo must be a Content Engine photo of that location");
  await updateLocation(client, locationId, { featured_photo_id: photo.photoId });
  return "Featured photo replaced";
}

/** The journal endpoints' refusals (status + message) shown as this inspector's own. */
async function journalEdit<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof PostImagesError) throw new PlacementActionError(err.message, err.status);
    throw err;
  }
}

// The journal endpoints (lib/blog/publishedImages) offer two edits: remove one
// gallery photo, or replace the cover together with the social image. A
// gallery or social-image swap is editor work, so it is refused here.
async function journalPlacement(
  client: SupabaseClient, target: Extract<PlacementTarget, { kind: "journal" }>, url: string, newUrl: string | null,
): Promise<string> {
  return journalEdit(async () => {
    if (!newUrl) {
      const result = await removePostGalleryImage(client, target.postId, url);
      return `Removed from the gallery of ${result.slug}`;
    }
    if (target.role !== "cover") throw new PlacementActionError("only the cover can be replaced here — edit the gallery in the post's editor");
    const post = await loadPostImageRow(client, target.postId);
    if (post.cover_image_url !== url) throw new PlacementActionError("that photo is no longer this post's cover", 409);
    const result = await replacePostCover(client, { postId: target.postId, url: newUrl, keepOldInGallery: false });
    return `Cover (and social image) of ${result.slug} replaced`;
  });
}

async function removePlacement(client: SupabaseClient, target: PlacementTarget, url: string): Promise<string> {
  switch (target.kind) {
    case "portfolio":
      await updateShowing(client, PORTFOLIO_IMAGES_TABLE, target.portfolioId, "image_url", url, { published: false }, "unpublish the portfolio photo");
      return "Unpublished from the Portfolio (the row is kept)";
    case "hero-carousel": return heroCarousel(client, target.portfolioId, url, null);
    case "page": return removeFromPage(client, target, url);
    case "campus-spot":
      await updateShowing(client, LOCATION_SPOTS_TABLE, target.spotId, "image_url", url, { image_url: null }, "clear the campus spot");
      return "Campus spot cleared";
    case "campus-spot-tag":
      await setSpotTag(client, target.schoolSlug, url, null);
      return "Spot tag removed";
    case "campus-spot-auto":
      await releaseAutoRow(client, { schoolSlug: target.schoolSlug, spotKey: target.spotKey, imageUrl: url, evidence: "text" });
      return "Automatic spot photo released — the next sync may pick another";
    case "guide":
      await updateShowing(client, GUIDE_PHOTO_TABLE[target.guide], target.rowId, "image_url", url, { published: false }, "unpublish the guide photo");
      return "Unpublished from the guide gallery (the row is kept)";
    case "journal": return journalPlacement(client, target, url, null);
    case "site-slot": return siteSlot(client, target.key, url, null);
    case "bay-area-location": return featuredLocationPhoto(client, target.locationId, null);
    case "case-study": return caseStudy(client, target, url, null);
  }
}

async function replacePlacement(
  client: SupabaseClient, target: PlacementTarget, url: string, newUrl: string, newAlt: string | null,
): Promise<string> {
  const alt = (column: string) => (newAlt ? { [column]: newAlt } : {});
  switch (target.kind) {
    case "portfolio":
      await updateShowing(client, PORTFOLIO_IMAGES_TABLE, target.portfolioId, "image_url", url, { image_url: newUrl, ...alt("alt") }, "replace the portfolio photo");
      return "Portfolio photo replaced";
    case "hero-carousel": return heroCarousel(client, target.portfolioId, url, newUrl);
    case "page":
      await removeFromPage(client, target, url);
      await pinEligible(client, target.pageKey, newUrl);
      return `Replaced on ${target.pageKey} (the new photo is pinned)`;
    case "campus-spot":
      await updateShowing(client, LOCATION_SPOTS_TABLE, target.spotId, "image_url", url, { image_url: newUrl }, "replace the campus spot photo");
      return "Campus spot photo replaced";
    case "guide":
      await updateShowing(client, GUIDE_PHOTO_TABLE[target.guide], target.rowId, "image_url", url, { image_url: newUrl, ...alt("alt_text") }, "replace the guide photo");
      return "Guide photo replaced";
    case "journal": return journalPlacement(client, target, url, newUrl);
    case "site-slot": return siteSlot(client, target.key, url, newUrl);
    case "bay-area-location": return featuredLocationPhoto(client, target.locationId, newUrl);
    case "case-study": return caseStudy(client, target, url, newUrl);
    case "campus-spot-tag":
    case "campus-spot-auto":
      throw new PlacementActionError("tagged and automatic spot photos are chosen by the tag or the sync — set the spot's photo in Campus Spots instead");
  }
}

async function addPlacement(client: SupabaseClient, target: AddTarget, url: string): Promise<string> {
  switch (target.kind) {
    case "page":
      await pinEligible(client, target.pageKey, url);
      return `Pinned on ${target.pageKey}`;
    case "site-slot": return siteSlot(client, target.key, null, url);
    case "campus-spot": {
      const { data, error } = await client.from(LOCATION_SPOTS_TABLE).update({ image_url: url }).eq("id", target.spotId).select("id");
      ensure(error, "set the campus spot photo");
      if (!data || data.length === 0) throw new PlacementActionError("campus spot not found", 404);
      return "Campus spot photo set";
    }
    case "guide": {
      const { error } = await client.rpc(ATTACH_GUIDE_PHOTO_RPC, {
        p_guide: target.guide, p_slug: target.slug, p_session_photo_id: target.sessionPhotoId, p_make_hero: false, p_publish: true,
      });
      if (error) {
        if (/not approved|marketing permission|not found/i.test(error.message)) throw new PlacementActionError(error.message);
        throw new Error(error.message);
      }
      return `Added to the ${target.guide} guide gallery`;
    }
  }
}

/** Performs one edit and says what happened. Throws PlacementActionError for a refused edit. */
export async function applyPlacementEdit(client: SupabaseClient, edit: PlacementEdit): Promise<string> {
  if (edit.action === "remove") return removePlacement(client, edit.target, edit.url);
  if (edit.action === "replace") {
    if (edit.newUrl === edit.url) throw new PlacementActionError("pick a different photo to replace this one");
    return replacePlacement(client, edit.target, edit.url, edit.newUrl, edit.newAlt);
  }
  return addPlacement(client, edit.target, edit.url);
}
