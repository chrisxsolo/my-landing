// Multi-select in a session's photo grid as it feeds the batch tag editor:
// the toolbar's words, which audited photos the editor receives (selected
// only, once each, in grid order), and when the editor stays open.
import { describe, expect, it } from "vitest";
import { selectedAudited, selectionLabels, stillNeedsEditing } from "@/lib/photoTagging/gridSelection";
import type { AuditedPhoto } from "@/lib/photoTagging/types";

const engineId = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;

function audited(n: number, status: AuditedPhoto["status"] = "partial"): AuditedPhoto {
  return {
    key: `engine:${engineId(n)}`, source: "engine", portfolioId: null, enginePhotoId: engineId(n), sessionId: null, sessionName: null,
    url: null, published: false, title: `Photo ${n}`, category: "grads", school: null, status, checks: [], suggestions: [], pages: [],
    spotTaggable: false, aiAnalyzedAt: null,
  };
}

describe("selection toolbar", () => {
  it("names the count, the Tag selected action and the delete action", () => {
    expect(selectionLabels(9)).toEqual({ count: "9 selected", tag: "Tag 9 selected", remove: "Delete 9 photos" });
    expect(selectionLabels(1).remove).toBe("Delete 1 photo");
  });
});

describe("what the batch editor receives", () => {
  const byId = new Map([1, 2, 3].map((n) => [engineId(n), audited(n)] as const));

  it("only the selected photos, in grid order", () => {
    const picked = selectedAudited(new Set([engineId(3), engineId(1)]), [engineId(1), engineId(2), engineId(3)], byId);
    expect(picked.map((p) => p.title)).toEqual(["Photo 1", "Photo 3"]);
  });

  it("each photo once, even when the grid order repeats an id", () => {
    const picked = selectedAudited(new Set([engineId(2)]), [engineId(2), engineId(2)], byId);
    expect(picked).toHaveLength(1);
  });

  it("drops ids the audit does not know (an excluded photo has no audit entry)", () => {
    expect(selectedAudited(new Set([engineId(9)]), [engineId(9)], byId)).toEqual([]);
  });
});

describe("after a successful write", () => {
  it("keeps the editor open while a selected photo still needs editing, closes it once all are fully tagged", () => {
    expect(stillNeedsEditing([audited(1, "full"), audited(2, "partial")])).toBe(true);
    expect(stillNeedsEditing([audited(1, "full"), audited(2, "full")])).toBe(false);
    expect(stillNeedsEditing([audited(1, "needs")])).toBe(true);
  });
});
