import { describe, it, expect } from "vitest";
import {
  ORIGINALS_BUCKET, MAX_UPLOAD_BYTES, MAX_IMAGE_PIXELS, ALLOWED_UPLOAD_MIME,
  extForMime, issueUploadPath, isOwnedUploadPath,
} from "@/lib/contentEngine/uploadConfig";

const SESSION = "11111111-1111-4111-8111-111111111111";

describe("upload config", () => {
  it("uses the private bucket and sane caps", () => {
    expect(ORIGINALS_BUCKET).toBe("session-content-originals");
    expect(MAX_UPLOAD_BYTES).toBe(25 * 1024 * 1024);
    expect(MAX_IMAGE_PIXELS).toBeGreaterThan(0);
    expect(ALLOWED_UPLOAD_MIME).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });

  it("maps allowed MIME to an extension and rejects others", () => {
    expect(extForMime("image/jpeg")).toBe("jpg");
    expect(extForMime("image/png")).toBe("png");
    expect(extForMime("image/webp")).toBe("webp");
    expect(extForMime("image/gif")).toBeNull();
    expect(extForMime("application/pdf")).toBeNull();
  });
});

describe("path issue + ownership", () => {
  it("issues originals/<session>/<uuid>.<ext>", () => {
    const p = issueUploadPath(SESSION, "image/jpeg");
    expect(p).toMatch(new RegExp(`^originals/${SESSION}/[0-9a-f-]{36}\\.jpg$`));
  });

  it("accepts a path it issued for this session", () => {
    const p = issueUploadPath(SESSION, "image/webp");
    expect(isOwnedUploadPath(p, SESSION)).toBe(true);
  });

  it("rejects a path for a different session, traversal, or wrong prefix", () => {
    const other = "22222222-2222-4222-8222-222222222222";
    expect(isOwnedUploadPath(`originals/${other}/abc.jpg`, SESSION)).toBe(false);
    expect(isOwnedUploadPath(`originals/${SESSION}/../${other}/x.jpg`, SESSION)).toBe(false);
    expect(isOwnedUploadPath(`engine/${SESSION}/x.jpg`, SESSION)).toBe(false);
    expect(isOwnedUploadPath(`originals/${SESSION}/sub/x.jpg`, SESSION)).toBe(false);
    expect(isOwnedUploadPath(`originals/${SESSION}/x.gif`, SESSION)).toBe(false);
  });

  it("rejects issuing a path for a disallowed MIME", () => {
    expect(() => issueUploadPath(SESSION, "image/gif")).toThrow(/mime|unsupported/i);
  });
});
