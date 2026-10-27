// Revision history for blog_posts. A database trigger (migration
// 20261027000010) copies the OLD row into blog_post_revisions on every update
// or delete, so every published state can be seen and brought back. Restoring
// writes the snapshot's editable columns back onto the post; the trigger
// records the pre-restore row, so a restore is itself reversible.
import type { SupabaseClient } from "@supabase/supabase-js";
import { BLOG_POSTS_TABLE } from "@/lib/blog/publishedImages";
import { pickEditableFields, type BlogPostUpdates } from "@/lib/blog/postFields";

export const REVISIONS_TABLE = "blog_post_revisions";
const DEFAULT_LIMIT = 30;

export class RevisionError extends Error {
  readonly status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.name = "RevisionError";
    this.status = status;
  }
}

export type RevisionOperation = "update" | "delete";

export interface RevisionRow {
  id: number;
  post_id: number;
  operation: RevisionOperation;
  snapshot: Record<string, unknown>;
  changed_at: string;
}

/** What the admin list shows per revision — enough to tell versions apart. */
export interface RevisionSummary {
  id: number;
  operation: RevisionOperation;
  changedAt: string;
  title: string;
  slug: string;
  coverImageUrl: string | null;
  ogImageUrl: string | null;
  galleryCount: number;
  bodyLength: number;
}

export function summarizeRevision(row: RevisionRow): RevisionSummary {
  const s = row.snapshot;
  return {
    id: row.id,
    operation: row.operation,
    changedAt: row.changed_at,
    title: typeof s.title === "string" ? s.title : "",
    slug: typeof s.slug === "string" ? s.slug : "",
    coverImageUrl: typeof s.cover_image_url === "string" ? s.cover_image_url : null,
    ogImageUrl: typeof s.og_image_url === "string" ? s.og_image_url : null,
    galleryCount: Array.isArray(s.extra_image_urls) ? s.extra_image_urls.length : 0,
    bodyLength: typeof s.body === "string" ? s.body.length : 0,
  };
}

/** The columns a restore writes: the snapshot's editable fields, nothing else. */
export function restoreUpdatesFrom(snapshot: Record<string, unknown>): BlogPostUpdates {
  return pickEditableFields(snapshot);
}

export async function listRevisions(client: SupabaseClient, postId: number, limit = DEFAULT_LIMIT): Promise<RevisionSummary[]> {
  const { data, error } = await client.from(REVISIONS_TABLE)
    .select("id,post_id,operation,snapshot,changed_at")
    .eq("post_id", postId).order("changed_at", { ascending: false }).limit(limit);
  if (error) throw new RevisionError(`could not load revisions: ${error.message}`, 500);
  return ((data ?? []) as RevisionRow[]).map(summarizeRevision);
}

export interface RestoreResult {
  postId: number;
  revisionId: number;
  slug: string;
}

export async function restoreRevision(client: SupabaseClient, postId: number, revisionId: number): Promise<RestoreResult> {
  const { data: rev, error } = await client.from(REVISIONS_TABLE)
    .select("id,post_id,operation,snapshot,changed_at").eq("id", revisionId).eq("post_id", postId).maybeSingle();
  if (error) throw new RevisionError(`could not load the revision: ${error.message}`, 500);
  if (!rev) throw new RevisionError("revision not found for this post", 404);

  const updates = restoreUpdatesFrom((rev as RevisionRow).snapshot);
  if (Object.keys(updates).length === 0) throw new RevisionError("that revision holds nothing restorable");

  const { data: post, error: pErr } = await client.from(BLOG_POSTS_TABLE).select("id").eq("id", postId).maybeSingle();
  if (pErr) throw new RevisionError(`could not load the post: ${pErr.message}`, 500);
  if (!post) throw new RevisionError("the post no longer exists — a deleted post cannot be restored by update", 404);

  const { error: uErr } = await client.from(BLOG_POSTS_TABLE).update(updates).eq("id", postId);
  if (uErr) throw new RevisionError(`could not restore the post: ${uErr.message}`, 500);
  return { postId, revisionId, slug: typeof updates.slug === "string" ? updates.slug : "" };
}
