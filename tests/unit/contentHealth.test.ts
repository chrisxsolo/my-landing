import { describe, expect, it, vi } from "vitest";
import {
  campusSpotHealthFrom, settlePart, syncHealthFrom, taggingHealthFrom, workerLooksIdle, type ContentHealthReport,
} from "@/lib/contentHealth/report";
import { healthItems } from "@/lib/contentHealth/issues";
import type { SyncRunRow } from "@/lib/photoSync/runLog";
import { jobsHealthFrom, type JobRow } from "@/lib/contentHealth/jobs";
import type { TagCounts } from "@/lib/photoTagging/types";

const SESSION = "11111111-2222-4333-8444-555555555555";

function run(over: Partial<SyncRunRow>): SyncRunRow {
  return {
    id: 1, kind: "campus_spots", scope: null, status: "ok", trigger: "admin",
    startedAt: "2026-10-27T10:00:00Z", finishedAt: "2026-10-27T10:01:00Z",
    error: null, detail: null, retryOf: null, ...over,
  };
}

const counts: TagCounts = {
  total: 400, published: 300, full: 250, partial: 30, needs: 12,
  gradsMissingSchool: 4, gradsMissingLocation: 6, unresolvedLocation: 9, highConfidence: 3,
};

describe("settlePart", () => {
  it("wraps a value", async () => {
    expect(await settlePart("x", async () => 3)).toEqual({ ok: true, value: 3 });
  });

  it("turns a failure into an unavailable part with the reason", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await settlePart("x", async () => { throw new Error("relation missing"); }))
      .toEqual({ ok: false, error: "relation missing" });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("x unavailable"));
    spy.mockRestore();
  });
});

describe("syncHealthFrom", () => {
  it("reports the last success per kind and failures not resolved since", () => {
    const runs = [
      run({ id: 5, kind: "location_library", scope: SESSION, status: "error", error: "timeout", startedAt: "2026-10-27T12:00:00Z" }),
      run({ id: 4, kind: "campus_spots", status: "ok", finishedAt: "2026-10-27T11:30:00Z" }),
      run({ id: 3, kind: "campus_spots", status: "error", error: "pool incomplete" }),
      run({ id: 2, kind: "location_library", status: "ok", finishedAt: "2026-10-26T09:00:00Z" }),
    ];
    expect(syncHealthFrom(runs)).toEqual({
      lastOk: { campus_spots: "2026-10-27T11:30:00Z", location_library: "2026-10-26T09:00:00Z" },
      lastAttempt: { location_library: "2026-10-27T12:00:00Z", campus_spots: "2026-10-27T10:00:00Z" },
      lastWorkerRun: null,
      failures: [{ runId: 5, kind: "location_library", scope: SESSION, error: "timeout", startedAt: "2026-10-27T12:00:00Z" }],
    });
  });

  it("has no last success for a kind that never succeeded", () => {
    expect(syncHealthFrom([]).lastOk).toEqual({});
  });
});

describe("taggingHealthFrom", () => {
  it("maps the audit counts", () => {
    expect(taggingHealthFrom({ counts, errors: [] }))
      .toEqual({ needsTagging: 12, gradsMissingSchool: 4, awaitingLocation: 9 });
  });

  it("refuses an incomplete audit instead of reporting low counts", () => {
    expect(() => taggingHealthFrom({ counts, errors: ["session_photos: timeout"] })).toThrow(/incomplete/);
  });
});

describe("campusSpotHealthFrom", () => {
  it("counts spots showing no photo: unmatchable, unmatched and not yet claimed", () => {
    expect(campusSpotHealthFrom({ notMatchable: ["a"], claimed: [1, 2], unmatched: [1, 2, 3] }))
      .toEqual({ empty: 6, fillable: 2 });
  });
});

