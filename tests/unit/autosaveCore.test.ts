import { describe, it, expect } from "vitest";
import {
  initialAutosaveState, autosaveReducer, draftStorageKey,
} from "@/app/admin/content-engine/[id]/autosaveCore";

describe("autosaveCore (spec §7.4 Autosave states)", () => {
  it("edit → saving → saved transitions with revision tracking", () => {
    let s = initialAutosaveState(3);
    expect(s.status).toBe("idle");
    s = autosaveReducer(s, { type: "edited" });
    expect(s.status).toBe("editing");
    expect(s.dirty).toBe(true);
    s = autosaveReducer(s, { type: "save_started" });
    expect(s.status).toBe("saving");
    s = autosaveReducer(s, { type: "save_succeeded", payloadRevision: 4, at: "3:42pm" });
    expect(s.status).toBe("saved");
    expect(s.revision).toBe(4);
    expect(s.dirty).toBe(false);
    expect(s.savedAt).toBe("3:42pm");
  });

  it("an edit DURING a save keeps the state dirty after success", () => {
    let s = initialAutosaveState(1);
    s = autosaveReducer(s, { type: "edited" });
    s = autosaveReducer(s, { type: "save_started" });
    s = autosaveReducer(s, { type: "edited" }); // keystroke while in flight
    s = autosaveReducer(s, { type: "save_succeeded", payloadRevision: 2, at: "now" });
    expect(s.dirty).toBe(true); // needs another save
    expect(s.revision).toBe(2);
  });

  it("save failure preserves the local backup flag", () => {
    let s = initialAutosaveState(1);
    s = autosaveReducer(s, { type: "edited" });
    s = autosaveReducer(s, { type: "save_started" });
    s = autosaveReducer(s, { type: "save_failed", message: "network down" });
    expect(s.status).toBe("save_failed");
    expect(s.dirty).toBe(true);
    expect(s.error).toBe("network down");
  });

  it("conflict carries the server copy for the comparison prompt", () => {
    let s = initialAutosaveState(1);
    s = autosaveReducer(s, { type: "edited" });
    s = autosaveReducer(s, { type: "save_started" });
    s = autosaveReducer(s, {
      type: "conflict",
      server: { payload: { x: 1 }, payload_revision: 5, status: "draft" },
    });
    expect(s.status).toBe("conflict");
    expect(s.conflict!.payload_revision).toBe(5);
    // resolving with the server copy adopts its revision and clears dirty
    s = autosaveReducer(s, { type: "conflict_resolved", adopt: "server" });
    expect(s.status).toBe("idle");
    expect(s.revision).toBe(5);
    expect(s.dirty).toBe(false);
    // resolving keep-mine keeps dirty so the next tick re-saves at the new revision
    let k = initialAutosaveState(1);
    k = autosaveReducer(k, { type: "edited" });
    k = autosaveReducer(k, { type: "save_started" });
    k = autosaveReducer(k, {
      type: "conflict",
      server: { payload: { x: 1 }, payload_revision: 5, status: "draft" },
    });
    k = autosaveReducer(k, { type: "conflict_resolved", adopt: "mine" });
    expect(k.revision).toBe(5); // rebases onto the server revision
    expect(k.dirty).toBe(true);
  });

  it("uses the spec localStorage key pattern", () => {
    expect(draftStorageKey("abc")).toBe("draft_abc");
  });
});
