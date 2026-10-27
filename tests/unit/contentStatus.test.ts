import { describe, expect, it } from "vitest";
import { CONTENT_STATUS } from "@/lib/contentStatus";
import { STATE_BADGES } from "@/app/admin/content-engine/stateBadge";
import { STATUS_CHIP, syncChipFor } from "@/app/admin/content-engine/locations/libraryUi";

describe("content status vocabulary", () => {
  it("gives every state a distinct label with a color pair", () => {
    const labels = Object.values(CONTENT_STATUS).map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const meta of Object.values(CONTENT_STATUS)) {
      expect(meta.color).toMatch(/^#|^rgba?\(/);
      expect(meta.bg).toMatch(/^#|^rgba?\(/);
    }
  });

  it("is what the session badges say for the content states", () => {
    expect(STATE_BADGES.reviewed.label).toBe(CONTENT_STATUS.approved.label);
    expect(STATE_BADGES.generated.label).toBe(CONTENT_STATUS.needs_review.label);
    expect(STATE_BADGES.published.label).toBe(CONTENT_STATUS.published.label);
    expect(STATE_BADGES.failed.label).toBe(CONTENT_STATUS.failed.label);
  });

  it("is what the location library chips say", () => {
    expect(STATUS_CHIP.review.label).toBe(CONTENT_STATUS.needs_review.label);
    expect(STATUS_CHIP.published.label).toBe(CONTENT_STATUS.published.label);
    expect(STATUS_CHIP.unpublished.label).toBe(CONTENT_STATUS.hidden.label);
  });

  it("keeps the sync 'needs_review' value apart from content review", () => {
    expect(syncChipFor("needs_review").label).toBe("Needs a location");
    expect(syncChipFor("needs_review").label).not.toBe(CONTENT_STATUS.needs_review.label);
    expect(syncChipFor(null).label).toBe("Not synced");
    expect(syncChipFor("synced").label).toBe("Synced");
    expect(syncChipFor("something_new").label).toBe("something_new"); // an unknown value still renders
  });
});
