// Validates the admin photo-sync POST body. Pure.
//   { action: "retry", runId }  → re-run that logged run now
//   { action: "run", kind }     → a full sync of that kind now
import type { SyncKind } from "@/lib/photoSync/runLog";

export const SYNC_KINDS: readonly SyncKind[] = ["campus_spots", "location_library"];

export type SyncAction =
  | { action: "retry"; runId: number }
  | { action: "run"; kind: SyncKind };

export function isSyncKind(value: unknown): value is SyncKind {
  return typeof value === "string" && (SYNC_KINDS as readonly string[]).includes(value);
}

export function parseSyncAction(body: unknown): SyncAction | { error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "body must be a JSON object" };
  const { action, runId, kind } = body as Record<string, unknown>;
  if (action === "retry") {
    return typeof runId === "number" && Number.isSafeInteger(runId) && runId > 0
      ? { action, runId }
      : { error: "runId must be a positive integer" };
  }
  if (action === "run") {
    return isSyncKind(kind) ? { action, kind } : { error: `kind must be one of ${SYNC_KINDS.join(", ")}` };
  }
  return { error: 'action must be "retry" or "run"' };
}
