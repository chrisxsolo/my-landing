import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordSyncRun, summarizeSyncRuns, type SyncRunRow } from "@/lib/photoSync/runLog";

function fakeClient(opts: { insertError?: boolean } = {}) {
  const updates: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve(opts.insertError
            ? { data: null, error: { message: "relation does not exist" } }
            : { data: { id: 7 }, error: null }),
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: () => { updates.push(patch); return Promise.resolve({ error: null }); },
      }),
    }),
  } as unknown as SupabaseClient;
  return { client, updates };
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
