// photo_change_log entries: one per updated field, session values once, link
// changes only when the set of links really changed, and only tag fields
// restorable. Logging itself never throws (lib/photoChangeLog/log.ts).
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { entriesFromOutcomes, isRestorable, linkChangeEntry, sessionKey } from "@/lib/photoChangeLog/entries";
import { logChanges } from "@/lib/photoChangeLog/log";
import { outcome } from "@/lib/photoTagging/plan";

describe("entriesFromOutcomes", () => {
  it("logs updated fields only, and a session-wide value once under the session key", () => {
    const entries = entriesFromOutcomes([
      outcome("engine:a", "school", "updated", { scope: "session", writeId: "session:s1", previous: null, value: "usf" }),
      outcome("engine:b", "school", "updated", { scope: "session", writeId: "session:s1", previous: null, value: "usf" }),
      outcome("portfolio:1", "location", "updated", { writeId: "portfolio:1", previous: "Crissy Field", value: "Legion of Honor" }),
      outcome("portfolio:2", "location", "kept"),
      outcome("portfolio:3", "spot", "failed", { previous: null, value: "sather-gate" }),
    ], "manual", "undo");
    expect(entries).toEqual([
      { key: "session:s1", field: "school", oldValue: null, newValue: "usf", actor: "manual", reason: "undo" },
      { key: "portfolio:1", field: "location", oldValue: "Crissy Field", newValue: "Legion of Honor", actor: "manual", reason: "undo" },
    ]);
  });
});

describe("linkChangeEntry", () => {
  it("is null when the linked locations did not change, whatever the order", () => {
    expect(linkChangeEntry("s1", [2, 1], [1, 2], "Matched X.")).toBeNull();
  });

  it("records the sync's before/after as a system change", () => {
    expect(linkChangeEntry("s1", [10], [], "Campus: UC Berkeley")).toEqual({
      key: sessionKey("s1"), field: "library_links", oldValue: { locationIds: [10] }, newValue: { locationIds: [] },
      actor: "system", reason: "Campus: UC Berkeley",
    });
  });
});

describe("isRestorable", () => {
  it("allows tag fields with a string or null old value, never link lists", () => {
    expect(isRestorable({ field: "location", oldValue: "Crissy Field" })).toBe(true);
    expect(isRestorable({ field: "school", oldValue: null })).toBe(true);
    expect(isRestorable({ field: "library_links", oldValue: { locationIds: [1] } })).toBe(false);
  });
});

describe("logChanges", () => {
  it("reports a failed write and never throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = { from: () => ({ insert: async () => ({ error: { message: "relation missing" } }) }) } as unknown as SupabaseClient;
    await expect(logChanges(client, [{ key: "portfolio:1", field: "location", oldValue: null, newValue: "X", actor: "manual", reason: null }]))
      .resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/could not record 1 change/));
    const thrower = { from: () => { throw new Error("boom"); } } as unknown as SupabaseClient;
    await expect(logChanges(thrower, [{ key: "portfolio:1", field: "spot", oldValue: null, newValue: "x", actor: "system", reason: null }]))
      .resolves.toBeUndefined();
    error.mockRestore();
  });

  it("does nothing for an empty list", async () => {
    const from = vi.fn();
    await logChanges({ from } as unknown as SupabaseClient, []);
    expect(from).not.toHaveBeenCalled();
  });
});
