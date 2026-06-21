// Amend an already-published journal/blog post with more of the session's
// uploaded photos (the publisher only seeds a handful at publish time). Builds
// public derivatives for the new photos, appends them to the live blog_posts
// row + image_library, and keeps the engine item's payload.photo_ids in sync so
// the picker and takedown stay accurate. Idempotent: photos already in the post
// are skipped. Marketing permission is re-checked — the same consent gate as
// the original publish.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureDerivativesForPhotos } from "@/lib/contentEngine/derivatives";

export class AddPhotosError extends Error {
  readonly status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.name = "AddPhotosError";
    this.status = status;
  }
}

export interface AddJournalPhotosArgs {
  client: SupabaseClient;
  itemId: string;
  photoIds: string[];
}

export interface AddJournalPhotosResult {
  added: number;
  slug: string;
  postId: string;
  totalExtras: number;
}

const asStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export async function addJournalPhotos(args: AddJournalPhotosArgs): Promise<AddJournalPhotosResult> {
  const { client, itemId, photoIds } = args;

  // 1. The engine item must be a published journal post.
  const { data: item, error: iErr } = await client.from("session_content_items")
    .select("id,content_type,status,payload,package_id,published_target_type,published_target_id")
    .eq("id", itemId).maybeSingle();
  if (iErr || !item) throw new AddPhotosError("content item not found", 404);
  if (item.content_type !== "journal_post") {
    throw new AddPhotosError("only journal / blog posts support extra photos");
  }
  if (item.status !== "published" || item.published_target_type !== "blog_post" || !item.published_target_id) {
    throw new AddPhotosError("publish this post first, then add more photos");
  }
  const payload = (item.payload ?? {}) as Record<string, unknown>;

  // 2. Session + the same marketing-permission consent gate as publish.
  const { data: pkg } = await client.from("session_content_packages")
    .select("photography_session_id").eq("id", item.package_id).single();
  const sessionId = pkg!.photography_session_id as string;
  const { data: session } = await client.from("photography_sessions")
    .select("marketing_permission").eq("id", sessionId).single();
  if (!session?.marketing_permission) {
    throw new AddPhotosError("marketing permission is not enabled for this session", 403);
  }

  // 3. Resolve the live post and which selected photos are genuinely new.
  const { data: post, error: pErr } = await client.from("blog_posts")
    .select("id,slug,title,extra_image_urls,extra_image_alts")
    .eq("id", Number(item.published_target_id)).maybeSingle();
  if (pErr || !post) throw new AddPhotosError("published blog post not found", 404);

  const already = new Set<string>([
    ...asStringArray(payload.photo_ids),
    ...(typeof payload.cover_photo_id === "string" ? [payload.cover_photo_id] : []),
  ]);
  const newIds = [...new Set(photoIds)].filter((id) => !already.has(id));
  if (newIds.length === 0) throw new AddPhotosError("those photos are already in this post");

  // 4. Public, EXIF-stripped derivatives for the new photos (reused if present).
  const derivatives = await ensureDerivativesForPhotos(client, sessionId, newIds);

  const { data: photoRows } = await client.from("session_photos")
    .select("id,alt_text").in("id", newIds);
  const altById = new Map((photoRows ?? []).map((r) => [r.id as string, (r.alt_text as string | null) ?? ""]));
  const postTitle = (post.title as string) ?? "Photo";

  // 5. Append to the live post, keeping urls/alts aligned and skipping dupes.
  const currentUrls = asStringArray(post.extra_image_urls);
  const currentAlts = asStringArray(post.extra_image_alts);
  while (currentAlts.length < currentUrls.length) currentAlts.push("");

  const addUrls: string[] = [];
  const addAlts: string[] = [];
  for (const d of derivatives) {
    if (currentUrls.includes(d.url) || addUrls.includes(d.url)) continue;
    addUrls.push(d.url);
    addAlts.push(altById.get(d.photoId) || postTitle);
  }
  if (addUrls.length > 0) {
    const { error: upErr } = await client.from("blog_posts")
      .update({ extra_image_urls: [...currentUrls, ...addUrls], extra_image_alts: [...currentAlts, ...addAlts] })
      .eq("id", post.id);
    if (upErr) throw new AddPhotosError(`could not update the post: ${upErr.message}`, 500);

    // image_library gallery rows — mirrors the publisher (spec §9.2).
    await client.from("image_library").upsert(
      derivatives.map((d) => ({
        title: postTitle, alt: altById.get(d.photoId) || postTitle, image_url: d.url,
        source_type: "journal", source_post_id: post.id, source_post_slug: post.slug,
        source_role: "gallery", in_portfolio: false,
      })),
      { onConflict: "source_post_id,source_role,image_url", ignoreDuplicates: true },
    );
  }

  // 6. Keep the engine item payload in sync (picker + takedown reference it).
  const nextPhotoIds = [...new Set([...asStringArray(payload.photo_ids), ...newIds])];
  await client.from("session_content_items")
    .update({ payload: { ...payload, photo_ids: nextPhotoIds } }).eq("id", itemId);

  return {
    added: addUrls.length,
    slug: post.slug as string,
    postId: String(post.id),
    totalExtras: currentUrls.length + addUrls.length,
  };
}
