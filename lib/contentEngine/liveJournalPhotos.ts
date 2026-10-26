// Live photo management for an ALREADY-published journal post. The live
// blog_posts row is the source of truth (see journalPhotoMembership.ts): the
// editor lists exactly what the page shows — including photos later excluded
// from the session library and URLs added by hand — and removal edits that row
// directly. Removing only drops the post's association (gallery URL + its
// image_library row); the storage file and the session photo are untouched.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildLivePhotoList, photoIdsFromLive, removeGalleryUrl,
  type LiveJournalPhoto, type SessionPhotoMatch,
} from "@/lib/contentEngine/journalPhotoMembership";

export class JournalPhotosError extends Error {
  readonly status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.name = "JournalPhotosError";
    this.status = status;
  }
}

const BLOG_POSTS = "blog_posts";
const IMAGE_LIBRARY = "image_library";
const CONTENT_ITEMS = "session_content_items";

export interface PublishedJournal {
  itemId: string;
  payload: Record<string, unknown>;
  sessionId: string;
  post: {
    id: number; slug: string; title: string;
    cover_image_url: string | null; cover_image_alt: string | null;
    extra_image_urls: string[] | null; extra_image_alts: string[] | null;
  };
}

export interface LiveJournalPhotosResult {
  postId: number;
  slug: string;
  photos: LiveJournalPhoto[];
}

export async function loadPublishedJournal(client: SupabaseClient, itemId: string): Promise<PublishedJournal> {
  const { data: item, error } = await client.from(CONTENT_ITEMS)
    .select("id,content_type,status,payload,package_id,published_target_type,published_target_id")
    .eq("id", itemId).maybeSingle();
  if (error || !item) throw new JournalPhotosError("content item not found", 404);
  if (item.content_type !== "journal_post") throw new JournalPhotosError("only journal posts have a photo gallery");
  if (item.status !== "published" || item.published_target_type !== "blog_post" || !item.published_target_id) {
    throw new JournalPhotosError("this journal post is not live");
  }
  const { data: pkg } = await client.from("session_content_packages")
    .select("photography_session_id").eq("id", item.package_id).maybeSingle();
  if (!pkg) throw new JournalPhotosError("content package not found", 404);

  const { data: post, error: pErr } = await client.from(BLOG_POSTS)
    .select("id,slug,title,cover_image_url,cover_image_alt,extra_image_urls,extra_image_alts")
    .eq("id", Number(item.published_target_id)).maybeSingle();
  if (pErr || !post) throw new JournalPhotosError("published blog post not found", 404);

  return {
    itemId,
    payload: (item.payload ?? {}) as Record<string, unknown>,
    sessionId: pkg.photography_session_id as string,
    post: post as PublishedJournal["post"],
  };
}

/** Session photos whose public derivative is one of the live URLs. */
async function matchLiveUrls(client: SupabaseClient, journal: PublishedJournal): Promise<Map<string, SessionPhotoMatch>> {
  const urls = [journal.post.cover_image_url, ...(journal.post.extra_image_urls ?? [])]
    .filter((u): u is string => Boolean(u));
  if (urls.length === 0) return new Map();
  const { data, error } = await client.from("session_photos")
    .select("id,original_filename,excluded,public_derivative_url")
    .eq("photography_session_id", journal.sessionId)
    .in("public_derivative_url", urls);
  if (error) throw new JournalPhotosError(`could not match live photos: ${error.message}`, 500);
  return new Map((data ?? []).map((r) => [r.public_derivative_url as string, {
    id: r.id as string, original_filename: r.original_filename as string | null, excluded: Boolean(r.excluded),
  }]));
}

export async function getLiveJournalPhotos(client: SupabaseClient, itemId: string): Promise<LiveJournalPhotosResult> {
  const journal = await loadPublishedJournal(client, itemId);
  const photos = buildLivePhotoList(journal.post, await matchLiveUrls(client, journal));
  return { postId: journal.post.id, slug: journal.post.slug, photos };
}

/**
 * Rewrites payload.photo_ids from the live row so the engine item mirrors the
 * page (the picker, Add photos, and any republish after takedown read it).
 */
export async function syncPayloadToLive(client: SupabaseClient, itemId: string): Promise<LiveJournalPhoto[]> {
  const journal = await loadPublishedJournal(client, itemId);
  const live = buildLivePhotoList(journal.post, await matchLiveUrls(client, journal));
  const coverId = live.find((p) => p.role === "cover")?.photoId
    ?? (typeof journal.payload.cover_photo_id === "string" ? journal.payload.cover_photo_id : null);
  const { error } = await client.from(CONTENT_ITEMS)
    .update({ payload: { ...journal.payload, photo_ids: photoIdsFromLive(coverId, live) } })
    .eq("id", itemId);
  if (error) throw new JournalPhotosError(`could not sync the engine item: ${error.message}`, 500);
  return live;
}

export interface RemoveJournalPhotoResult {
  slug: string;
  removed: number;
  remaining: number;
}

export async function removeJournalPhoto(
  client: SupabaseClient, itemId: string, url: string,
): Promise<RemoveJournalPhotoResult> {
  const journal = await loadPublishedJournal(client, itemId);
  const { post } = journal;
  if (post.cover_image_url === url) {
    throw new JournalPhotosError("that is the cover photo — the cover can't be removed from the gallery");
  }
  const next = removeGalleryUrl({ urls: post.extra_image_urls ?? [], alts: post.extra_image_alts ?? [] }, url);
  if (next.removed === 0) throw new JournalPhotosError("that photo is not in this post's gallery", 404);

  const { error: upErr } = await client.from(BLOG_POSTS)
    .update({ extra_image_urls: next.urls, extra_image_alts: next.alts })
    .eq("id", post.id);
  if (upErr) throw new JournalPhotosError(`could not update the post: ${upErr.message}`, 500);

  // The post's gallery association in image_library (the file itself stays).
  const { error: libErr } = await client.from(IMAGE_LIBRARY).delete()
    .eq("source_post_id", post.id).eq("source_role", "gallery").eq("image_url", url);
  if (libErr) console.error(`image_library cleanup failed for post ${post.id}`, libErr);

  await syncPayloadToLive(client, itemId);
  return { slug: post.slug, removed: next.removed, remaining: next.urls.length };
}
