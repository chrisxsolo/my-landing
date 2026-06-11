import { describe, it, expect } from "vitest";
import {
  MAX_PHOTOS_PER_BATCH, MAX_BATCH_IMAGE_BYTES, ANALYSIS_ENCODE_LADDER,
  chunkForAnalysis, ladderStep, totalBytes,
} from "@/lib/contentEngine/analysisBatching";

describe("adaptive batching (spec §8.1 step 2)", () => {
  it("caps batches at 4 photos", () => {
    expect(MAX_PHOTOS_PER_BATCH).toBe(4);
    expect(chunkForAnalysis(["a", "b", "c", "d", "e", "f"])).toEqual([["a", "b", "c", "d"], ["e", "f"]]);
    expect(chunkForAnalysis([])).toEqual([]);
    expect(chunkForAnalysis(["a"])).toEqual([["a"]]);
  });

  it("ladder steps shrink monotonically and clamp at the last step", () => {
    expect(MAX_BATCH_IMAGE_BYTES).toBe(4 * 1024 * 1024);
    for (let i = 1; i < ANALYSIS_ENCODE_LADDER.length; i++) {
      expect(ANALYSIS_ENCODE_LADDER[i].maxDimension).toBeLessThan(ANALYSIS_ENCODE_LADDER[i - 1].maxDimension);
      expect(ANALYSIS_ENCODE_LADDER[i].quality).toBeLessThan(ANALYSIS_ENCODE_LADDER[i - 1].quality);
    }
    expect(ladderStep(0)).toEqual(ANALYSIS_ENCODE_LADDER[0]);
    expect(ladderStep(99)).toEqual(ANALYSIS_ENCODE_LADDER[ANALYSIS_ENCODE_LADDER.length - 1]);
    expect(ladderStep(-1)).toEqual(ANALYSIS_ENCODE_LADDER[0]);
  });

  it("totalBytes sums buffer lengths", () => {
    expect(totalBytes([Buffer.alloc(10), Buffer.alloc(5)])).toBe(15);
    expect(totalBytes([])).toBe(0);
  });
});
