import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

const { scaleToFit, isTransientUploadError, ALLOWED_MIME, UPLOAD_MAX_EDGE, UPLOAD_REENCODE_BYTES } =
  await import("@/app/admin/content-engine/[id]/photoUpload");
const { EngineApiError } = await import("@/app/admin/content-engine/engineApi");
const uploadConfig = await import("@/lib/contentEngine/uploadConfig");

describe("photoUpload constants mirror the server's upload rules", () => {
  it("resizes to exactly what the server would keep", () => {
    expect(UPLOAD_MAX_EDGE).toBe(uploadConfig.NORMALIZE_MAX_DIMENSION);
    expect(UPLOAD_REENCODE_BYTES).toBe(uploadConfig.NORMALIZE_TRIGGER_BYTES);
    expect([...ALLOWED_MIME]).toEqual([...uploadConfig.ALLOWED_UPLOAD_MIME]);
  });
});

describe("scaleToFit", () => {
  it("shrinks a 61MP frame to the stored long edge, keeping aspect", () => {
    expect(scaleToFit(9504, 6336, 5000)).toEqual({ width: 5000, height: 3333 });
    expect(scaleToFit(6336, 9504, 5000)).toEqual({ width: 3333, height: 5000 });
  });

  it("leaves an image already within the edge alone", () => {
    expect(scaleToFit(5000, 3333, 5000)).toBeNull();
    expect(scaleToFit(4000, 3000, 5000)).toBeNull();
  });
});

describe("isTransientUploadError", () => {
  it("retries server trouble and network failures", () => {
    expect(isTransientUploadError(new EngineApiError(503, {}))).toBe(true);
    expect(isTransientUploadError(new EngineApiError(429, {}))).toBe(true);
    expect(isTransientUploadError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isTransientUploadError({ status: 502, message: "bad gateway" })).toBe(true);
  });

  it("does not retry a verdict about the file", () => {
    expect(isTransientUploadError(new EngineApiError(422, {}))).toBe(false);
    expect(isTransientUploadError(new EngineApiError(409, {}))).toBe(false);
    expect(isTransientUploadError({ status: 400, message: "invalid" })).toBe(false);
  });
});
