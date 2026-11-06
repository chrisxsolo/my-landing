// Typed fetch client for scheduled publishing, shared by the Darkroom engine
// pages and the light BlogTab. Cookie auth rides along (same origin). Errors
// carry the server's message, status and body so callers can branch on 409s.
import type { BlogPostDraftDto, PublicationScheduleDto, PublishingHealth, ScheduleQueueEntry } from "@/lib/contentPublishing/types";
import type { ScheduleState, ScheduleTargetKind } from "@/lib/contentPublishing/constants";
import type { Disambiguation } from "@/lib/contentPublishing/localTime";

const SCHEDULES_API = "/api/admin/publication-schedules";
const DRAFTS_API = "/api/admin/blog-drafts";
const WORKER_API = "/api/content-publishing/worker";

export class PublishingApiError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === "string" ? body.error : `request failed (${status})`);
    this.name = "PublishingApiError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init, credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new PublishingApiError(res.status, body);
  return body as T;
}

/** What the admin chose; the server resolves and validates it. */
export interface ScheduleWhen {
  localWallTime: string;
  timeZone: string;
  disambiguation?: Disambiguation;
}

export interface WorkerRunSummary { claimed: number; published: number; blocked: number; failed: number; retried: number; refreshed: number }

export const publishingApi = {
  listQueue: (states?: ScheduleState[]) =>
    request<{ entries: ScheduleQueueEntry[]; serverNow: string }>(
      states?.length ? `${SCHEDULES_API}?states=${states.join(",")}` : SCHEDULES_API),
  schedule: (target: { kind: ScheduleTargetKind; id: string }, when: ScheduleWhen, expectedRevision?: number) =>
    request<{ schedule: PublicationScheduleDto }>(SCHEDULES_API, {
      method: "POST", body: JSON.stringify({ target, ...when, expectedRevision }),
    }),
  reschedule: (id: string, scheduleVersion: number, when: ScheduleWhen) =>
    request<{ schedule: PublicationScheduleDto }>(`${SCHEDULES_API}/${id}`, {
      method: "PATCH", body: JSON.stringify({ scheduleVersion, ...when }),
    }),
  cancel: (id: string, scheduleVersion: number) =>
    request<{ schedule: PublicationScheduleDto }>(`${SCHEDULES_API}/${id}`, {
      method: "DELETE", body: JSON.stringify({ scheduleVersion }),
    }),
  publishNow: (id: string, scheduleVersion: number) =>
    request<{ schedule: PublicationScheduleDto; revalidationFailures: string[] }>(`${SCHEDULES_API}/${id}`, {
      method: "POST", body: JSON.stringify({ scheduleVersion, action: "publish-now" }),
    }),
  retry: (id: string, scheduleVersion: number) =>
    request<{ schedule: PublicationScheduleDto }>(`${SCHEDULES_API}/${id}`, {
      method: "POST", body: JSON.stringify({ scheduleVersion, action: "retry" }),
    }),
  health: () => request<PublishingHealth>(`${SCHEDULES_API}/health`),
  runWorkerNow: () => request<WorkerRunSummary>(WORKER_API, { method: "POST" }),

  listDrafts: () => request<{ drafts: BlogPostDraftDto[] }>(DRAFTS_API),
  getDraft: (id: string) => request<{ draft: BlogPostDraftDto }>(`${DRAFTS_API}/${id}`),
  createDraft: (fields: Record<string, unknown>, source: "manual" | "ai_photos" = "manual") =>
    request<{ draft: BlogPostDraftDto }>(DRAFTS_API, { method: "POST", body: JSON.stringify({ ...fields, source }) }),
  updateDraft: (id: string, revision: number, fields: Record<string, unknown>) =>
    request<{ outcome: "saved"; draft: BlogPostDraftDto; scheduleCancelled: boolean }>(`${DRAFTS_API}/${id}`, {
      method: "PATCH", body: JSON.stringify({ revision, ...fields }),
    }),
  deleteDraft: (id: string) => request<{ ok: true }>(`${DRAFTS_API}/${id}`, { method: "DELETE" }),
  publishDraftNow: (id: string, revision: number) =>
    request<{ status: "published"; postId: number; slug: string; revalidationFailures: string[] }>(`${DRAFTS_API}/${id}/publish`, {
      method: "POST", body: JSON.stringify({ revision }),
    }),
};
