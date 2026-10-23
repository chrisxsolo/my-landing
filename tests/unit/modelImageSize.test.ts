import { describe, it, expect } from "vitest";
import {
  MODEL_IMAGE_MAX_EDGE, MODEL_IMAGE_MAX_PIXELS, modelImageLongEdge,
} from "@/lib/contentEngine/modelImageSize";

describe("modelImageLongEdge — size photos to what the vision model reads", () => {
  it("fits a 2:3 camera frame under the pixel budget, not just the edge cap", () => {
    const edge = modelImageLongEdge(6000, 4000);
    const short = Math.floor((edge * 4000) / 6000);
    expect(edge).toBeLessThanOrEqual(MODEL_IMAGE_MAX_EDGE);
    expect(edge * short).toBeLessThanOrEqual(MODEL_IMAGE_MAX_PIXELS);
    expect(edge).toBeGreaterThan(1300); // ~1313 for 3:2 — not needlessly small
  });

  it("is orientation-agnostic", () => {
    expect(modelImageLongEdge(4000, 6000)).toBe(modelImageLongEdge(6000, 4000));
  });

  it("caps a very wide panorama by the edge limit", () => {
    expect(modelImageLongEdge(12000, 2000)).toBe(MODEL_IMAGE_MAX_EDGE);
  });

  it("never upscales a small image", () => {
    expect(modelImageLongEdge(800, 600)).toBe(800);
  });

  it("falls back to the edge cap when dimensions are unknown", () => {
    expect(modelImageLongEdge(0, 0)).toBe(MODEL_IMAGE_MAX_EDGE);
  });
});
