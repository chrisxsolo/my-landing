// Standalone blog drafts: private rows in blog_post_drafts (migration
// 20261106000001) that become blog_posts only when published. Saving never
// publishes. Edits bump `revision` with optimistic concurrency, and an edit to
// a scheduled draft cancels its schedule — the schedule was bound to the
// reviewed revision, and the commit RPC would refuse the new one anyway.
import type { SupabaseClient } from "@supabase/supabase-js";
import { BLOG_POST_DRAFTS_TABLE } from "@/lib/contentPublishing/constants";
import {
  DraftImageError, normalizeDraftImages, previewUrlsFor, removeDraftUploads, removePromotedCopies,
} from "@/lib/contentPublishing/blogDraftImages";
import { activeScheduleFor, cancelActiveSchedulesForDraft } from "@/lib/contentPublishing/scheduleService";
import type { BlogPostDraftDto, BlogPostDraftRow, PublicationScheduleDto } from "@/lib/contentPublishing/types";

export const DRAFT_COLUMNS =
  "id,title,body,slug,category,sites,meta_description,meta_keywords,images,source,status,revision,published_post_id,published_at,created_at,updated_at";
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_TITLE = 300;
const MAX_BODY = 60_000;
const MAX_META = 2_000;

export class DraftError extends Error {
  readonly status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.name = "DraftError";
    this.status = status;
  }
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** The fields an admin may write; everything else (status, revision, published_*) is server-owned. */
export interface DraftFields {
  title?: string;
  body?: string;
  slug?: string;
  meta_description?: string | null;
  meta_keywords?: string | null;
  images?: unknown;
}

const text = (v: unknown, max: number, name: string): string => {
  if (typeof v !== "string") throw new DraftError(`${name} must be text`, 400);
  if (v.length > max) throw new DraftError(`${name} is too long (max ${max} characters)`, 400);
  return v;
};

/** Validates a request body into writable columns. Unknown keys are rejected so worker state can never be set by a client. */
export function parseDraftFields(body: Record<string, unknown>, draftId: string): Record<string, unknown> {
  const allowed = new Set(["title", "body", "slug", "meta_description", "meta_keywords", "images"]);
  const unknown = Object.keys(body).filter((k) => !allowed.has(k));
  if (unknown.length) throw new DraftError(`Unknown fields: ${unknown.join(", ")}`, 400);
  const out: Record<string, unknown> = {};
  if ("title" in body) out.title = text(body.title, MAX_TITLE, "title").trim();
  if ("body" in body) out.body = text(body.body, MAX_BODY, "body");
  if ("slug" in body) out.slug = slugify(text(body.slug, MAX_TITLE, "slug"));
  if ("meta_description" in body) out.meta_description = body.meta_description === null ? null : text(body.meta_description, MAX_META, "meta_description").trim() || null;
  if ("meta_keywords" in body) out.meta_keywords = body.meta_keywords === null ? null : text(body.meta_keywords, MAX_META, "meta_keywords").trim() || null;
  if ("images" in body) {
    try { out.images = normalizeDraftImages(draftId, body.images); }
    catch (err) { throw new DraftError(err instanceof DraftImageError ? err.message : "invalid images", 400); }
  }
  return out;
}

export type DraftCompletenessRow = Pick<BlogPostDraftRow, "title" | "body" | "slug" | "images">;

/** Why a draft cannot be scheduled or published yet (null = ready). Saving an incomplete draft is always allowed. */
export function draftIncompleteReason(draft: DraftCompletenessRow, slugTaken: boolean): string | null {
  if (!draft.title.trim()) return "Add a title before scheduling.";
  if (!draft.body.trim()) return "Write the post body before scheduling.";
  if (!SLUG_PATTERN.test(draft.slug)) return "Set a URL slug (lowercase words joined by dashes).";
  if (slugTaken) return `A live post already uses the slug "${draft.slug}" — pick another.`;
  return null;
}

export async function listDrafts(client: SupabaseClient, limit = 100): Promise<BlogPostDraftRow[]> {
  const { data, error } = await client.from(BLOG_POST_DRAFTS_TABLE).select(DRAFT_COLUMNS)
    .order("updated_at", { ascending: false }).limit(limit);
  if (error) throw new DraftError(`could not list drafts: ${error.message}`, 500);
  return (data ?? []) as BlogPostDraftRow[];
}

