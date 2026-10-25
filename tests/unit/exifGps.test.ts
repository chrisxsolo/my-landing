import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { readJpegGps, sanitizeGps } from "@/lib/contentEngine/exifGps";

async function jpegWithGps(lat: string, latRef: string, lon: string, lonRef: string) {
  return sharp({ create: { width: 16, height: 16, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .jpeg()
    .withExif({ IFD3: { GPSLatitudeRef: latRef, GPSLatitude: lat, GPSLongitudeRef: lonRef, GPSLongitude: lon } })
    .toBuffer();
}

describe("readJpegGps", () => {
  it("reads degrees/minutes/seconds with hemisphere refs (Shark Fin Cove)", async () => {
    const buf = await jpegWithGps("37/1 0/1 1296/100", "N", "122/1 11/1 816/100", "W");
    const gps = readJpegGps(new Uint8Array(buf));
    expect(gps).not.toBeNull();
    expect(gps!.latitude).toBeCloseTo(37.0036, 4);
    expect(gps!.longitude).toBeCloseTo(-122.1856, 4);
  });

  it("returns null for a JPEG without GPS and for non-JPEG bytes", async () => {
    const plain = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#000" } }).jpeg().toBuffer();
    expect(readJpegGps(new Uint8Array(plain))).toBeNull();
    expect(readJpegGps(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

describe("sanitizeGps", () => {
  it("accepts real coordinates and rejects junk", () => {
    expect(sanitizeGps({ latitude: 37.1234567, longitude: -122.5 })).toEqual({ latitude: 37.123457, longitude: -122.5 });
    expect(sanitizeGps({ latitude: 0, longitude: 0 })).toBeNull();
    expect(sanitizeGps({ latitude: 91, longitude: 0 })).toBeNull();
    expect(sanitizeGps({ latitude: "37", longitude: -122 })).toBeNull();
    expect(sanitizeGps(null)).toBeNull();
  });
});
