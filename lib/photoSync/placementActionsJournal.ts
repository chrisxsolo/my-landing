// Journal placements of one photo: remove a gallery image from a post or swap
// the cover / a gallery image for another photo. Edits the live blog_posts row
// (the one source of truth for what the post shows) and its image_library
// mirror, then keeps the Content Engine item in step when the post was
// published by the engine. The storage file and session photo are untouched.
import type { SupabaseClient } from "@supabase/supabase-js";
import { removeGalleryUrl } from "@/lib/contentEngine/journalPhotoMembership";
import { syncPayloadToLive } from "@/lib/contentEngine/liveJournalPhotos";
import { PlacementActionError } from "@/lib/photoSync/placementErrors";

const BLOG_POSTS_TABLE = "blog_posts";
const IMAGE_LIBRARY_TABLE = "image_library";
const CONTENT_ITEMS_TABLE = "session_content_items";
const BLOG_POST_TARGET = "blog_post";

interface PostImages {
  id: number;
  slug: string;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  extra_image_urls: string[] | null;
  extra_image_alts: string[] | null;
}

async function loadPost(client: SupabaseClient, postId: number): Promise<PostImages> {
  const { data, error } = await client.from(BLOG_POSTS_TABLE)
    .select("id,slug,cover_image_url,cover_image_alt,extra_image_urls,extra_image_alts").eq("id", postId).maybeSingle();
  if (error) throw new Error(`could not load the post: ${error.message}`);
  if (!data) throw new PlacementActionError("journal post not found", 404);
  return data as PostImages;
}

async function savePost(client: SupabaseClient, postId: number, updates: Partial<PostImages>): Promise<void> {
  const { error } = await client.from(BLOG_POSTS_TABLE).update(updates).eq("id", postId);
  if (error) throw new Error(`could not update the post: ${error.message}`);
}

/** The engine item that published this post, if any, is re-synced from the live row. */
async function syncEngineItem(client: SupabaseClient, postId: number): Promise<void> {
  const { data, error } = await client.from(CONTENT_ITEMS_TABLE).select("id")
    .eq("published_target_type", BLOG_POST_TARGET).eq("published_target_id", String(postId)).limit(1);
  if (error) throw new Error(`could not find the post's engine item: ${error.message}`);
  const item = (data ?? [])[0] as { id: string } | undefined;
  if (item) await syncPayloadToLive(client, item.id);
}

export async function removeJournalGalleryPhoto(client: SupabaseClient, postId: number, url: string): Promise<string> {
  const post = await loadPost(client, postId);
  if (post.cover_image_url === url) throw new PlacementActionError("that is the post's cover — replace it instead of removing it");
  const next = removeGalleryUrl({ urls: post.extra_image_urls ?? [], alts: post.extra_image_alts ?? [] }, url);
  if (next.removed === 0) throw new PlacementActionError("that photo is not in this post's gallery", 404);
  await savePost(client, postId, { extra_image_urls: next.urls, extra_image_alts: next.alts });
  const { error } = await client.from(IMAGE_LIBRARY_TABLE).delete().eq("source_post_id", postId).eq("image_url", url);
  if (error) console.error(`[placements] image_library cleanup failed for post ${postId}`, error);
  await syncEngineItem(client, postId);
  return `Removed from the gallery of ${post.slug}`;
}

export async function replaceJournalPhoto(
  client: SupabaseClient, postId: number, role: "cover" | "gallery", url: string, newUrl: string, newAlt: string | null,
): Promise<string> {
  const post = await loadPost(client, postId);
  if (role === "cover") {
    if (post.cover_image_url !== url) throw new PlacementActionError("that photo is not this post's cover", 404);
    await savePost(client, postId, { cover_image_url: newUrl, ...(newAlt ? { cover_image_alt: newAlt } : {}) });
  } else {
    const urls = post.extra_image_urls ?? [];
    if (!urls.includes(url)) throw new PlacementActionError("that photo is not in this post's gallery", 404);
    const alts = post.extra_image_alts ?? [];
    await savePost(client, postId, {
      extra_image_urls: urls.map((u) => (u === url ? newUrl : u)),
      extra_image_alts: newAlt ? urls.map((u, i) => (u === url ? newAlt : alts[i] ?? "")) : alts,
    });
  }
  const { error } = await client.from(IMAGE_LIBRARY_TABLE).update({ image_url: newUrl })
    .eq("source_post_id", postId).eq("image_url", url);
  if (error) console.error(`[placements] image_library update failed for post ${postId}`, error);
  await syncEngineItem(client, postId);
  return `Replaced the ${role} photo of ${post.slug}`;
}
