// DTO types for the engine admin UI — shapes mirror the Plan-4A route payloads.
import type { SessionEngineState } from "@/lib/contentEngine/state";
import type { ExtractionOutcome, FreshnessOutcome } from "@/lib/contentEngine/emailFacts/run";

export type { SessionEngineState };

// Email-fact extraction DTOs. Type-only re-exports of the server contract, so
// the route and the panel can never drift apart.
export type { ThreadSummary } from "@/lib/contentEngine/emailFacts/run";
export type { ExtractedFact, DroppedFact } from "@/lib/contentEngine/emailFacts/extract";
export type EmailFactsResult = ExtractionOutcome;
/** The GET degrades to "unavailable" whenever Gmail cannot answer. */
export type EmailFactsFreshness = FreshnessOutcome | { outcome: "unavailable" };

export interface EngineSessionRow {
  id: string;
  public_display_name: string | null;
  internal_client_name: string | null;
  service_type: string;
  school_slug: string | null;
  session_date: string | null;
  marketing_permission: boolean;
  ai_processing_allowed: boolean;
  created_at: string;
  state: SessionEngineState;
  photoCount: number;
  itemCounts: Record<string, number>;
  activePackageId: string | null;
}

export interface EnginePhoto {
  id: string;
  storage_path: string;
  original_filename: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  excluded: boolean;
  analysis_status: "pending" | "processing" | "completed" | "failed" | "skipped";
  analysis_error: string | null;
  analysis_lease_expires_at: string | null;
  analysis_attempt: number;
  alt_text: string | null;
  title: string | null;
  description: string | null;
  tags: string[];
  quality_score: number | null;
  suggested_category: string | null;
  destination_recommendations: Record<string, boolean> | null;
  public_derivative_url: string | null;
  thumbnailUrl: string | null;
  created_at: string;
}

export interface EngineItem {
  id: string;
  package_id: string;
  content_type: string;
  status: "draft" | "approved" | "rejected" | "publishing" | "published" | "failed";
  payload: Record<string, unknown>;
  payload_revision: number;
  generation_model: string | null;
  prompt_version: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  published_target_type: string | null;
  published_target_id: string | null;
  published_ref: Record<string, unknown> | null;
  published_at: string | null;
  error: string | null;
  created_at: string;
}

export interface EnginePackage {
  id: string;
  generation_number: number;
  status: "generating" | "ready" | "needs_attention" | "failed" | "archived";
  model_name: string;
  prompt_version: string;
  // Facts frozen at package creation (spec §8.3) — generation reads THESE, not
  // the live session row, so the UI compares the two to explain skips.
  session_facts_snapshot?: {
    service_type?: string;
    primary_location?: string | null;
  } & Record<string, unknown>;
  generation_settings: {
    selected_types?: string[];
    progress?: Record<string, {
      status: "pending" | "processing" | "completed" | "failed" | "skipped";
      attempt: number;
      error: string | null;
      usage: { model: string; input_tokens: number; output_tokens: number } | null;
    }>;
  };
  created_at: string;
}

export interface WorkspaceData {
  session: Record<string, unknown> & {
    id: string;
    public_display_name: string | null;
    service_type: string;
    school_slug: string | null;
    marketing_permission: boolean;
    ai_processing_allowed: boolean;
  };
  activePackage: EnginePackage | null;
  items: EngineItem[];
  published: EngineItem[];
  state: SessionEngineState;
  photoCount: number;
  itemCounts: Record<string, number>;
  activePackageId: string | null;
}

// A background content run (content_engine_jobs). The phase is the worker's
// cursor through the pipeline; counters drive the progress line.
export interface EngineJob {
  id: string;
  photography_session_id: string;
  package_id: string | null;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  phase: "analyze" | "curate" | "package" | "generate" | "done";
  attempts: number;
  steps_run: number;
  photos_total: number;
  photos_done: number;
  types_total: number;
  types_done: number;
  soft_errors: string[];
  last_error: string | null;
  lease_expires_at: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

export const JOB_LIVE_STATUSES: EngineJob["status"][] = ["queued", "running"];

export interface ReconcileReport {
  stuckPublishing: { itemId: string; contentType: string; publishingStartedAt: string }[];
  failedWithExistingTarget: {
    itemId: string; contentType: string; targetType: string; targetId: string;
    autoConfirmable: boolean; proof: string;
  }[];
  orphanedDerivatives: { photoId: string; url: string }[];
}

// Canonical home is lib/contentEngine/generationProgress.ts — the background
// worker reads the same order, so the two can't drift.
export { GENERATION_ORDER } from "@/lib/contentEngine/generationProgress";

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  journal_post: "Journal post",
  portfolio_pick: "Portfolio pick",
  school_page_photo: "School page photo",
  guide_photo: "Guide photo",
  testimonial_feature: "Testimonial",
  internal_link_suggestion: "Internal links",
};
