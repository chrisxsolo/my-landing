import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { readJpegOrientation } from "@/lib/contentEngine/jpegOrientation";

async function jpeg(orientation?: number): Promise<Uint8Array> {
  const image = sharp({ create: { width: 40, height: 20, channels: 3, background: { r: 10, g: 20, b: 30 } } });
  const out = orientation ? image.withMetadata({ orientation }) : image;
  return new Uint8Array(await out.jpeg().toBuffer());
}

describe("readJpegOrientation", () => {
  it("reads the EXIF orientation tag", async () => {
    for (const o of [1, 3, 6, 8]) expect(readJpegOrientation(await jpeg(o))).toBe(o);
  });

  it("treats a JPEG without EXIF as upright", async () => {
    expect(readJpegOrientation(await jpeg())).toBe(1);
  });

  it("returns null for bytes that are not a JPEG", async () => {
    const png = new Uint8Array(await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } }).png().toBuffer());
    expect(readJpegOrientation(png)).toBeNull();
    expect(readJpegOrientation(new Uint8Array([0xff]))).toBeNull();
  });

  it("survives a header cut off mid-EXIF", async () => {
    const full = await jpeg(6);
    expect(() => readJpegOrientation(full.slice(0, 30))).not.toThrow();
  });
});
