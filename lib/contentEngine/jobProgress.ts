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
          return job.photos_total > 0
            ? `Processing photos — ${job.photos_done} of ${job.photos_total} analyzed`
            : "Processing photos";
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
