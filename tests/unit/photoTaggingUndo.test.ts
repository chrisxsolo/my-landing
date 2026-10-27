import { describe, expect, it } from "vitest";
import { outcome } from "@/lib/photoTagging/plan";
import { undoRequests } from "@/lib/photoTagging/undo";

describe("undo", () => {
  it("restores only updated fields, spots first, and a session value once", () => {
    const requests = undoRequests([
      outcome("engine:a", "school", "updated", { scope: "session", writeId: "session:s1", previous: null, value: "usf" }),
      outcome("engine:b", "school", "updated", { scope: "session", writeId: "session:s1", previous: null, value: "usf" }),
      outcome("engine:a", "spot", "updated", { writeId: "spot:usf:u", previous: null, value: "gleeson-library" }),
      outcome("portfolio:1", "location", "updated", { writeId: "portfolio:1", previous: "Crissy Field", value: "Legion of Honor" }),
      outcome("portfolio:2", "location", "failed", { previous: null, value: "Legion of Honor" }),
      outcome("portfolio:3", "location", "kept"),
      outcome("portfolio:4", "category", "updated", { writeId: "portfolio:4", previous: null, value: "couples" }),
    ]);
    expect(requests).toEqual([
      { keys: ["engine:a"], changes: { spot: null } },
      { keys: ["engine:a"], changes: { school: null } },
      { keys: ["portfolio:1"], changes: { location: "Crissy Field" } },
    ]);
  });

  it("batches photos that restore the same value", () => {
    const requests = undoRequests([
      outcome("portfolio:1", "location", "updated", { writeId: "portfolio:1", previous: null }),
      outcome("portfolio:2", "location", "updated", { writeId: "portfolio:2", previous: null }),
    ]);
    expect(requests).toEqual([{ keys: ["portfolio:1", "portfolio:2"], changes: { location: null } }]);
  });
});
