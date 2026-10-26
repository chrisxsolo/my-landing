import { describe, it, expect, vi } from "vitest";
import { GenerationError, keepKnownPhotoPlacements } from "@/lib/contentEngine/generationTargetCore";

const A = "8a3f1c2e-4b5d-4e6f-9a7b-1c2d3e4f5a6b";
const B = "0f9e8d7c-6b5a-4c3d-8e2f-a1b2c3d4e5f6";
const known = new Set([A, B]);

describe("keepKnownPhotoPlacements", () => {
  it("drops a placement whose photo id the model garbled and keeps the rest", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const kept = keepKnownPhotoPlacements(
      [{ session_photo_id: A, guide: "couples" }, { session_photo_id: "8a3f1c2e-4b5d-4e6f-9a7b-1c2d3e4f5a", guide: "couples" }],
      known, "guide_photo",
    );
    expect(kept).toEqual([{ session_photo_id: A, guide: "couples" }]);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("normalizes case and whitespace before matching", () => {
    const kept = keepKnownPhotoPlacements([{ session_photo_id: ` ${B.toUpperCase()} ` }], known, "guide_photo");
    expect(kept).toEqual([{ session_photo_id: B }]);
  });

  it("returns an empty list when the model placed nothing", () => {
    expect(keepKnownPhotoPlacements([], known, "guide_photo")).toEqual([]);
  });

  it("fails when every placement names an unknown photo", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => keepKnownPhotoPlacements([{ session_photo_id: "nope" }, null], known, "guide_photo"))
      .toThrow(GenerationError);
  });
});
