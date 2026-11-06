// DTOs shared by the server routes and the admin UI for scheduled publishing.
import type { ScheduleState, ScheduleTargetKind } from "@/lib/contentPublishing/constants";

export interface PublicationScheduleRow {
  id: string;
  target_kind: ScheduleTargetKind;
  content_item_id: string | null;
  blog_draft_id: string | null;
  due_at: string;
  time_zone: string;
  local_wall_time: string;
  source_revision: number;
  schedule_version: number;
  state: ScheduleState;
  attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  claim_token: string | null;
  lease_expires_at: string | null;
  published_at: string | null;
  published_target_type: string | null;
  published_target_id: string | null;
  refresh_pending: boolean;
  refresh_paths: string[];
  created_at: string;
  updated_at: string;
}

export const SCHEDULE_COLUMNS =
  "id,target_kind,content_item_id,blog_draft_id,due_at,time_zone,local_wall_time,source_revision,schedule_version,"
  + "state,attempts,next_attempt_at,last_error,lease_expires_at,published_at,published_target_type,"
  + "published_target_id,refresh_pending,refresh_paths,created_at,updated_at";

/** What clients see: the row without its claim token. */
export type PublicationScheduleDto = Omit<PublicationScheduleRow, "claim_token">;

/** A queue entry decorated with what it publishes, for the upcoming list. */
export interface ScheduleQueueEntry {
  schedule: PublicationScheduleDto;
  title: string;
  /** "Journal post", "Portfolio pick", "Blog post (draft)" … */
  typeLabel: string;
  /** Where the content is edited. */
  source: { kind: "content_item"; sessionId: string | null; sessionName: string | null }
        | { kind: "blog_draft" };
  /** Live URL once published (journals and blog posts). */
  liveUrl: string | null;
  overdue: boolean;
}

export interface DraftImageRef {
  /** Object path in the private blog-drafts bucket (`<draft id>/<file>`). */
  path?: string;
  /** An already-public image reused as is. */
  url?: string;
  alt: string;
}

export interface BlogPostDraftRow {
  id: string;
  title: string;
  body: string;
  slug: string;
  category: string;
  sites: string[];
  meta_description: string | null;
  meta_keywords: string | null;
  images: DraftImageRef[];
  source: "manual" | "ai_photos";
  status: "draft" | "published";
  revision: number;
  published_post_id: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogPostDraftDto extends BlogPostDraftRow {
  /** Short-lived signed previews for private images, public URLs otherwise; index-aligned with images. */
  previewUrls: (string | null)[];
  schedule: PublicationScheduleDto | null;
  /** Null when the draft can be scheduled/published; otherwise the actionable reason. */
  incomplete: string | null;
}

export interface WorkerRunRow {
  id: number;
  source: string;
  started_at: string;
  finished_at: string | null;
  claimed: number;
  published: number;
  blocked: number;
  failed: number;
  retried: number;
  refreshed: number;
  error: string | null;
}

export interface PublishingHealth {
  lastRun: WorkerRunRow | null;
  /** Queued rows past due + grace with no claim: the trigger is not reaching the worker. */
  overdue: number;
  counts: Record<ScheduleState, number>;
  refreshPending: number;
  trigger: {
    installed: boolean;
    scheduled: boolean;
    active: boolean | null;
    schedule: string | null;
    lastRun: { status: string; started_at: string; finished_at: string | null; message: string | null } | null;
  };
  serverNow: string;
}
