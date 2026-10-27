// Published image traceability for a blog/journal post, keyed by blog_posts.id
// so it serves both Content Engine journals and legacy BlogTab posts. The live
// blog_posts row is the source of truth: the inventory lists exactly what the
// public page renders (cover, gallery, social image), each matched to the
// session photo it came from when the post was published by the engine, and
// each pointing at the column that has to change to remove or replace it.
// Writes edit that row directly, keep image_library in step, and re-derive the
// engine item's saved selection from the live row so the editor can't hide a
// photo the page shows.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildLivePhotoList, payloadDrift, photoIdsFromLive, removeGalleryUrl, swapCover,
  type CoverSwap, type LiveJournalPhoto, type LivePostImages, type PayloadDrift, type SessionPhotoMatch,
} from "@/lib/contentEngine/journalPhotoMembership";
import { IMAGE_LIBRARY_SOURCE_ROLES, IMAGE_LIBRARY_SOURCE_TYPES } from "@/lib/imageLibraryShared";

export class PostImagesError extends Error {
  readonly status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.name = "PostImagesError";
    this.status = status;
  }
}

export const BLOG_POSTS_TABLE = "blog_posts";
const IMAGE_LIBRARY = "image_library";
const CONTENT_ITEMS = "session_content_items";
const PACKAGES = "session_content_packages";
const SESSION_PHOTOS = "session_photos";
const POST_IMAGE_COLUMNS = "id,slug,title,cover_image_url,cover_image_alt,extra_image_urls,extra_image_alts,og_image_url";

export interface PostImageRow extends LivePostImages {
  slug: string;
  title: string;
}

/** The published engine item a post came from, when there is one. */
export interface EngineLink {
  itemId: string;
  sessionId: string;
  payload: Record<string, unknown>;
}

export interface PostImageInventory {
  postId: number;
  slug: string;
  title: string;
  photos: LiveJournalPhoto[];
  /** null = a legacy post with no Content Engine item (editable only in BlogTab). */
  engine: (EngineLink & { drift: PayloadDrift }) | null;
}

export async function loadPostImageRow(client: SupabaseClient, postId: number): Promise<PostImageRow> {
  const { data, error } = await client.from(BLOG_POSTS_TABLE)
    .select(POST_IMAGE_COLUMNS).eq("id", postId).maybeSingle();
  if (error) throw new PostImagesError(`could not load the post: ${error.message}`, 500);
  if (!data) throw new PostImagesError("blog post not found", 404);
  return data as PostImageRow;
}

export async function findEngineLink(client: SupabaseClient, postId: number): Promise<EngineLink | null> {
  const { data, error } = await client.from(CONTENT_ITEMS)
    .select("id,payload,package_id,published_at")
    .eq("content_type", "journal_post").eq("status", "published")
    .eq("published_target_type", "blog_post").eq("published_target_id", String(postId))
    .order("published_at", { ascending: false }).limit(1);
  if (error) throw new PostImagesError(`could not load the engine item: ${error.message}`, 500);
  const item = data?.[0];
  if (!item) return null;
  const { data: pkg, error: pErr } = await client.from(PACKAGES)
    .select("photography_session_id").eq("id", item.package_id).maybeSingle();
  if (pErr || !pkg) throw new PostImagesError("content package not found", 404);
  return {
    itemId: item.id as string,
    sessionId: pkg.photography_session_id as string,
    payload: (item.payload ?? {}) as Record<string, unknown>,
  };
}

/** Session photos whose public derivative is one of the live URLs. */
async function matchSessionPhotos(
  client: SupabaseClient, sessionId: string | null, urls: (string | null)[],
): Promise<Map<string, SessionPhotoMatch>> {
  const wanted = [...new Set(urls.filter((u): u is string => Boolean(u)))];
  if (!sessionId || wanted.length === 0) return new Map();
  const { data, error } = await client.from(SESSION_PHOTOS)
    .select("id,original_filename,excluded,public_derivative_url")
    .eq("photography_session_id", sessionId)
    .in("public_derivative_url", wanted);
  if (error) throw new PostImagesError(`could not match live photos: ${error.message}`, 500);
  return new Map((data ?? []).map((r) => [r.public_derivative_url as string, {
    id: r.id as string, original_filename: r.original_filename as string | null, excluded: Boolean(r.excluded),
  }]));
}

