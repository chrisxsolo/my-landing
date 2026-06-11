import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { verifyImageBuffer, ImageVerificationError } from "@/lib/contentEngine/imageVerification";

async function jpegFixture(width = 64, height = 48) {
  return sharp({ create: { width, height, channels: 3, background: { r: 120, g: 160, b: 140 } } })
    .jpeg().toBuffer();
}

describe("verifyImageBuffer", () => {
  it("accepts a valid JPEG and returns server-computed hash + dimensions", async () => {
    const buf = await jpegFixture(64, 48);
    const result = await verifyImageBuffer(buf);
    expect(result.format).toBe("jpeg");
    expect(result.width).toBe(64);
    expect(result.height).toBe(48);
    expect(result.bytes).toBe(buf.length);
    expect(result.hash).toBe(createHash("sha256").update(buf).digest("hex"));
  });

  it("rejects non-image bytes", async () => {
    await expect(verifyImageBuffer(Buffer.from("this is not an image")))
      .rejects.toBeInstanceOf(ImageVerificationError);
  });

  it("rejects a disallowed format (gif)", async () => {
    const gif = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 1, b: 1 } } })
      .gif().toBuffer();
    await expect(verifyImageBuffer(gif)).rejects.toThrow(/format|unsupported/i);
  });

  it("rejects bytes over the size cap", async () => {
    const buf = await jpegFixture(64, 48);
    await expect(verifyImageBuffer(buf, { maxBytes: buf.length - 1 })).rejects.toThrow(/size|bytes/i);
  });

  it("rejects an image over the pixel cap (decompression-bomb guard)", async () => {
    const buf = await jpegFixture(2000, 2000); // 4,000,000 px
    await expect(verifyImageBuffer(buf, { maxPixels: 1_000_000 })).rejects.toThrow(/pixel|dimension|bomb|limit/i);
  });
});
