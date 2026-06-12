import { describe, it, expect } from "vitest";
import { STATE_BADGES, actionabilityRank, sortByActionability } from "@/app/admin/content-engine/stateBadge";

describe("state badges (spec §7.1)", () => {
  it("has a badge for all ten derived states", () => {
    for (const s of ["failed", "publishing", "partially_published", "published", "reviewed",
                     "generated", "analyzing", "analyzed", "uploaded", "empty"]) {
      expect(STATE_BADGES[s as keyof typeof STATE_BADGES].label.length).toBeGreaterThan(0);
    }
  });

  it("default sort is by actionability: failed first, done last (spec §7.1)", () => {
    expect(actionabilityRank("failed")).toBeLessThan(actionabilityRank("reviewed"));
    expect(actionabilityRank("reviewed")).toBeLessThan(actionabilityRank("generated"));
    expect(actionabilityRank("generated")).toBeLessThan(actionabilityRank("analyzing"));
    expect(actionabilityRank("uploaded")).toBeLessThan(actionabilityRank("published"));

    const rows = [
      { id: "a", state: "published" }, { id: "b", state: "failed" }, { id: "c", state: "generated" },
    ] as { id: string; state: keyof typeof STATE_BADGES }[];
    expect(sortByActionability(rows).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
});
