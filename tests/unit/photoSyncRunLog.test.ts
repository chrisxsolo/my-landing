import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STALLED_RUN_ERROR, recordSyncRun, runLogged, summarizeSyncRuns, type SyncRunRow } from "@/lib/photoSync/runLog";

function fakeClient(opts: { insertError?: boolean; busy?: boolean } = {}) {
  // Run finishes (filtered by id) and stalled-run closes (filtered by kind/status/age).
  const updates: Record<string, unknown>[] = [];
  const stalledCloses: string[][] = [];
  const insertResult = opts.busy
    ? { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } }
    : opts.insertError
      ? { data: null, error: { message: "relation does not exist" } }
      : { data: { id: 7 }, error: null };
  const client = {
    from: () => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve(insertResult) }) }),
      update: (patch: Record<string, unknown>) => {
        const filters: string[] = [];
        const query = {
          eq: (column: string) => { filters.push(column); return query; },
          lt: (column: string) => { filters.push(column); return query; },
          then: (resolve: (v: { error: null }) => unknown) => {
            if (filters.includes("id")) updates.push(patch);
            else stalledCloses.push(filters);
            return Promise.resolve({ error: null }).then(resolve);
          },
        };
        return query;
      },
    }),
  } as unknown as SupabaseClient;
  return { client, updates, stalledCloses };
}

describe("recordSyncRun", () => {
  it("logs a clean run as ok", async () => {
    const { client, updates } = fakeClient();
    const result = await recordSyncRun(client, { kind: "campus_spots" }, async () => 3, (n) => ({ detail: { filled: n } }));
    expect(result).toBe(3);
    expect(updates[0]).toMatchObject({ status: "ok", error: null, detail: { filled: 3 } });
  });

  it("logs a reported error as failed without throwing", async () => {
    const { client, updates } = fakeClient();
    await recordSyncRun(client, { kind: "location_library" }, async () => ({ status: "error" }), () => ({ error: "read failed" }));
    expect(updates[0]).toMatchObject({ status: "error", error: "read failed" });
  });

  it("logs and re-throws a thrown error", async () => {
    const { client, updates } = fakeClient();
    await expect(recordSyncRun(client, { kind: "campus_spots" }, async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(updates[0]).toMatchObject({ status: "error", error: "boom" });
  });

  it("closes runs of the same kind that died before reporting, then starts", async () => {
    const { client, stalledCloses } = fakeClient();
    await recordSyncRun(client, { kind: "campus_spots" }, async () => 1);
    expect(stalledCloses).toEqual([["kind", "status", "started_at"]]);
  });

  it("skips without running the sync when the same kind and scope is already running", async () => {
    const { client, updates } = fakeClient({ busy: true });
    let ran = false;
    const logged = await runLogged(client, { kind: "campus_spots" }, async () => { ran = true; });
    expect(ran).toBe(false);
    expect(logged).toMatchObject({ ok: false, skipped: true, runId: null });
    expect(updates).toHaveLength(0);
    await expect(recordSyncRun(client, { kind: "campus_spots" }, async () => 1)).rejects.toThrow(/already running/);
  });

  it("still runs the sync when the log table is missing", async () => {
    const { client, updates } = fakeClient({ insertError: true });
    expect(await recordSyncRun(client, { kind: "campus_spots" }, async () => "done")).toBe("done");
    expect(updates).toHaveLength(0);
  });
});

const run = (over: Partial<SyncRunRow>): SyncRunRow => ({
  id: 1, kind: "campus_spots", scope: null, status: "ok", trigger: "worker",
  startedAt: "2026-10-27T10:00:00Z", finishedAt: "2026-10-27T10:00:05Z", error: null, detail: null, retryOf: null, ...over,
});

describe("summarizeSyncRuns", () => {
  it("reports the newest success per kind and failures not since healed", () => {
    const sessionA = "11111111-1111-1111-1111-111111111111";
    const health = summarizeSyncRuns([
      run({ id: 5, kind: "location_library", scope: sessionA, status: "error", error: "timeout", startedAt: "2026-10-27T12:00:00Z" }),
      run({ id: 4, kind: "campus_spots", status: "ok", finishedAt: "2026-10-27T11:00:05Z" }),
      run({ id: 3, kind: "campus_spots", status: "error", error: "old failure" }),
    ]);
    expect(health.lastOk.campus_spots).toBe("2026-10-27T11:00:05Z");
    expect(health.unresolvedFailures.map((r) => r.id)).toEqual([5]);
  });

  it("treats a later full sync as healing an earlier session failure", () => {
    const health = summarizeSyncRuns([
      run({ id: 2, kind: "location_library", scope: null, status: "ok" }),
      run({ id: 1, kind: "location_library", scope: "11111111-1111-1111-1111-111111111111", status: "error" }),
    ]);
    expect(health.unresolvedFailures).toEqual([]);
  });
});

describe("summarizeSyncRuns: stalled runs, attempts and the worker heartbeat", () => {
  const now = new Date("2026-10-27T12:00:00Z").getTime();

  it("reports a run stuck in running for over 15 minutes as an unresolved failure", () => {
    const health = summarizeSyncRuns([
      run({ id: 9, status: "running", finishedAt: null, startedAt: "2026-10-27T11:00:00Z" }),
    ], now);
    expect(health.unresolvedFailures.map((r) => [r.id, r.error])).toEqual([[9, STALLED_RUN_ERROR]]);
  });

  it("leaves a run that is still within its window alone", () => {
    const health = summarizeSyncRuns([
      run({ id: 9, status: "running", finishedAt: null, startedAt: "2026-10-27T11:55:00Z" }),
    ], now);
    expect(health.unresolvedFailures).toEqual([]);
  });

  it("tracks the newest attempt per kind and the newest worker run", () => {
    const health = summarizeSyncRuns([
      run({ id: 3, kind: "location_library", trigger: "admin", status: "error", startedAt: "2026-10-27T11:30:00Z" }),
      run({ id: 2, kind: "campus_spots", trigger: "worker", startedAt: "2026-10-27T11:00:00Z" }),
      run({ id: 1, kind: "campus_spots", trigger: "worker", startedAt: "2026-10-27T10:00:00Z" }),
    ], now);
    expect(health.lastAttempt).toEqual({ location_library: "2026-10-27T11:30:00Z", campus_spots: "2026-10-27T11:00:00Z" });
    expect(health.lastWorkerRun).toBe("2026-10-27T11:00:00Z");
  });
});
