// Names and limits shared by the scheduling service, the worker and the admin
// routes. One place, so a table name or a state list can never drift between
// the SQL that owns it and the code that reads it.

export const BLOG_POST_DRAFTS_TABLE = "blog_post_drafts";
export const PUBLICATION_SCHEDULES_TABLE = "publication_schedules";
export const PUBLICATION_WORKER_RUNS_TABLE = "publication_worker_runs";

/** Private bucket for images uploaded to a standalone draft (migration 20261106000001). */
export const BLOG_DRAFTS_BUCKET = "blog-drafts";

export const SCHEDULE_STATES = ["queued", "processing", "published", "blocked", "failed", "cancelled"] as const;
export type ScheduleState = (typeof SCHEDULE_STATES)[number];

/** States that hold the one-active-schedule-per-target slot. */
export const ACTIVE_SCHEDULE_STATES: readonly ScheduleState[] = ["queued", "processing", "blocked", "failed"];

export const SCHEDULE_TARGET_KINDS = ["content_item", "blog_draft"] as const;
export type ScheduleTargetKind = (typeof SCHEDULE_TARGET_KINDS)[number];

/** The business timezone this admin works in; the control starts here. */
export const DEFAULT_SCHEDULE_TIME_ZONE = "America/Los_Angeles";

/** Zones offered in the picker besides the default; any valid IANA zone is accepted by the server. */
export const COMMON_SCHEDULE_TIME_ZONES = [
  "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "Pacific/Honolulu", "America/Anchorage", "UTC", "Europe/London", "Europe/Paris", "Asia/Tokyo",
] as const;

/** How many due schedules one tick works. Each one is a few seconds; the route has 120s. */
export const WORKER_BATCH_LIMIT = 5;
/** How long a claim lasts. Longer than the worker route's maxDuration, so a live worker is never reclaimed. */
export const WORKER_LEASE_SECONDS = 180;
/** The worker route's maxDuration (the route exports the literal; this pins it for tests). */
export const WORKER_ROUTE_MAX_DURATION_SECONDS = 120;
/** Transient failures retry this many times (attempts counts claims, including lease steals). */
export const MAX_PUBLISH_ATTEMPTS = 5;
/** Back-off between transient retries: 1, 2, 4, 8 minutes, capped. */
export const RETRY_BACKOFF_BASE_SECONDS = 60;
export const RETRY_BACKOFF_MAX_SECONDS = 15 * 60;
/** Refresh retries per tick for published-but-refresh-pending rows. */
export const REFRESH_SWEEP_LIMIT = 10;
/** Heartbeat rows older than this are pruned. */
export const WORKER_RUN_RETENTION_DAYS = 7;
/** A queued row this long past due with no tick is "overdue" on the health card. */
export const OVERDUE_GRACE_SECONDS = 120;

/** Content types that have an automatic publisher (publish_session_content_item). */
export const SCHEDULABLE_CONTENT_TYPES: readonly string[] = [
  "journal_post", "portfolio_pick", "school_page_photo", "guide_photo", "location_guide", "testimonial_feature",
];
/** Why a type cannot be scheduled, shown in the UI instead of a button. */
export const UNSCHEDULABLE_CONTENT_TYPE_REASONS: Record<string, string> = {
  internal_link_suggestion: "Internal link suggestions are applied by hand; nothing publishes automatically.",
  social_caption: "Social captions have no publisher yet.",
};

export const DRAFT_IMAGE_PREVIEW_SECONDS = 60 * 60;
export const MAX_DRAFT_IMAGES = 40;
