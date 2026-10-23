// How a background content run reads to the admin. Pure presentation over the
// job row so the workspace, and anything else that wants to show a run, phrase
// it identically. Dependency-free: client components import it.

export type JobProgressStatus =
  "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type JobProgressPhase =
  "analyze" | "curate" | "package" | "generate" | "done";

export interface JobProgressView {
  status: JobProgressStatus;
  phase: JobProgressPhase;
  photos_total: number;
  photos_done: number;
  types_total: number;
  types_done: number;
  last_error: string | null;
  soft_errors: string[];
}

export function isJobLive(job: Pick<JobProgressView, "status">): boolean {
  return job.status === "queued" || job.status === "running";
}

/** Two or three words for the current stage — the step name, nothing else. */
export function jobStageLabel(job: JobProgressView): string {
  if (job.status === "queued") return "Queued";
  if (job.status === "succeeded") return "Ready for review";
  if (job.status === "failed") return "Needs attention";
  if (job.status === "cancelled") return "Cancelled";
  switch (job.phase) {
    case "analyze": return "Processing photos";
    case "curate": return "Choosing photos";
    case "package": return "Preparing";
    case "generate": return "Writing drafts";
    case "done": return "Finishing";
  }
}

/** A full sentence with whatever counts are meaningful at this stage. */
export function jobProgressLabel(job: JobProgressView): string {
  switch (job.status) {
    case "queued":
      return "Queued — a worker picks this up shortly. You can close this tab.";
    case "cancelled":
      return "Run cancelled. Anything already generated is kept as a draft.";
    case "failed":
      return job.last_error ?? "The run stopped before it finished.";
    case "succeeded": {
      const soft = job.soft_errors.length;
      return soft === 0
        ? "Drafts are ready for your review below."
        : `Drafts are ready, with ${soft} problem(s) to look at.`;
    }
    case "running":
      switch (job.phase) {
        case "analyze":
          // The per-photo counts render live beneath this line (from the photo
          // rows); the job's own counters only move between worker steps.
          return "Analyzing photos, several at a time — you can close this tab.";
        case "curate":
          return "Choosing the strongest photos";
        case "package":
          return "Preparing the content package";
        case "generate":
          return job.types_total > 0
            ? `Writing drafts — ${job.types_done} of ${job.types_total} done`
            : "Writing drafts";
        case "done":
          return "Wrapping up";
      }
  }
}

// Phase weights for the progress bar. Analysis is the long pole on a big shoot,
// generation on a small one, so both get a real share.
const PHASE_FLOOR: Record<JobProgressPhase, number> = {
  analyze: 0, curate: 60, package: 66, generate: 70, done: 100,
};

/** 0–100, or null when there is nothing meaningful to draw. */
export function jobPercent(job: JobProgressView): number | null {
  if (job.status === "succeeded") return 100;
  if (!isJobLive(job)) return null;
  if (job.status === "queued") return 0;
  if (job.phase === "analyze") {
    if (job.photos_total <= 0) return 0;
    return Math.round((job.photos_done / job.photos_total) * 60);
  }
  if (job.phase === "generate") {
    if (job.types_total <= 0) return PHASE_FLOOR.generate;
    return PHASE_FLOOR.generate + Math.round((job.types_done / job.types_total) * 30);
  }
  return PHASE_FLOOR[job.phase];
}

// ── Per-photo progress ──────────────────────────────────────────────────────
// Built from the photo rows themselves rather than the job's counters, so the
// numbers move the moment each photo commits instead of once per worker step.

/** The slice of a session_photos row that progress needs. */
export interface PhotoStatusRow {
  id: string;
  excluded: boolean;
  analysis_status: string;
  analysis_started_at: string | null;
  analysis_lease_expires_at: string | null;
  analyzed_at: string | null;
  quality_score: number | null;
  analysis_error: string | null;
}

export interface PhotoProgress {
  total: number;
  completed: number;
  analyzing: number;
  waiting: number;
  failed: number;
  /** Photos finished since the run started — the basis for the time estimate. */
  completedInRun: number;
  /** When the run's first photo was picked up (epoch ms), if it has been. */
  firstStartMs: number | null;
}

const ms = (iso: string | null) => (iso ? Date.parse(iso) : Number.NaN);

export function summarizePhotoProgress(
  rows: readonly PhotoStatusRow[], nowMs: number, runStartedAt: string | null,
): PhotoProgress {
  const runStart = runStartedAt ? ms(runStartedAt) : Number.NaN;
  // Strictly after: a run marker can equal the start of a photo from before the run.
  const inRun = (iso: string | null) => !Number.isNaN(runStart) && ms(iso) > runStart;
  const progress: PhotoProgress = {
    total: 0, completed: 0, analyzing: 0, waiting: 0, failed: 0,
    completedInRun: 0, firstStartMs: null,
  };
  for (const row of rows) {
    if (row.excluded || row.analysis_status === "skipped") continue;
    progress.total += 1;
    if (inRun(row.analysis_started_at)) {
      const started = ms(row.analysis_started_at);
      progress.firstStartMs = progress.firstStartMs === null ? started : Math.min(progress.firstStartMs, started);
    }
    switch (row.analysis_status) {
      case "completed":
        progress.completed += 1;
        if (inRun(row.analyzed_at)) progress.completedInRun += 1;
        break;
      case "failed":
        progress.failed += 1;
        break;
      case "processing":
        // An expired lease means its worker died; it is back in the queue.
        if (ms(row.analysis_lease_expires_at) > nowMs) progress.analyzing += 1;
        else progress.waiting += 1;
        break;
      default:
        progress.waiting += 1;
    }
  }
  return progress;
}

// Below this, one fast or slow photo swings the estimate too much to show.
const MIN_ESTIMATE_SAMPLES = 3;
const MIN_ESTIMATE_ELAPSED_MS = 8_000;

/** Milliseconds left at the run's measured pace, or null without enough data. */
export function estimateRemainingMs(progress: PhotoProgress, nowMs: number): number | null {
  const left = progress.analyzing + progress.waiting;
  if (left === 0 || progress.firstStartMs === null) return null;
  const elapsed = nowMs - progress.firstStartMs;
  if (progress.completedInRun < MIN_ESTIMATE_SAMPLES || elapsed < MIN_ESTIMATE_ELAPSED_MS) return null;
  return Math.round((left * elapsed) / progress.completedInRun);
}

/** "0:42", "3:05", "1:02:10". */
export function formatDuration(totalMs: number): string {
  const seconds = Math.max(0, Math.round(totalMs / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** "18 of 24 analyzed · 6 in progress · 1 failed" — zero counts are left out. */
export function photoProgressLine(progress: PhotoProgress): string {
  const parts = [`${progress.completed} of ${progress.total} analyzed`];
  if (progress.analyzing > 0) parts.push(`${progress.analyzing} in progress`);
  if (progress.waiting > 0) parts.push(`${progress.waiting} waiting`);
  if (progress.failed > 0) parts.push(`${progress.failed} failed`);
  return parts.join(" · ");
}
