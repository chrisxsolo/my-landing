// ─────────────────────────────────────────────────────────────────────────────
// The timeline sync's outcome, as counts. Shared by the route and both admin
// callers so "nothing new" can never be confused with "could not look".
// Holds no client names, addresses, or message content.
// ─────────────────────────────────────────────────────────────────────────────

export const DISCOVERY_STAGES = [
  "sent_documents", "sent_replies", "payments", "signed_notices", "provider_documents",
] as const;
export type DiscoveryStage = (typeof DISCOVERY_STAGES)[number];

export type SyncStatus = "complete" | "partial" | "failed";

export type TimelineSyncReport = {
  status: SyncStatus;
  applied: { inquiries: number; sessions: number; sessionsCreated: number; replyStatuses: number };
  failed: {
    /** Gmail searches that failed outright. */
    discovery: DiscoveryStage[];
    /** Messages a search found but could not read. */
    unreadMessages: number;
    /** Client threads the AI scan could not read or analyze. */
    scans: number;
    /** Database reads/writes that failed or matched no row. */
    writes: number;
    reconcile: boolean;
  };
  /** Evidence that could belong to more than one client or booking — not applied. */
  ambiguous: { providerNotices: number; sessions: number };
  skipped: {
    /** Provider notices naming nobody on file. */
    providerNotices: number;
    /** Signed contracts for clients with no portal session to record it on. */
    signedWithoutSession: number;
  };
  remaining: {
    /** Clients not thread-scanned because the time budget ran out. */
    scans: number;
    /** Eligible clients beyond the per-run scan limit. */
    scansOverLimit: number;
    /** Searches with more results than the per-run cap. */
    truncated: DiscoveryStage[];
    /** Reply-status reconciliation skipped for time. */
    reconcile: boolean;
  };
};

export type StageOutcome = {
  stage: DiscoveryStage;
  listFailed: boolean;
  failedReads: number;
  truncated: boolean;
};

export function emptySyncReport(): TimelineSyncReport {
  return {
    status: "complete",
    applied: { inquiries: 0, sessions: 0, sessionsCreated: 0, replyStatuses: 0 },
    failed: { discovery: [], unreadMessages: 0, scans: 0, writes: 0, reconcile: false },
    ambiguous: { providerNotices: 0, sessions: 0 },
    skipped: { providerNotices: 0, signedWithoutSession: 0 },
    remaining: { scans: 0, scansOverLimit: 0, truncated: [], reconcile: false },
  };
}

export function withStageOutcomes(report: TimelineSyncReport, stages: StageOutcome[]): TimelineSyncReport {
  return {
    ...report,
    failed: {
      ...report.failed,
      discovery: stages.filter(s => s.listFailed).map(s => s.stage),
      unreadMessages: stages.reduce((sum, s) => sum + s.failedReads, 0),
    },
    remaining: { ...report.remaining, truncated: stages.filter(s => s.truncated).map(s => s.stage) },
  };
}

/**
 * failed   — no Gmail search worked, so nothing could be learned.
 * partial  — something failed or was cut short; what did land is real.
 * complete — every stage ran. Items needing review do not make a run partial:
 *            they were looked at and deliberately not applied.
 */
export function deriveSyncStatus(report: TimelineSyncReport): SyncStatus {
  const { failed, remaining } = report;
  if (failed.discovery.length === DISCOVERY_STAGES.length) return "failed";
  const incomplete = failed.discovery.length > 0 || failed.unreadMessages > 0 || failed.scans > 0 ||
    failed.writes > 0 || failed.reconcile || remaining.scans > 0 || remaining.truncated.length > 0 ||
    remaining.reconcile;
  return incomplete ? "partial" : "complete";
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function problemNotes(report: TimelineSyncReport): string[] {
  const { failed, remaining } = report;
  const notes: string[] = [];
  if (failed.discovery.length) notes.push(`${plural(failed.discovery.length, "Gmail search", "Gmail searches")} failed`);
  if (failed.unreadMessages) notes.push(`${plural(failed.unreadMessages, "message")} could not be read`);
  if (failed.scans) notes.push(`${plural(failed.scans, "client thread")} could not be scanned`);
  if (failed.writes) notes.push(`${plural(failed.writes, "update")} did not save`);
  if (failed.reconcile) notes.push("reply-status check failed");
  if (remaining.scans) notes.push(`${plural(remaining.scans, "client thread")} left unscanned (time limit)`);
  if (remaining.truncated.length) notes.push("older mail beyond this run's limit was not checked");
  if (remaining.reconcile) notes.push("reply-status check skipped (time limit)");
  return notes;
}

function reviewNotes(report: TimelineSyncReport): string[] {
  const { ambiguous, skipped, remaining } = report;
  const notes: string[] = [];
  if (ambiguous.providerNotices) {
    notes.push(`${plural(ambiguous.providerNotices, "Pixieset notice")} could not be tied to one client — mark those by hand`);
  }
  if (skipped.providerNotices) notes.push(`${plural(skipped.providerNotices, "Pixieset notice")} named no client on file`);
  if (ambiguous.sessions) notes.push(`${plural(ambiguous.sessions, "portal session")} skipped (client has several sessions)`);
  if (skipped.signedWithoutSession) {
    notes.push(`${plural(skipped.signedWithoutSession, "signed contract")} noted for clients without a portal session yet`);
  }
  if (remaining.scansOverLimit) notes.push(`${plural(remaining.scansOverLimit, "older client thread")} not scanned this run`);
  return notes;
}

/** One admin-facing sentence set describing the run honestly. */
export function buildSyncMessage(report: TimelineSyncReport): string {
  const { applied } = report;
  const changed = applied.inquiries + applied.sessions + applied.sessionsCreated + applied.replyStatuses;
  const problems = problemNotes(report);
  const reviews = reviewNotes(report);

  let lead: string;
  if (report.status === "failed") lead = "Timeline sync could not read Gmail — nothing was checked.";
  else if (changed > 0) {
    const parts = [
      applied.inquiries ? plural(applied.inquiries, "inquiry timeline") : "",
      applied.sessions ? plural(applied.sessions, "portal session") : "",
      applied.sessionsCreated ? `${plural(applied.sessionsCreated, "portal session")} created` : "",
      applied.replyStatuses ? plural(applied.replyStatuses, "reply status", "reply statuses") : "",
    ].filter(Boolean);
    lead = `Timeline synced — updated ${parts.join(", ")}.`;
  } else if (problems.length) lead = "Timeline sync finished with no changes, but it was incomplete.";
  else lead = "Everything checked is already up to date.";

  const problemPart = problems.length && report.status !== "failed" ? ` Incomplete: ${problems.join("; ")}.` : "";
  const reviewPart = reviews.length ? ` Needs review: ${reviews.join("; ")}.` : "";
  return lead + problemPart + reviewPart;
}

export type SyncResponseBody = {
  report?: TimelineSyncReport;
  message?: string;
  error?: string;
};

/** How a caller should present the route's response. */
export function describeSyncResponse(ok: boolean, body: SyncResponseBody): { status: SyncStatus; message: string } {
  if (!ok) return { status: "failed", message: body.error ?? "Timeline sync failed." };
  return { status: body.report?.status ?? "complete", message: body.message ?? "Timeline synced." };
}

/** True when the run changed rows the caller is showing. */
export function syncChangedSessions(body: SyncResponseBody): boolean {
  const applied = body.report?.applied;
  return !!applied && applied.sessions + applied.sessionsCreated > 0;
}
