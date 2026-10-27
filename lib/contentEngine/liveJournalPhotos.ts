// Live photo management for an ALREADY-published journal post, addressed by
// its engine item id. The work itself lives in lib/blog/publishedImages.ts
// (keyed by blog post id, shared with the legacy BlogTab): the live blog_posts
// row is the source of truth, removal edits that row directly, and the engine
// item's saved selection is re-derived from it. The storage file and the
// session photo are never touched.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadPostImageInventory, PostImagesError, removePostGalleryImage, replacePostCover, syncEnginePayload,
  type PostImageInventory, type RemoveGalleryImageResult, type ReplaceCoverResult,
} from "@/lib/blog/publishedImages";
import type { LiveJournalPhoto } from "@/lib/contentEngine/journalPhotoMembership";

export { PostImagesError as JournalPhotosError };

const CONTENT_ITEMS = "session_content_items";

export type LiveJournalPhotosResult = PostImageInventory;

/** The live blog post id behind a published journal item. */
export async function publishedPostIdFor(client: SupabaseClient, itemId: string): Promise<number> {
  const { data: item, error } = await client.from(CONTENT_ITEMS)
    .select("id,content_type,status,published_target_type,published_target_id")
    .eq("id", itemId).maybeSingle();
  if (error || !item) throw new PostImagesError("content item not found", 404);
  if (item.content_type !== "journal_post") throw new PostImagesError("only journal posts have a photo gallery");
  if (item.status !== "published" || item.published_target_type !== "blog_post" || !item.published_target_id) {
    throw new PostImagesError("this journal post is not live");
  }
  return Number(item.published_target_id);
}

export async function getLiveJournalPhotos(client: SupabaseClient, itemId: string): Promise<LiveJournalPhotosResult> {
  return loadPostImageInventory(client, await publishedPostIdFor(client, itemId));
}

/**
 * Rewrites payload.photo_ids from the live row so the engine item mirrors the
 * page (the picker, Add photos, and any republish after takedown read it).
 */
export async function syncPayloadToLive(client: SupabaseClient, itemId: string): Promise<LiveJournalPhoto[]> {
  return syncEnginePayload(client, await publishedPostIdFor(client, itemId));
}

export async function removeJournalPhoto(
  client: SupabaseClient, itemId: string, url: string,
): Promise<RemoveGalleryImageResult> {
  return removePostGalleryImage(client, await publishedPostIdFor(client, itemId), url);
}

export async function replaceJournalCover(
  client: SupabaseClient, itemId: string, url: string, keepOldInGallery: boolean,
): Promise<ReplaceCoverResult> {
  return replacePostCover(client, { postId: await publishedPostIdFor(client, itemId), url, keepOldInGallery });
}
