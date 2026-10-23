import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EnginePackage, EnginePhoto } from "@/app/admin/content-engine/engineTypes";

// The pipeline module is pure orchestration over the engine routes, so the API
// client is faked here: these tests pin the ordering, resume and abort rules.
const analyzeBatch = vi.fn();
const curatePhotos = vi.fn();
const createPackage = vi.fn();
const generateType = vi.fn();

vi.mock("@/app/admin/content-engine/engineApi", () => ({
  engineApi: {
    analyzeBatch: (...a: unknown[]) => analyzeBatch(...a),
    curatePhotos: (...a: unknown[]) => curatePhotos(...a),
    createPackage: (...a: unknown[]) => createPackage(...a),
    generateType: (...a: unknown[]) => generateType(...a),
  },
}));

const {
  analyzeAllPhotos, generateAllTypes, pendingGenerationTypes,
  pendingAnalysisCount, includedCount,
} = await import("@/app/admin/content-engine/pipeline");

const SESSION = "11111111-1111-1111-1111-111111111111";

function photo(over: Partial<EnginePhoto> = {}): EnginePhoto {
  return {
    id: crypto.randomUUID(), storage_path: "p", original_filename: null,
    width: 1, height: 1, sort_order: 0, excluded: false,
    analysis_status: "pending", analysis_error: null, analysis_lease_expires_at: null,
    analysis_attempt: 0, alt_text: null, title: null, description: null, tags: [],
    quality_score: null, suggested_category: null, destination_recommendations: null,
    public_derivative_url: null, thumbnailUrl: null, created_at: "2026-10-23",
    ...over,
  };
}

function pkg(progress: Record<string, string>, over: Partial<EnginePackage> = {}): EnginePackage {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    generation_number: 1, status: "generating",
    model_name: "claude-sonnet-4-6", prompt_version: "v1",
    generation_settings: {
      selected_types: Object.keys(progress),
      progress: Object.fromEntries(Object.entries(progress).map(([type, status]) => [
        type, { status: status as "pending", attempt: 1, error: null, usage: null },
      ])),
    },
    created_at: "2026-10-23",
    ...over,
  };
}

/** A fake analyze route backed by a photo queue, honouring 4-per-batch claims. */
function fakeAnalysisQueue(total: number, opts: { failAt?: number } = {}) {
  let unclaimed = total;
  let processed = 0;
  let inFlight = 0;
  let peak = 0;
  return {
    get peak() { return peak; },
    get processed() { return processed; },
    handler: async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      const claimed = Math.min(4, unclaimed);
      unclaimed -= claimed;
      await new Promise((r) => setTimeout(r, 2));
      inFlight -= 1;
      if (claimed === 0) return { claimed: 0, completed: 0, failed: 0, remaining: unclaimed };
      const shouldFail = opts.failAt !== undefined && processed >= opts.failAt;
      if (shouldFail) {
        unclaimed += claimed; // failed photos become claimable again
        return { claimed, completed: 0, failed: claimed, remaining: unclaimed };
      }
      processed += claimed;
      return { claimed, completed: claimed, failed: 0, remaining: unclaimed };
    },
  };
}

beforeEach(() => {
  analyzeBatch.mockReset();
  curatePhotos.mockReset();
  createPackage.mockReset();
  generateType.mockReset();
});

describe("pendingGenerationTypes", () => {
  it("returns nothing without an active package", () => {
    expect(pendingGenerationTypes(null)).toEqual([]);
  });

  it("keeps only non-terminal selected types, in generation order", () => {
    const types = pendingGenerationTypes(pkg({
      journal_post: "pending",
      portfolio_pick: "completed",
      school_page_photo: "skipped",
      guide_photo: "failed",
      internal_link_suggestion: "pending",
    }));
    expect(types).toEqual(["internal_link_suggestion", "guide_photo", "journal_post"]);
  });
});

describe("photo counters", () => {
  it("counts pending and failed photos as awaiting analysis, ignoring excluded", () => {
    const photos = [
      photo({ analysis_status: "pending" }),
      photo({ analysis_status: "failed" }),
      photo({ analysis_status: "completed" }),
      photo({ analysis_status: "pending", excluded: true }),
    ];
    expect(pendingAnalysisCount(photos)).toBe(2);
    expect(includedCount(photos)).toBe(3);
  });
});

describe("analyzeAllPhotos", () => {
  it("drains the queue with several batches in flight", async () => {
    const queue = fakeAnalysisQueue(20);
    analyzeBatch.mockImplementation(queue.handler);
    const result = await analyzeAllPhotos(SESSION, 20);
    expect(result).toEqual({ completed: 20, failed: 0 });
    expect(queue.peak).toBeGreaterThan(1);
    expect(queue.peak).toBeLessThanOrEqual(3);
  });

  it("uses one lane when a single batch covers the work", async () => {
    const queue = fakeAnalysisQueue(3);
    analyzeBatch.mockImplementation(queue.handler);
    await analyzeAllPhotos(SESSION, 3);
    expect(queue.peak).toBe(1);
  });

  it("stops the run on the first failed batch", async () => {
    const queue = fakeAnalysisQueue(20, { failAt: 8 });
    analyzeBatch.mockImplementation(queue.handler);
    const result = await analyzeAllPhotos(SESSION, 20);
    expect(result.failed).toBeGreaterThan(0);
    expect(result.completed).toBeLessThan(20);
    const callsAtStop = analyzeBatch.mock.calls.length;
    await new Promise((r) => setTimeout(r, 20));
    expect(analyzeBatch.mock.calls.length).toBe(callsAtStop);
  });

  it("reports progress as batches commit", async () => {
    analyzeBatch.mockImplementation(fakeAnalysisQueue(8).handler);
    const details: string[] = [];
    await analyzeAllPhotos(SESSION, 8, {
      concurrency: 1, onProgress: (p) => details.push(p.detail),
    });
    expect(details).toEqual([
      "Analyzing photos — 4 of 8 done",
      "Analyzing photos — 8 of 8 done",
    ]);
  });
});

describe("generateAllTypes", () => {
  it("runs independent types together and the journal post last", async () => {
    const started: string[] = [];
    let independentDone = false;
    generateType.mockImplementation(async (_id: string, type: string) => {
      started.push(type);
      if (type === "journal_post") {
        // the journal post consumes the link + testimonial drafts
        expect(independentDone).toBe(true);
      }
      await new Promise((r) => setTimeout(r, 2));
      if (type === "portfolio_pick") independentDone = true;
      return { outcome: "completed", itemIds: [], packageStatus: "ready" };
    });

    const errors = await generateAllTypes("pkg", [
      "internal_link_suggestion", "portfolio_pick", "journal_post",
    ]);
    expect(errors).toEqual([]);
    expect(started.slice(0, 2).sort()).toEqual(["internal_link_suggestion", "portfolio_pick"]);
    expect(started[2]).toBe("journal_post");
  });

  it("collects a readable error per failed type and keeps going", async () => {
    generateType.mockImplementation(async (_id: string, type: string) => {
      if (type === "portfolio_pick") return { outcome: "failed", itemIds: [], packageStatus: "needs_attention", error: "model said no" };
      if (type === "guide_photo") throw new Error("network down");
      return { outcome: "completed", itemIds: [], packageStatus: "ready" };
    });
    const errors = await generateAllTypes("pkg", [
      "internal_link_suggestion", "portfolio_pick", "guide_photo",
    ]);
    expect(errors).toEqual([
      "Portfolio pick: model said no",
      "Guide photo: network down",
    ]);
  });
});
