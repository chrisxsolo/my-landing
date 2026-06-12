import { describe, it, expect } from "vitest";
import {
  MAX_ADMIN_PHOTO_BYTES,
  validateAdminPhotoFile,
  validatePhotoAltText,
  safePhotoFileName,
} from "@/lib/photoAdminShared";

describe("validateAdminPhotoFile", () => {
  it("rejects a missing file", () => {
    expect(validateAdminPhotoFile(null).ok).toBe(false);
  });
  it("rejects unsupported types", () => {
    expect(validateAdminPhotoFile({ type: "image/gif", size: 100 }).ok).toBe(false);
  });
  it("rejects oversized files", () => {
    expect(validateAdminPhotoFile({ type: "image/jpeg", size: MAX_ADMIN_PHOTO_BYTES + 1 }).ok).toBe(false);
  });
  it("accepts a normal jpeg", () => {
    expect(validateAdminPhotoFile({ type: "image/jpeg", size: 1024 }).ok).toBe(true);
  });
});

describe("validatePhotoAltText", () => {
  it("requires non-empty text", () => {
    expect(validatePhotoAltText("").ok).toBe(false);
    expect(validatePhotoAltText("   ").ok).toBe(false);
    expect(validatePhotoAltText(undefined).ok).toBe(false);
  });
  it("rejects text over 300 chars", () => {
    expect(validatePhotoAltText("x".repeat(301)).ok).toBe(false);
  });
  it("accepts reasonable alt text", () => {
    expect(validatePhotoAltText("Chris hiking Mount Tam at sunrise").ok).toBe(true);
  });
});

describe("safePhotoFileName", () => {
  it("normalizes unsafe characters", () => {
    const out = safePhotoFileName("My Photo (1).JPG");
    expect(out).toMatch(/^[\w.-]+$/);
    expect(out).toBe(out.toLowerCase());
  });
  it("falls back when nothing survives", () => {
    expect(safePhotoFileName("***", "about-photo")).toBe("about-photo");
  });
});
