// Publishes a standalone blog draft, now or from the worker. Shape mirrors
// publishApprovedItem: promote images (idempotent, outside any transaction) →
// one transactional RPC that inserts the live row and marks the draft (and
// schedule) published → recoverable cache refresh. A repeat call after a
// committed publication reports published with alreadyPublished=true and
// creates nothing.
import type { SupabaseClient } from "@supabase/supabase-js";
import { draftIncompleteReason, loadDraft } from "@/lib/contentPublishing/blogDrafts";
import { DraftImageError, promoteDraftImages, removePromotedCopies } from "@/lib/contentPublishing/blogDraftImages";
import { PUBLICATION_SCHEDULES_TABLE } from "@/lib/contentPublishing/constants";
import { publicPathsForBlogPost } from "@/lib/contentPublishing/refresh";
import type { BlogPostDraftRow } from "@/lib/contentPublishing/types";

export interface ScheduleClaim {
  id: string;
  claimToken: string;
  /** The admin's Publish now: the RPC skips the due-time check. */
  allowEarly?: boolean;
}

export type BlogDraftPublishOutcome =
  | { status: "published"; postId: number; slug: string; alreadyPublished: boolean; paths: string[];
      revalidated: string[]; revalidationFailures: string[] }
  | { status: "blocked"; reason: string }
  | { status: "failed"; error: string };

export interface PublishBlogDraftArgs {
  client: SupabaseClient;
  draftId: string;
  schedule?: ScheduleClaim;
  /** Marks one public path for refresh; throwing records the path as pending. */
  revalidate: (path: string) => void;
}

// Preconditions the RPC raises for: the draft/schedule is not in a state that
// may publish. None of these is a crash, so none is retried.
const GUARD_PATTERN =
  /not found|claim is not current|not due yet|does not target|content changed|incomplete|slug conflict|draft is scheduled|not a public url|must be a JSON array/i;
// Refusals that prove NO other publisher holds this draft. A lost claim or a
// schedule race means someone else may have promoted (same paths) and gone
// live with these very objects, so those must never trigger a cleanup.
const SAFE_TO_CLEAN_PATTERN = /slug conflict|incomplete|content changed|not a public url|must be a JSON array/i;

// The cheap preconditions, checked BEFORE any private photo is copied to the
// public bucket: the RPC re-checks all of them under its locks, but a draft
// that is going to be refused must not leave public copies behind.
async function preflightReason(client: SupabaseClient, draft: BlogPostDraftRow, schedule?: ScheduleClaim): Promise<string | null> {
  if (schedule) {
    const { data: s } = await client.from(PUBLICATION_SCHEDULES_TABLE)
      .select("state,claim_token,source_revision,blog_draft_id").eq("id", schedule.id).maybeSingle();
    if (!s) return "schedule not found";
    if (s.state !== "processing" || s.claim_token !== schedule.claimToken) return `schedule claim is not current (state=${s.state})`;
    if (s.blog_draft_id !== draft.id) return "schedule does not target this draft";
    if (s.source_revision !== draft.revision) {
      return `content changed since it was scheduled (revision ${s.source_revision} was reviewed, ${draft.revision} is current)`;
    }
  }
  const { data: taken } = await client.from("blog_posts").select("id").eq("slug", draft.slug).maybeSingle();
  const incomplete = draftIncompleteReason(draft, taken !== null);
  return incomplete ? `draft is incomplete: ${incomplete}` : null;
}

export async function publishBlogDraft(args: PublishBlogDraftArgs): Promise<BlogDraftPublishOutcome> {
  const { client, draftId, schedule, revalidate } = args;
  const draft = await loadDraft(client, draftId);
  if (!draft) return { status: "blocked", reason: "draft not found" };

  let images: { url: string; alt: string }[];
  if (draft.status === "published") {
    images = [];
  } else {
    const reason = await preflightReason(client, draft, schedule);
    if (reason) return { status: "blocked", reason };
    try {
      images = await promoteDraftImages(client, draft.images);
    } catch (err) {
      if (err instanceof DraftImageError) return { status: "failed", error: err.message };
      throw err;
    }
  }

  const { data, error } = await client.rpc("publish_blog_post_draft", {
    p_draft_id: draftId,
    p_schedule_id: schedule?.id ?? null,
    p_claim_token: schedule?.claimToken ?? null,
    p_images: images,
    p_allow_early: schedule ? (schedule.allowEarly ?? false) : true,
  });
  if (error) {
    if (GUARD_PATTERN.test(error.message)) {
      // Refused for good: the copies made above must not stay public — unless
      // another publisher may own them (re-read: still an unpublished draft?).
      if (SAFE_TO_CLEAN_PATTERN.test(error.message)) {
        const again = await loadDraft(client, draftId);
        if (again?.status === "draft") await removePromotedCopies(client, draft.id);
      }
      return { status: "blocked", reason: error.message };
    }
    return { status: "failed", error: error.message };
  }
  const result = data as { already_published: boolean; post_id: number; slug: string };

  const paths = publicPathsForBlogPost(result.slug);
  const revalidated: string[] = [];
  const revalidationFailures: string[] = [];
  for (const path of paths) {
    try {
      revalidate(path);
      revalidated.push(path);
    } catch (err) {
      console.error(`revalidation failed for ${path} (recoverable; the worker retries it)`, err);
      revalidationFailures.push(path);
    }
  }
  return {
    status: "published", postId: Number(result.post_id), slug: result.slug,
    alreadyPublished: result.already_published === true, paths, revalidated, revalidationFailures,
  };
}