export async function loadDraft(client: SupabaseClient, id: string): Promise<BlogPostDraftRow | null> {
  const { data, error } = await client.from(BLOG_POST_DRAFTS_TABLE).select(DRAFT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new DraftError(`could not load draft: ${error.message}`, 500);
  return (data as BlogPostDraftRow | null) ?? null;
}

export async function createDraft(client: SupabaseClient, body: Record<string, unknown>, source: "manual" | "ai_photos" = "manual"): Promise<BlogPostDraftRow> {
  // Images need the draft id (their upload prefix), so a create never carries them.
  const { images: _images, ...rest } = body;
  void _images;
  const fields = parseDraftFields(rest, "00000000-0000-0000-0000-000000000000");
  if (typeof fields.title === "string" && !fields.slug && fields.title) fields.slug = slugify(fields.title);
  const { data, error } = await client.from(BLOG_POST_DRAFTS_TABLE).insert({ ...fields, source }).select(DRAFT_COLUMNS).single();
  if (error) throw new DraftError(`could not create draft: ${error.message}`, 500);
  return data as BlogPostDraftRow;
}

export type UpdateDraftResult =
  | { outcome: "saved"; draft: BlogPostDraftRow; scheduleCancelled: boolean }
  | { outcome: "conflict"; server: BlogPostDraftRow }
  | { outcome: "not_found" }
  | { outcome: "not_editable"; message: string };

export async function updateDraft(client: SupabaseClient, id: string, body: Record<string, unknown>, expectedRevision: number): Promise<UpdateDraftResult> {
  const current = await loadDraft(client, id);
  if (!current) return { outcome: "not_found" };
  if (current.status === "published") return { outcome: "not_editable", message: "this draft is already published — edit the live post instead" };
  const fields = parseDraftFields(body, id);
  const { data, error } = await client.from(BLOG_POST_DRAFTS_TABLE)
    .update({ ...fields, revision: expectedRevision + 1 })
    .eq("id", id).eq("revision", expectedRevision).eq("status", "draft").select(DRAFT_COLUMNS);
  if (error) throw new DraftError(`could not save draft: ${error.message}`, 500);
  if (!data?.length) {
    const server = await loadDraft(client, id);
    if (!server) return { outcome: "not_found" };
    return { outcome: "conflict", server };
  }
  const cancelled = await cancelActiveSchedulesForDraft(client, id, "cancelled: the draft was edited after it was scheduled");
  return { outcome: "saved", draft: data[0] as BlogPostDraftRow, scheduleCancelled: cancelled > 0 };
}

export async function deleteDraft(client: SupabaseClient, id: string): Promise<boolean> {
  const current = await loadDraft(client, id);
  if (!current) return false;
  // A published draft is history while its post lives; once the post is gone
  // (legacy delete, takedown) the record may go too.
  if (current.status === "published" && current.published_post_id !== null) {
    throw new DraftError("a published draft is history — delete the live post instead", 409);
  }
  const live = await activeScheduleFor(client, { kind: "blog_draft", id });
  if (live?.state === "processing") throw new DraftError("this draft is being published right now — wait for it to finish", 409);
  const { error } = await client.from(BLOG_POST_DRAFTS_TABLE).delete().eq("id", id); // schedules cascade
  if (error) throw new DraftError(`could not delete draft: ${error.message}`, 500);
  await removeDraftUploads(client, id);
  if (current.status !== "published") await removePromotedCopies(client, id);
  return true;
}

export async function toDraftDto(client: SupabaseClient, row: BlogPostDraftRow, schedule?: PublicationScheduleDto | null): Promise<BlogPostDraftDto> {
  const [previewUrls, sched, taken] = await Promise.all([
    previewUrlsFor(client, row.images),
    schedule === undefined ? activeScheduleFor(client, { kind: "blog_draft", id: row.id }) : Promise.resolve(schedule),
    client.from("blog_posts").select("id").eq("slug", row.slug).maybeSingle().then((r) => r.data !== null),
  ]);
  return { ...row, previewUrls, schedule: sched, incomplete: row.status === "published" ? null : draftIncompleteReason(row, taken) };
}
