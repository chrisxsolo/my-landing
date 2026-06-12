// Typed fetch client over the Plan-4A engine routes. Cookie auth rides along
// automatically (same-origin). Every helper throws EngineApiError with the
// server's message and status so callers can branch on status (409 protocols).
import type {
  EngineSessionRow, EnginePhoto, WorkspaceData, ReconcileReport,
} from "./engineTypes";

export class EngineApiError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === "string" ? body.error : `request failed (${status})`);
    this.name = "EngineApiError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new EngineApiError(res.status, body);
  return body as T;
}

export const engineApi = {
  listSessions: () =>
    request<{ sessions: EngineSessionRow[] }>("/api/admin/session-content/sessions"),
  createSession: (input: { clientSessionId?: string; serviceType?: string }) =>
    request<{ sessionId: string }>("/api/admin/session-content/sessions", {
      method: "POST", body: JSON.stringify(input),
    }),
  getWorkspace: (sessionId: string) =>
    request<WorkspaceData>(`/api/admin/session-content/sessions/${sessionId}`),
  patchFacts: (sessionId: string, facts: Record<string, unknown>) =>
    request<{ updated: boolean }>(`/api/admin/session-content/sessions/${sessionId}`, {
      method: "PATCH", body: JSON.stringify(facts),
    }),
  patchPermissions: (sessionId: string, body: Record<string, unknown>) =>
    request<{ outcome: string }>(`/api/admin/session-content/sessions/${sessionId}/permissions`, {
      method: "PATCH", body: JSON.stringify(body),
    }),
  listPhotos: (sessionId: string) =>
    request<{ photos: EnginePhoto[] }>(`/api/admin/session-content/photos?sessionId=${sessionId}`),
  patchPhoto: (photoId: string, patch: Record<string, unknown>) =>
    request<{ updated: boolean }>(`/api/admin/session-content/photos/${photoId}`, {
      method: "PATCH", body: JSON.stringify(patch),
    }),
  signUpload: (sessionId: string, file: { mime: string; sizeBytes: number }) =>
    request<{ bucket: string; path: string; token: string; signedUrl: string }>(
      "/api/admin/session-content/photos/sign",
      { method: "POST", body: JSON.stringify({ sessionId, mime: file.mime, sizeBytes: file.sizeBytes }) },
    ),
  finalizeUpload: (sessionId: string, storagePath: string, declared: {
    filename: string; mime: string; sizeBytes: number; contentHash?: string;
  }) =>
    request<{ photo: { id: string } }>("/api/admin/session-content/photos/finalize", {
      method: "POST",
      body: JSON.stringify({ sessionId, storagePath, ...declared }),
    }),
  analyzeBatch: (sessionId: string) =>
    request<{ claimed: number; completed: number; failed: number; remaining: number }>(
      "/api/admin/session-content/photos/analyze",
      { method: "POST", body: JSON.stringify({ sessionId }) },
    ),
  createPackage: (sessionId: string, selectedTypes: string[], opts?: {
    archiveCurrent?: boolean; copyItems?: { item_id: string; preserve_approval: boolean }[];
  }) =>
    request<{ packageId: string }>("/api/admin/session-content/packages", {
      method: "POST",
      body: JSON.stringify({
        sessionId, selectedTypes,
        archiveCurrent: opts?.archiveCurrent ?? false,
        copyItems: opts?.copyItems ?? [],
      }),
    }),
  generateType: (packageId: string, contentType: string) =>
    request<{ outcome: string; itemIds: string[]; packageStatus: string; error?: string }>(
      "/api/admin/session-content/generate",
      { method: "POST", body: JSON.stringify({ packageId, contentType }) },
    ),
  skipType: (packageId: string, contentType: string) =>
    request<{ packageStatus: string }>("/api/admin/session-content/generate/skip", {
      method: "POST", body: JSON.stringify({ packageId, contentType }),
    }),
  autosaveItem: (itemId: string, payload: Record<string, unknown>, payloadRevision: number) =>
    request<{ outcome: "saved"; payloadRevision: number }>(
      `/api/admin/session-content/items/${itemId}`,
      { method: "PATCH", body: JSON.stringify({ payload, payloadRevision }) },
    ),
  itemStatus: (itemId: string, action: "approve" | "reject" | "unreject", reason?: string) =>
    request<{ outcome: string; status: string }>(`/api/admin/session-content/items/${itemId}/status`, {
      method: "POST", body: JSON.stringify({ action, reason }),
    }),
  publish: (itemId: string) =>
    request<{ status: "published"; targetType: string; targetId: string | null;
              revalidated: string[]; revalidationFailures: string[] }>(
      "/api/admin/session-content/publish",
      { method: "POST", body: JSON.stringify({ itemId }) },
    ),
  takedown: (itemId: string) =>
    request<{ removed: boolean; derivativesDeleted: string[] }>("/api/admin/session-content/takedown", {
      method: "POST", body: JSON.stringify({ itemId }),
    }),
  reconcile: (sessionId: string) =>
    request<ReconcileReport>(`/api/admin/session-content/reconcile?sessionId=${sessionId}`),
  reconcileAction: (body: Record<string, unknown>) =>
    request<{ linked?: boolean; marked?: boolean }>("/api/admin/session-content/reconcile", {
      method: "POST", body: JSON.stringify(body),
    }),
  revalidateAll: () => request<{ revalidated: boolean }>("/api/admin/revalidate", { method: "POST" }),
  analytics: (sessionId: string) =>
    request<{ views: number; ctaClicks: number; perItem: Record<string, number> }>(
      `/api/admin/session-content/analytics?sessionId=${sessionId}`,
    ),
};
