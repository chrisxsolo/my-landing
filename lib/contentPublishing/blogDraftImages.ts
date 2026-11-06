// Images of a standalone blog draft. New uploads land in the PRIVATE
// blog-drafts bucket under `<draft id>/…` (signed upload, lib/adminUploadTargets
// target "blog-draft"); the admin sees them through short-lived signed URLs.
// Only the publisher promotes them: each private object is copied to the
// public grad-photos bucket at a deterministic path, so a retried publication
// reuses the same public files instead of making new ones. Already-public
// images (an existing post's photo, a legacy upload) are kept by URL.
import type { SupabaseClient } from "@supabase/supabase-js";
import { BLOG_DRAFTS_BUCKET, DRAFT_IMAGE_PREVIEW_SECONDS, MAX_DRAFT_IMAGES } from "@/lib/contentPublishing/constants";
import type { DraftImageRef } from "@/lib/contentPublishing/types";
import { GRAD_PHOTOS_BUCKET } from "@/lib/adminUploadTargets";

const OBJECT_NAME = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|avif)$/i;

export class DraftImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftImageError";
  }
}

/** Public URLs this project serves images from (Supabase storage on the configured project). */
function publicStorageOrigin(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base.replace(/\/$/, "")}/storage/v1/object/public/` : null;
}

/**
 * Normalizes a client-supplied image list: private paths must belong to this
 * draft; public URLs must be https from our own storage; alt text is a string.
 */
export function normalizeDraftImages(draftId: string, input: unknown): DraftImageRef[] {
  if (!Array.isArray(input)) throw new DraftImageError("images must be a list");
  if (input.length > MAX_DRAFT_IMAGES) throw new DraftImageError(`at most ${MAX_DRAFT_IMAGES} images per post`);
  const origin = publicStorageOrigin();
  return input.map((raw, i) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const alt = typeof item.alt === "string" ? item.alt.slice(0, 500) : "";
    if (typeof item.path === "string") {
      if (!OBJECT_NAME.test(item.path) || !item.path.toLowerCase().startsWith(`${draftId.toLowerCase()}/`)) {
        throw new DraftImageError(`image ${i + 1} is not one of this draft's uploads`);
      }
      return { path: item.path, alt };
    }
    if (typeof item.url === "string") {
      if (!item.url.startsWith("https://") || (origin && !item.url.startsWith(origin))) {
        throw new DraftImageError(`image ${i + 1} must be a photo already hosted on this site`);
      }
      return { url: item.url, alt };
    }
    throw new DraftImageError(`image ${i + 1} has neither an upload nor a url`);
  });
}

/** Signed previews for private images (null when signing fails), public URLs as is. */
export async function previewUrlsFor(client: SupabaseClient, images: readonly DraftImageRef[]): Promise<(string | null)[]> {
  const paths = images.map((img) => img.path).filter((p): p is string => typeof p === "string");
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data, error } = await client.storage.from(BLOG_DRAFTS_BUCKET).createSignedUrls(paths, DRAFT_IMAGE_PREVIEW_SECONDS);
    if (error) console.error("[blog-drafts] could not sign previews", error);
    for (const row of data ?? []) if (row.path && row.signedUrl) signed.set(row.path, row.signedUrl);
  }
  return images.map((img) => (img.url ? img.url : img.path ? signed.get(img.path) ?? null : null));
}

/** Deterministic public home for a private draft image: retries land on the same object. */
export function publicPathForDraftImage(privatePath: string): string {
  return `blog/drafts/${privatePath}`;
}

export interface PromotedImage { url: string; alt: string }

/**
 * Copies every private image to the public bucket (idempotent — an existing
 * destination is treated as already promoted) and returns the public list the
 * publish RPC takes. Runs BEFORE the commit, outside any transaction; a crash
 * here leaves only unreferenced public copies, never a half-published post.
 */
export async function promoteDraftImages(client: SupabaseClient, images: readonly DraftImageRef[]): Promise<PromotedImage[]> {
  const out: PromotedImage[] = [];
  for (const img of images) {
    if (img.url) { out.push({ url: img.url, alt: img.alt }); continue; }
    if (!img.path) continue;
    const dest = publicPathForDraftImage(img.path);
    const { error } = await client.storage.from(BLOG_DRAFTS_BUCKET).copy(img.path, dest, { destinationBucket: GRAD_PHOTOS_BUCKET });
    if (error && !/already exists|duplicate/i.test(error.message)) {
      throw new DraftImageError(`could not publish image ${img.path}: ${error.message}`);
    }
    out.push({ url: client.storage.from(GRAD_PHOTOS_BUCKET).getPublicUrl(dest).data.publicUrl, alt: img.alt });
  }
  return out;
}

/** Removes the public copies of a draft's private images (a blocked publish, a deleted draft). Best effort. */
export async function removePromotedCopies(client: SupabaseClient, draftId: string): Promise<void> {
  const prefix = publicPathForDraftImage(draftId);
  const { data, error } = await client.storage.from(GRAD_PHOTOS_BUCKET).list(prefix, { limit: 100 });
  if (error || !data?.length) return;
  const { error: rmErr } = await client.storage.from(GRAD_PHOTOS_BUCKET).remove(data.map((f) => `${prefix}/${f.name}`));
  if (rmErr) console.error(`[blog-drafts] could not remove public copies for ${draftId}`, rmErr);
}

/** Deletes a draft's private uploads (after the draft is deleted). Best effort. */
export async function removeDraftUploads(client: SupabaseClient, draftId: string): Promise<void> {
  const { data, error } = await client.storage.from(BLOG_DRAFTS_BUCKET).list(draftId, { limit: 100 });
  if (error || !data?.length) return;
  const { error: rmErr } = await client.storage.from(BLOG_DRAFTS_BUCKET).remove(data.map((f) => `${draftId}/${f.name}`));
  if (rmErr) console.error(`[blog-drafts] could not remove uploads for ${draftId}`, rmErr);
}