async function livePhotos(client: SupabaseClient, post: PostImageRow, engine: EngineLink | null): Promise<LiveJournalPhoto[]> {
  const urls = [post.cover_image_url, post.og_image_url, ...(post.extra_image_urls ?? [])];
  return buildLivePhotoList(post, await matchSessionPhotos(client, engine?.sessionId ?? null, urls));
}

/** Every image the public page renders for this post, with its source and drift from the saved draft. */
export async function loadPostImageInventory(client: SupabaseClient, postId: number): Promise<PostImageInventory> {
  const [post, engine] = await Promise.all([loadPostImageRow(client, postId), findEngineLink(client, postId)]);
  const photos = await livePhotos(client, post, engine);
  return {
    postId: post.id, slug: post.slug, title: post.title, photos,
    engine: engine ? { ...engine, drift: payloadDrift(engine.payload, photos) } : null,
  };
}

/**
 * Rewrites the engine item's photo_ids (and cover_photo_id) from the live row
 * so the editor mirrors the page. No-op for posts without an engine item.
 */
export async function syncEnginePayload(client: SupabaseClient, postId: number): Promise<LiveJournalPhoto[]> {
  const [post, engine] = await Promise.all([loadPostImageRow(client, postId), findEngineLink(client, postId)]);
  const live = await livePhotos(client, post, engine);
  if (!engine) return live;
  const liveCover = live.find((p) => p.role === "cover")?.photoId ?? null;
  const coverId = liveCover
    ?? (typeof engine.payload.cover_photo_id === "string" ? engine.payload.cover_photo_id : null);
  const payload = {
    ...engine.payload,
    photo_ids: photoIdsFromLive(coverId, live),
    ...(coverId ? { cover_photo_id: coverId } : {}),
  };
  const { error } = await client.from(CONTENT_ITEMS).update({ payload }).eq("id", engine.itemId);
  if (error) throw new PostImagesError(`could not sync the engine item: ${error.message}`, 500);
  return live;
}

export interface RemoveGalleryImageResult {
  slug: string;
  removed: number;
  remaining: number;
}

/** Removes ONE gallery image (association only — the file and session photo stay). */
export async function removePostGalleryImage(
  client: SupabaseClient, postId: number, url: string,
): Promise<RemoveGalleryImageResult> {
  const post = await loadPostImageRow(client, postId);
  if (post.cover_image_url === url) {
    throw new PostImagesError("that is the cover photo — replace it with another photo instead");
  }
  const next = removeGalleryUrl({ urls: post.extra_image_urls ?? [], alts: post.extra_image_alts ?? [] }, url);
  if (next.removed === 0) throw new PostImagesError("that photo is not in this post's gallery", 404);

  const { error: upErr } = await client.from(BLOG_POSTS_TABLE)
    .update({ extra_image_urls: next.urls, extra_image_alts: next.alts }).eq("id", post.id);
  if (upErr) throw new PostImagesError(`could not update the post: ${upErr.message}`, 500);

  await deleteLibraryRows(client, post.id, IMAGE_LIBRARY_SOURCE_ROLES.gallery, url);
  await syncEnginePayload(client, postId);
  return { slug: post.slug, removed: next.removed, remaining: next.urls.length };
}

export interface ReplaceCoverInput {
  postId: number;
  /** An existing photo: one of the post's gallery images or a session photo's public copy. */
  url: string;
  /** Move the current cover into the gallery (false = it leaves the post). */
  keepOldInGallery: boolean;
}

export interface ReplaceCoverResult {
  slug: string;
  cover_image_url: string;
  og_image_url: string;
  gallery: number;
}

