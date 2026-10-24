import { describe, it, expect } from "vitest";
import {
  GENERATION_ORDER, journalReady, nextGenerationWave, pendingGenerationTypesFrom,
  settledGenerationCount, MAX_TYPE_ATTEMPTS_PER_RUN,
  type GenerationProgressMap,
} from "@/lib/contentEngine/generationProgress";

const ALL = [...GENERATION_ORDER];

function progress(entries: Record<string, [string, number?]>): GenerationProgressMap {
  return Object.fromEntries(
    Object.entries(entries).map(([type, [status, attempt]]) => [
      type, { status: status as "pending", attempt },
    ]),
  );
}

describe("GENERATION_ORDER", () => {
  it("puts journal_post last — it consumes the link and testimonial drafts", () => {
    expect(GENERATION_ORDER.at(-1)).toBe("journal_post");
    expect(GENERATION_ORDER.indexOf("internal_link_suggestion"))
      .toBeLessThan(GENERATION_ORDER.indexOf("journal_post"));
    expect(GENERATION_ORDER.indexOf("testimonial_feature"))
      .toBeLessThan(GENERATION_ORDER.indexOf("journal_post"));
  });
});

describe("pendingGenerationTypesFrom", () => {
  it("keeps only non-terminal selected types, in generation order", () => {
    const types = pendingGenerationTypesFrom(ALL, progress({
      journal_post: ["pending"],
      portfolio_pick: ["completed"],
      school_page_photo: ["skipped"],
      guide_photo: ["failed"],
      internal_link_suggestion: ["processing"],
      testimonial_feature: ["completed"],
    }));
    expect(types).toEqual(["internal_link_suggestion", "guide_photo", "journal_post"]);
  });

  it("ignores a type that is not selected for this package", () => {
    const types = pendingGenerationTypesFrom(["journal_post"], progress({
      journal_post: ["pending"], portfolio_pick: ["pending"],
    }));
    expect(types).toEqual(["journal_post"]);
  });
});

describe("nextGenerationWave", () => {
  it("runs every independent type together and holds the journal post back", () => {
    const map = progress({
      internal_link_suggestion: ["pending"],
      testimonial_feature: ["pending"],
      portfolio_pick: ["pending"],
      journal_post: ["pending"],
    });
    expect(nextGenerationWave(ALL, map))
      .toEqual(["internal_link_suggestion", "testimonial_feature", "portfolio_pick"]);
  });

  it("lets the journal post run beside the slow picks once its own inputs are written", () => {
    const map = progress({
      internal_link_suggestion: ["completed"], testimonial_feature: ["skipped"],
      portfolio_pick: ["pending"], journal_post: ["pending"],
    });
    expect(nextGenerationWave(ALL, map)).toEqual(["portfolio_pick", "journal_post"]);
    expect(journalReady(ALL, map)).toBe(true);
  });

  it("holds the journal post while an input is due a retry", () => {
    const map = progress({
      internal_link_suggestion: ["failed", 1], journal_post: ["pending"],
    });
    expect(journalReady(ALL, map)).toBe(false);
    expect(nextGenerationWave(ALL, map)).toEqual(["internal_link_suggestion"]);
  });

  it("releases the journal post once the others are settled", () => {
    const map = progress({
      internal_link_suggestion: ["completed"], portfolio_pick: ["skipped"], journal_post: ["pending"],
    });
    expect(nextGenerationWave(ALL, map)).toEqual(["journal_post"]);
  });

  it("is empty when every selected type is terminal", () => {
    const map = progress({ journal_post: ["completed"], portfolio_pick: ["skipped"] });
    expect(nextGenerationWave(ALL, map)).toEqual([]);
  });

  it("retries a failed type until it burns its attempts, then moves on", () => {
    const failedOnce = progress({
      portfolio_pick: ["failed", MAX_TYPE_ATTEMPTS_PER_RUN - 1],
      journal_post: ["pending"],
    });
    // The journal post doesn't read the portfolio pick, so it need not wait for the retry.
    expect(nextGenerationWave(ALL, failedOnce)).toEqual(["portfolio_pick", "journal_post"]);

    const exhausted = progress({
      portfolio_pick: ["failed", MAX_TYPE_ATTEMPTS_PER_RUN],
      journal_post: ["pending"],
    });
    expect(nextGenerationWave(ALL, exhausted)).toEqual(["journal_post"]);
  });

  it("ends rather than loops when every remaining type is exhausted", () => {
    const map = progress({
      guide_photo: ["failed", 9], journal_post: ["failed", 9],
    });
    expect(nextGenerationWave(ALL, map)).toEqual([]);
  });

  it("passes over types the caller is already handling", () => {
    const map = progress({
      internal_link_suggestion: ["pending"], portfolio_pick: ["pending"],
    });
    expect(nextGenerationWave(ALL, map, { skip: new Set(["internal_link_suggestion"]) }))
      .toEqual(["portfolio_pick"]);
  });
});

describe("settledGenerationCount", () => {
  it("counts completed and skipped, not failed or pending", () => {
    const map = progress({
      journal_post: ["completed"], portfolio_pick: ["skipped"],
      guide_photo: ["failed"], school_page_photo: ["pending"],
    });
    expect(settledGenerationCount(ALL, map)).toBe(2);
  });
});
