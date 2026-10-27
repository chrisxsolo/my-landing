// Fetch client for the review queue's server findings and for the existing
// admin endpoints its items point at. Cookie auth rides along (same origin).
import type { QueueAction } from "@/lib/photoTagging/reviewQueue";
import type { ReviewFindings } from "@/lib/reviewQueue/findingItems";

const FINDINGS_PATH = "/api/admin/review-queue";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, credentials: "include", headers: { "content-type": "application/json" } });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : `request failed (${res.status})`);
  return body as T;
}

export const reviewQueueApi = {
  findings: (sessionId?: string) => request<ReviewFindings>(`${FINDINGS_PATH}${sessionId ? `?session=${sessionId}` : ""}`),
  /** Runs an item's action against the admin endpoint it names. */
  run: (action: Required<Pick<QueueAction, "request">>["request"]) =>
    request<Record<string, unknown>>(action.url, { method: action.method, ...(action.body ? { body: JSON.stringify(action.body) } : {}) }),
};
