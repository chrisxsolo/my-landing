import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { needsNormalization, normalizeOriginal } from "@/lib/contentEngine/normalizeOriginal";
import {
  NORMALIZE_TRIGGER_PIXELS, NORMALIZE_TRIGGER_BYTES, NORMALIZE_MAX_DIMENSION,
} from "@/lib/contentEngine/uploadConfig";

describe("needsNormalization", () => {
  it("triggers on pixel count above the threshold", () => {
    expect(needsNormalization({ width: 9504, height: 6336, bytes: 1_000 })).toBe(true); // 61MP body
    expect(needsNormalization({ width: 6000, height: 4000, bytes: 1_000 })).toBe(false); // 24MP body
  });

  it("triggers on byte size above the threshold even at small dimensions", () => {
    expect(needsNormalization({ width: 100, height: 100, bytes: NORMALIZE_TRIGGER_BYTES + 1 })).toBe(true);
    expect(needsNormalization({ width: 100, height: 100, bytes: NORMALIZE_TRIGGER_BYTES })).toBe(false);
  });

  it("is exact at the pixel boundary", () => {
    const side = Math.floor(Math.sqrt(NORMALIZE_TRIGGER_PIXELS));
    expect(needsNormalization({ width: side, height: side, bytes: 1 })).toBe(false);
    expect(needsNormalization({ width: side + 1, height: side + 1, bytes: 1 })).toBe(true);
  });
});

describe("normalizeOriginal", () => {
  it("downscales to the long-edge cap, keeps aspect ratio and format", async () => {
    const src = await sharp({
      create: { width: 7000, height: 5000, channels: 3, background: { r: 90, g: 120, b: 140 } },
    }).jpeg().toBuffer();

    const out = await normalizeOriginal(src, "jpeg");
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(NORMALIZE_MAX_DIMENSION);
    expect(meta.height).toBe(Math.round(NORMALIZE_MAX_DIMENSION * (5000 / 7000)));
  });

  it("never enlarges an already-small image", async () => {
    const src = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 10, g: 20, b: 30 } },
    }).png().toBuffer();

    const out = await normalizeOriginal(src, "png");
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(300);
  });

  it("is deterministic, so duplicate detection still works on normalized bytes", async () => {
    const src = await sharp({
      create: { width: 6000, height: 6500, channels: 3, background: { r: 200, g: 100, b: 50 } },
    }).jpeg().toBuffer();

    const a = await normalizeOriginal(src, "jpeg");
    const b = await normalizeOriginal(src, "jpeg");
    expect(a.equals(b)).toBe(true);
  });

  it("rejects an unknown format", async () => {
    await expect(normalizeOriginal(Buffer.from("x"), "gif")).rejects.toThrow(/unsupported format/);
  });
});