/** Alt text for the chosen photo, and proof that it is one of the post's or session's photos. */
async function resolveCoverCandidate(
  client: SupabaseClient, post: PostImageRow, engine: EngineLink | null, url: string,
): Promise<{ alt: string | null }> {
  const galleryIndex = (post.extra_image_urls ?? []).indexOf(url);
  if (galleryIndex >= 0) return { alt: post.extra_image_alts?.[galleryIndex] ?? null };
  if (engine) {
    const { data, error } = await client.from(SESSION_PHOTOS)
      .select("id,alt_text,public_derivative_url")
      .eq("photography_session_id", engine.sessionId).eq("public_derivative_url", url).limit(1);
    if (error) throw new PostImagesError(`could not check the session photo: ${error.message}`, 500);
    if (data?.[0]) return { alt: (data[0].alt_text as string | null) ?? null };
  }
  throw new PostImagesError("choose one of this post's photos or one of the session's published photos");
}

/** Sets the cover AND the social image together; the post is never left coverless. */
export async function replacePostCover(client: SupabaseClient, input: ReplaceCoverInput): Promise<ReplaceCoverResult> {
  const [post, engine] = await Promise.all([loadPostImageRow(client, input.postId), findEngineLink(client, input.postId)]);
  if (post.cover_image_url === input.url) throw new PostImagesError("that photo is already the cover");
  const candidate = await resolveCoverCandidate(client, post, engine, input.url);
  const next = swapCover(post, { url: input.url, alt: candidate.alt }, input.keepOldInGallery);
  const previous = { url: post.cover_image_url, alt: post.cover_image_alt };

  const { error } = await client.from(BLOG_POSTS_TABLE).update(next).eq("id", post.id);
  if (error) throw new PostImagesError(`could not update the post: ${error.message}`, 500);

  await syncLibraryAfterCoverSwap(client, post, previous, next);
  await syncEnginePayload(client, input.postId);
  return { slug: post.slug, cover_image_url: next.cover_image_url, og_image_url: next.og_image_url, gallery: next.extra_image_urls.length };
}

// ── image_library (the post's association rows; files are never touched) ────

async function deleteLibraryRows(client: SupabaseClient, postId: number, role: string, url?: string): Promise<void> {
  let q = client.from(IMAGE_LIBRARY).delete().eq("source_post_id", postId).eq("source_role", role);
  if (url) q = q.eq("image_url", url);
  const { error } = await q;
  if (error) console.error(`image_library cleanup failed for post ${postId} (${role})`, error);
}

/** The old cover's row goes; the new cover gets one; a kept old cover becomes a gallery row. */
async function syncLibraryAfterCoverSwap(
  client: SupabaseClient, post: { id: number; slug: string; title: string },
  previous: { url: string | null; alt: string | null }, next: CoverSwap,
): Promise<void> {
  await deleteLibraryRows(client, post.id, IMAGE_LIBRARY_SOURCE_ROLES.cover);
  await deleteLibraryRows(client, post.id, IMAGE_LIBRARY_SOURCE_ROLES.gallery, next.cover_image_url);
  const base = {
    source_type: IMAGE_LIBRARY_SOURCE_TYPES.journal, source_post_id: post.id, source_post_slug: post.slug, in_portfolio: false,
  };
  const rows = [
    { ...base, title: `${post.title} cover`, alt: next.cover_image_alt || `${post.title} cover`,
      image_url: next.cover_image_url, source_role: IMAGE_LIBRARY_SOURCE_ROLES.cover },
    ...(previous.url && next.extra_image_urls.includes(previous.url)
      ? [{ ...base, title: post.title, alt: previous.alt || post.title,
          image_url: previous.url, source_role: IMAGE_LIBRARY_SOURCE_ROLES.gallery }]
      : []),
  ];
  const { error } = await client.from(IMAGE_LIBRARY)
    .upsert(rows, { onConflict: "source_post_id,source_role,image_url", ignoreDuplicates: true });
  if (error) console.error(`image_library sync failed for post ${post.id}`, error);
}