describe("healthItems", () => {
  const report: ContentHealthReport = {
    sync: { ok: true, value: { lastOk: {}, lastAttempt: {}, lastWorkerRun: null, failures: [] } },
    jobs: { ok: true, value: { queued: 1, running: 0, stalled: 1, waitingTooLong: 0, recentFailures: [], lastActivity: null } },
    publishedPhotos: { ok: true, value: { published: 119 } },
    tagging: { ok: true, value: { needsTagging: 12, gradsMissingSchool: 0, awaitingLocation: 9 } },
    campusSpots: { ok: false, error: "photo pool incomplete" },
    locationGuides: { ok: true, value: { awaitingReview: 2 } },
  };

  it("links each issue to the editor that fixes it", () => {
    expect(healthItems(report).map((i) => [i.key, i.href])).toEqual([
      ["published-photos", "/admin?tab=portfolio"],
      ["failed-runs", "/admin/content-engine"],
      ["waiting-runs", "/admin/content-engine"],
      ["needs-tagging", "/admin/content-engine/photos?filter=needs"],
      ["grads-missing-school", "/admin/content-engine/photos?filter=grads-missing-school"],
      ["awaiting-location", "/admin/content-engine/photos?filter=suggestions"],
      ["empty-campus-spots", "/admin?tab=locations"],
      ["guides-awaiting-review", "/admin/content-engine/locations"],
    ]);
  });

  it("shows a failed part as unavailable (null), never 0, and keeps real zeros", () => {
    const byKey = Object.fromEntries(healthItems(report).map((i) => [i.key, i]));
    expect(byKey["empty-campus-spots"]).toMatchObject({ count: null, detail: "photo pool incomplete" });
    expect(byKey["grads-missing-school"].count).toBe(0);
    expect(byKey["guides-awaiting-review"].count).toBe(2);
  });

  it("marks every tagging row unavailable when the audit failed", () => {
    const items = healthItems({ ...report, tagging: { ok: false, error: "audit incomplete" } });
    const tagKeys = ["needs-tagging", "grads-missing-school", "awaiting-location"];
    expect(items.filter((i) => tagKeys.includes(i.key)).map((i) => i.count)).toEqual([null, null, null]);
  });

  it("notes fillable spots", () => {
    const items = healthItems({ ...report, campusSpots: { ok: true, value: { empty: 5, fillable: 2 } } });
    expect(items.find((i) => i.key === "empty-campus-spots")).toMatchObject({ count: 5, detail: "2 fillable by the next sync" });
  });

  it("shows published photos as information, never as a problem", () => {
    expect(healthItems(report).find((i) => i.key === "published-photos")).toMatchObject({ count: 119, informational: true });
  });
});

describe("content runs and the worker heartbeat", () => {
  const now = new Date("2026-10-27T12:00:00Z").getTime();
  const job = (over: Partial<JobRow>): JobRow => ({
    id: "j1", photography_session_id: SESSION, status: "succeeded", attempts: 0, last_error: null,
    lease_expires_at: null, updated_at: "2026-10-27T11:00:00Z", finished_at: "2026-10-27T11:00:00Z", ...over,
  });

  it("counts waiting, stalled and recently failed runs with their errors", () => {
    const health = jobsHealthFrom([
      job({ id: "a", status: "running", lease_expires_at: "2026-10-27T11:58:00Z", updated_at: "2026-10-27T11:57:00Z" }),
      job({ id: "b", status: "queued", updated_at: "2026-10-27T01:00:00Z", finished_at: null }),
      job({ id: "c", status: "failed", last_error: "model timeout", attempts: 5, finished_at: "2026-10-26T12:00:00Z" }),
      job({ id: "d", status: "failed", last_error: "ancient", finished_at: "2026-08-01T12:00:00Z" }),
    ], now);
    expect(health).toMatchObject({ queued: 1, running: 1, stalled: 1, waitingTooLong: 1, lastActivity: "2026-10-27T11:57:00Z" });
    expect(health.recentFailures).toEqual([
      { jobId: "c", sessionId: SESSION, error: "model timeout", attempts: 5, at: "2026-10-26T12:00:00Z" },
    ]);
  });

  it("calls the worker idle after 6 quiet hours or when it never ran", () => {
    expect(workerLooksIdle(null, now)).toBe(true);
    expect(workerLooksIdle("2026-10-27T05:00:00Z", now)).toBe(true);
    expect(workerLooksIdle("2026-10-27T11:00:00Z", now)).toBe(false);
  });
});
