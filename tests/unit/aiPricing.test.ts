import { describe, it, expect } from "vitest";
import { AI_RATE_MAP, estimateCostUsd } from "@/lib/contentEngine/aiPricing";

describe("aiPricing (spec §11)", () => {
  it("has rates for the engine default model", () => {
    expect(AI_RATE_MAP["claude-sonnet-4-6"].inputPerMTokUsd).toBeGreaterThan(0);
    expect(AI_RATE_MAP["claude-sonnet-4-6"].outputPerMTokUsd).toBeGreaterThan(0);
  });

  it("computes a cost estimate from recorded usage only", () => {
    const { totalUsd, unknownModels } = estimateCostUsd([
      { model: "claude-sonnet-4-6", input_tokens: 1_000_000, output_tokens: 0 },
      { model: "claude-sonnet-4-6", input_tokens: 0, output_tokens: 1_000_000 },
    ]);
    const rate = AI_RATE_MAP["claude-sonnet-4-6"];
    expect(totalUsd).toBeCloseTo(rate.inputPerMTokUsd + rate.outputPerMTokUsd, 6);
    expect(unknownModels).toEqual([]);
  });

  it("reports unknown models instead of guessing", () => {
    const { totalUsd, unknownModels } = estimateCostUsd([
      { model: "future-model-x", input_tokens: 1000, output_tokens: 1000 },
    ]);
    expect(totalUsd).toBe(0);
    expect(unknownModels).toEqual(["future-model-x"]);
  });

  it("handles empty usage", () => {
    expect(estimateCostUsd([])).toEqual({ totalUsd: 0, unknownModels: [] });
  });
});
