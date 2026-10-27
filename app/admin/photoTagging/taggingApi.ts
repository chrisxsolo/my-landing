// Fetch client for /api/admin/photo-tagging. Cookie auth rides along (same origin).
import type { ChangeLogRow } from "@/lib/photoChangeLog/entries";
import type { ApplyResult } from "@/lib/photoTagging/apply";
import type { PreviewResult } from "@/lib/photoTagging/preview";
import type { TagChanges, TaggingReport, NotApplicableField } from "@/lib/photoTagging/types";

const PATH = "/api/admin/photo-tagging";

export type ApplyResponse = ApplyResult;
export type PreviewResponse = PreviewResult;

/** What a tag write asks for: explicit values, or every safe high-confidence suggestion. */
export type TagRequest =
  | { kind: "changes"; keys: string[]; changes: TagChanges; replace: boolean; /** Noted in the change history ("undo"). */ reason?: string }
  | { kind: "high"; keys?: string[]; photoOnly?: boolean };

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

function bodyOf(req: TagRequest): Record<string, unknown> {
  return req.kind === "changes"
    ? { keys: req.keys, changes: req.changes, replace: req.replace, ...(req.reason ? { reason: req.reason } : {}) }
    : { high: true, ...(req.keys ? { keys: req.keys } : {}), photoOnly: req.photoOnly === true };
}

export const taggingApi = {
  load: (sessionId?: string) => request<TaggingReport>(undefined, sessionId ? `?session=${sessionId}` : ""),
  thumbs: () => request<{ thumbs: Record<string, string> }>(undefined, "?thumbs=1"),
  preview: (req: TagRequest) => post<PreviewResponse>({ action: "preview", ...bodyOf(req) }),
  write: (req: TagRequest) => post<ApplyResponse>({ action: req.kind === "changes" ? "apply" : "apply-high", ...bodyOf(req) }),
  markNotApplicable: (keys: string[], field: NotApplicableField, on: boolean) =>
    post<{ updated: number }>({ action: "mark-na", keys, field, on }),
  dismiss: (key: string, suggestionId: string) => post<{ dismissed: boolean }>({ action: "dismiss", key, suggestionId }),
  aiSuggest: (keys: string[], force = false) => post<VisionResponse>({ action: "ai-suggest", keys, force }),
  history: (key?: string, limit = 50) =>
    request<{ changes: ChangeLogRow[] }>(undefined, `?history=1&limit=${limit}${key ? `&key=${encodeURIComponent(key)}` : ""}`),
  restore: (logId: number) => post<ApplyResponse>({ action: "restore", logId }),
};

function reasons(r: Pick<ApplyResult, "outcomes">, result: string): string {
  const list = [...new Set(r.outcomes.filter((o) => o.result === result).map((o) => o.reason))].filter(Boolean);
  return list.length ? ` (${list.slice(0, 2).join("; ")})` : "";
}

/** One-line human summary of an apply result; ok is false whenever any write failed. */
export function applySummary(r: ApplyResult): { text: string; ok: boolean } {
  const parts = [`${r.updated} field(s) updated`];
  if (r.failed > 0) parts.push(`${r.failed} FAILED: ${r.failures[0] ?? "write failed"} — run it again to retry`);
  if (r.conflicts > 0) parts.push(`${r.conflicts} held back${reasons(r, "conflict")}`);
  if (r.kept > 0) parts.push(`${r.kept} kept (already set — use Replace to overwrite)`);
  if (r.skipped > 0) parts.push(`${r.skipped} skipped${reasons(r, "skipped")}`);
  return { text: parts.join(" · "), ok: r.failed === 0 };
}
