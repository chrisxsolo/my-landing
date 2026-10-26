// Fetch client for /api/admin/photo-tagging. Cookie auth rides along (same origin).
import type { TagChanges, TaggingReport, NotApplicableField } from "@/lib/photoTagging/types";
import type { TagOutcome } from "@/lib/photoTagging/plan";

const PATH = "/api/admin/photo-tagging";

export interface ApplyResponse {
  updated: number;
  kept: number;
  skipped: number;
  outcomes: TagOutcome[];
  failures: string[];
}

export interface VisionResponse {
  analyzed: string[];
  failed: { key: string; error: string }[];
  suggestions: number;
  remaining: number;
  skipped: number;
}

async function request<T>(init?: RequestInit, query = ""): Promise<T> {
  const res = await fetch(`${PATH}${query}`, {
    ...init, credentials: "include", headers: { "content-type": "application/json" },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : `request failed (${res.status})`);
  return body as T;
}

const post = <T,>(body: Record<string, unknown>) => request<T>({ method: "POST", body: JSON.stringify(body) });

export const taggingApi = {
  load: (sessionId?: string) => request<TaggingReport>(undefined, sessionId ? `?session=${sessionId}` : ""),
  thumbs: () => request<{ thumbs: Record<string, string> }>(undefined, "?thumbs=1"),
  apply: (keys: string[], changes: TagChanges, replace: boolean) =>
    post<ApplyResponse>({ action: "apply", keys, changes, replace }),
  applyHigh: (keys?: string[]) => post<ApplyResponse>({ action: "apply-high", ...(keys ? { keys } : {}) }),
  markNotApplicable: (keys: string[], field: NotApplicableField, on: boolean) =>
    post<{ updated: number }>({ action: "mark-na", keys, field, on }),
  dismiss: (key: string, suggestionId: string) => post<{ dismissed: boolean }>({ action: "dismiss", key, suggestionId }),
  aiSuggest: (keys: string[], force = false) => post<VisionResponse>({ action: "ai-suggest", keys, force }),
};

/** One-line human summary of an apply result. */
export function applySummary(r: ApplyResponse): string {
  const parts = [`${r.updated} field(s) updated`];
  if (r.kept > 0) parts.push(`${r.kept} kept (already set — use Replace to overwrite)`);
  if (r.skipped > 0) {
    const reasons = [...new Set(r.outcomes.filter((o) => o.result === "skipped").map((o) => o.reason))].filter(Boolean);
    parts.push(`${r.skipped} skipped${reasons.length ? ` (${reasons.slice(0, 2).join("; ")})` : ""}`);
  }
  if (r.failures.length > 0) parts.push(`${r.failures.length} failed: ${r.failures[0]}`);
  return parts.join(" · ");
}
