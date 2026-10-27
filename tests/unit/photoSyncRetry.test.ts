// Photo syncs are logged in photo_sync_runs, failures turn the run red, and a
// failed run can be retried with a link back to it.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FullSyncReport, SessionSyncReport } from "@/lib/locationLibrary/sync";
import { summarizeFullSync } from "@/lib/locationLibrary/syncSummary";
import { LOCATIONS_TABLE } from "@/lib/locationLibrary/taxonomy";
import { runLogged } from "@/lib/photoSync/runLog";
import { parseSyncAction } from "@/lib/photoSync/syncAction";
import { fakeSupabase, type FakeSupabase } from "./support/fakeSupabase";

let fake: FakeSupabase;
vi.mock("@/lib/supabaseAdmin", () => ({ createSupabaseAdminClient: () => fake.client }));
vi.mock("@/lib/publicRevalidation", () => ({ revalidatePublicContent: () => undefined }));

const SESSION_ID = "11111111-2222-4333-8444-555555555555";
const RUNS = "photo_sync_runs";

const session = (over: Partial<SessionSyncReport>): SessionSyncReport => ({
  sessionId: SESSION_ID, status: "synced", message: "Matched Palace of Fine Arts.", createdKeys: [],
  createdLocationIds: [], linkedKeys: ["palace-of-fine-arts"], removedLinks: 0, dryRun: false, ...over,
});

describe("sync run summaries", () => {
  it("logs a full location sweep with a failed session as failed", () => {
    const report: FullSyncReport = { claims: [], dryRun: false, sessions: [
      session({}), session({ sessionId: "s-2", status: "error", message: "could not load session photos: timeout" }),
    ] };
    expect(summarizeFullSync(report)).toMatchObject({
      error: "1 of 2 sessions failed — s-2: could not load session photos: timeout",
      detail: { sessions: 2, failed: 1 },
    });
  });

  it("returns the run id and a failure without throwing", async () => {
    fake = fakeSupabase({ [RUNS]: [] });
    const run = await runLogged(fake.client, { kind: "campus_spots" }, async () => { throw new Error("pool incomplete"); });
    expect(run).toMatchObject({ runId: 1, ok: false, error: "pool incomplete", result: null });
    expect(fake.tables[RUNS][0]).toMatchObject({ status: "error", error: "pool incomplete" });
  });
});

describe("photo sync request body", () => {
  it("accepts a retry or a run and rejects anything else", () => {
    expect(parseSyncAction({ action: "retry", runId: 7 })).toEqual({ action: "retry", runId: 7 });
    expect(parseSyncAction({ action: "run", kind: "campus_spots" })).toEqual({ action: "run", kind: "campus_spots" });
    expect(parseSyncAction({ action: "retry", runId: "7" })).toEqual({ error: "runId must be a positive integer" });
    expect(parseSyncAction({ action: "run", kind: "everything" })).toMatchObject({ error: expect.stringMatching(/kind must be/) });
    expect(parseSyncAction(null)).toEqual({ error: "body must be a JSON object" });
  });
});

describe("retrying a failed sync", () => {
  beforeEach(() => {
    fake = fakeSupabase({
      [RUNS]: [{ id: 7, kind: "location_library", scope: SESSION_ID, status: "error", trigger: "worker",
        started_at: "2026-10-27T10:00:00Z", finished_at: "2026-10-27T10:00:02Z", error: "timeout", detail: null, retry_of: null }],
      photography_sessions: [{ id: SESSION_ID, primary_location: "Palace of Fine Arts", secondary_locations: [],
        marketing_permission: true, marketing_permission_revoked_at: null }],
      session_photos: [{ id: "p-1", photography_session_id: SESSION_ID, excluded: false, gps_latitude: null,
        gps_longitude: null, public_derivative_url: "https://x/p-1.jpg" }],
      [LOCATIONS_TABLE]: [{ id: 3, location_key: "palace-of-fine-arts", alias_keys: [], slug: "palace-of-fine-arts", title: "Palace of Fine Arts", order: 1 }],
    });
  });

  it("re-runs the same kind and scope, logged as a retry of the failed run", async () => {
    const { retryPhotoSync } = await import("@/lib/photoSync/runSync");
    const result = await retryPhotoSync(fake.client, 7);
    expect(result).toEqual({ ok: true, runId: 8 });
    expect(fake.tables[RUNS].find((r) => r.id === 8)).toMatchObject({
      kind: "location_library", scope: SESSION_ID, trigger: "retry", retry_of: 7, status: "ok",
    });
  });

  it("answers null for an unknown run", async () => {
    const { retryPhotoSync } = await import("@/lib/photoSync/runSync");
    expect(await retryPhotoSync(fake.client, 99)).toBeNull();
  });
});

describe("a campus sweep that cannot read everything", () => {
  it("is logged as a failed worker run and releases nothing", async () => {
    const auto = [{ school_slug: "sjsu", spot_key: "tower-hall-steps", image_url: "https://x/1.jpg", evidence: "text" }];
    fake = fakeSupabase({ [RUNS]: [], campus_spot_auto_photos: auto }, { failRead: { table: "portfolio_images" } });
    const { runCampusSpotSyncLogged } = await import("@/lib/campusSpotFill/autoSync");
    const run = await runCampusSpotSyncLogged("worker");
    expect(run.ok).toBe(false);
    expect(fake.tables[RUNS][0]).toMatchObject({ kind: "campus_spots", trigger: "worker", status: "error" });
    expect(fake.ops.filter((op) => op.table === "campus_spot_auto_photos")).toEqual([]);
    expect(fake.tables.campus_spot_auto_photos).toEqual(auto);
  });
});
