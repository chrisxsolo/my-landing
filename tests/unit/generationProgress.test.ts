import { describe, it, expect } from "vitest";
import {
  GENERATION_ORDER, allGenerationSettled, journalReady, nextGenerationWave, pendingGenerationTypesFrom,
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

  it("holds the journal post while an input is processing under someone else's live claim", () => {
    const map = progress({
      internal_link_suggestion: ["processing"], testimonial_feature: ["completed"], journal_post: ["pending"],
    });
    expect(journalReady(ALL, map)).toBe(false);
    expect(nextGenerationWave(ALL, map)).toEqual(["internal_link_suggestion"]);
  });
});

describe("allGenerationSettled", () => {
  it("is true only when every selected type is completed, skipped, or failed past its attempts", () => {
    expect(allGenerationSettled(ALL, progress({ journal_post: ["completed"], portfolio_pick: ["skipped"] }))).toBe(true);
    expect(allGenerationSettled(ALL, progress({ journal_post: ["completed"], portfolio_pick: ["failed", MAX_TYPE_ATTEMPTS_PER_RUN] }))).toBe(true);
    expect(allGenerationSettled(ALL, progress({ journal_post: ["completed"], portfolio_pick: ["failed", 1] }))).toBe(false);
    expect(allGenerationSettled(ALL, progress({ journal_post: ["completed"], portfolio_pick: ["pending"] }))).toBe(false);
  });

  it("never calls a processing type settled, live or stalled", () => {
    expect(allGenerationSettled(ALL, progress({ portfolio_pick: ["processing"] }))).toBe(false);
  });

  it("is the complement of an empty wave, so an empty wave never hides unfinished work", () => {
    for (const map of [
      progress({ journal_post: ["processing"], portfolio_pick: ["completed"] }),
      progress({ journal_post: ["pending"], internal_link_suggestion: ["processing"] }),
      progress({ guide_photo: ["failed", 9], journal_post: ["failed", 9] }),
    ]) {
      expect(nextGenerationWave(ALL, map).length === 0).toBe(allGenerationSettled(ALL, map));
    }
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

// ── Lease-aware state (2026-11-03: the stuck-processing fix) ────────────────
import {
  effectiveGenerationState, leaseExpiresAtMs, retryableGenerationTypesFrom,
  type GenerationProgressEntry,
} from "@/lib/contentEngine/generationProgress";

const NOW = Date.parse("2026-11-04T02:20:00.000Z");
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe("effectiveGenerationState", () => {
  it("a processing entry with a live lease is running — not retryable", () => {
    const entry: GenerationProgressEntry = {
      status: "processing", attempt: 1, lease_started_at: at(-60_000), lease_expires_at: at(240_000),
    };
    expect(effectiveGenerationState(entry, NOW)).toBe("running");
  });

  it("a processing entry whose lease expired is stalled — recoverable", () => {
    const entry: GenerationProgressEntry = {
      status: "processing", attempt: 1, lease_started_at: at(-400_000), lease_expires_at: at(-1_000),
    };
    expect(effectiveGenerationState(entry, NOW)).toBe("stalled");
  });

  it("a lease that expires exactly now counts as expired (matches the RPC's <= now())", () => {
    expect(effectiveGenerationState({ status: "processing", lease_expires_at: at(0) }, NOW)).toBe("stalled");
  });

  it("a processing entry with a missing or malformed lease is stalled, never silently running", () => {
    expect(effectiveGenerationState({ status: "processing" }, NOW)).toBe("stalled");
    expect(effectiveGenerationState({ status: "processing", lease_expires_at: null }, NOW)).toBe("stalled");
    expect(effectiveGenerationState({ status: "processing", lease_expires_at: "not a date" }, NOW)).toBe("stalled");
    expect(leaseExpiresAtMs({ status: "processing", lease_expires_at: "not a date" })).toBeNull();
    expect(leaseExpiresAtMs({ status: "processing" })).toBeNull();
  });

  it("terminal and pending statuses pass through unchanged", () => {
    expect(effectiveGenerationState({ status: "pending" }, NOW)).toBe("pending");
    expect(effectiveGenerationState({ status: "failed", error: "x" }, NOW)).toBe("failed");
    expect(effectiveGenerationState({ status: "completed" }, NOW)).toBe("completed");
    expect(effectiveGenerationState({ status: "skipped" }, NOW)).toBe("skipped");
    expect(effectiveGenerationState(undefined, NOW)).toBe("pending");
  });

  it("is judged on the caller's (server-corrected) clock, so a fast browser clock cannot fake an expiry", () => {
    const entry: GenerationProgressEntry = { status: "processing", lease_expires_at: at(30_000) };
    const browserNow = NOW + 90_000; // browser runs 90s ahead of the server
    const serverOffsetMs = -90_000;
    expect(effectiveGenerationState(entry, browserNow)).toBe("stalled"); // wrong clock → false expiry
    expect(effectiveGenerationState(entry, browserNow + serverOffsetMs)).toBe("running");
  });
});

describe("retryableGenerationTypesFrom", () => {
  it("drops types another invocation is still running, keeps stalled and failed ones", () => {
    const map: GenerationProgressMap = {
      internal_link_suggestion: { status: "processing", lease_expires_at: at(100_000) },
      guide_photo: { status: "processing", lease_expires_at: at(-5_000) },
      portfolio_pick: { status: "failed", attempt: 1 },
      journal_post: { status: "pending" },
      testimonial_feature: { status: "completed" },
    };
    expect(retryableGenerationTypesFrom(ALL, map, NOW))
      .toEqual(["portfolio_pick", "guide_photo", "journal_post"]);
  });
});
