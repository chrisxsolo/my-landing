// What the photo sync run log (lib/photoSync/runLog) keeps of a location
// library sync. Pure. A session that failed turns the run red, so a partial
// sweep is never logged as healthy.
import type { SyncOutcome } from "@/lib/photoSync/runLog";
import type { FullSyncReport, SessionSyncReport } from "@/lib/locationLibrary/sync";

const LISTED_FAILURES = 5;

export function summarizeSessionSync(report: SessionSyncReport): SyncOutcome {
  return {
    error: report.status === "error" ? report.message : null,
    detail: {
      status: report.status, linked: report.linkedKeys.length,
      created: report.createdKeys.length, removedLinks: report.removedLinks,
    },
  };
}

export function summarizeFullSync(report: FullSyncReport): SyncOutcome {
  const failed = report.sessions.filter((s) => s.status === "error");
  const listed = failed.slice(0, LISTED_FAILURES).map((s) => `${s.sessionId}: ${s.message}`).join("; ");
  return {
    error: failed.length > 0 ? `${failed.length} of ${report.sessions.length} sessions failed — ${listed}` : null,
    detail: {
      sessions: report.sessions.length,
      failed: failed.length,
      needsReview: report.sessions.filter((s) => s.status === "needs_review").length,
      created: report.sessions.reduce((n, s) => n + s.createdKeys.length, 0),
      removedLinks: report.sessions.reduce((n, s) => n + s.removedLinks, 0),
      claims: report.claims.length,
    },
  };
}
