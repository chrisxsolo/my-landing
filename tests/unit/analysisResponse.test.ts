import { describe, it, expect } from "vitest";
import {
  validateSinglePhotoResponse, extractJsonObject, AnalysisValidationError,
} from "@/lib/contentEngine/analysisResponse";

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";

function photo(id: string, extra: Record<string, unknown> = {}) {
  return {
    session_photo_id: id, alt_text: "Grad at Tower Lawn", title: "Tower Lawn",
    description: "Golden hour portrait", tags: ["sjsu"], quality_score: 8,
    suggested_category: "grads", destination_recommendations: { portfolio: true },
    ...extra,
  };
}

describe("extractJsonObject", () => {
  it("parses a bare JSON object and one wrapped in prose/fences", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
    expect(extractJsonObject('Here you go:\n```json\n{"a":1}\n```\nthanks')).toEqual({ a: 1 });
  });
  it("throws on text with no JSON object", () => {
    expect(() => extractJsonObject("no json here")).toThrow(AnalysisValidationError);
  });
});

describe("validateSinglePhotoResponse (one photo per call)", () => {
  it("accepts a well-formed single analysis", () => {
    const out = validateSinglePhotoResponse(JSON.stringify({ photos: [photo(ID1)] }), ID1);
    expect(out.session_photo_id).toBe(ID1);
    expect(out.quality_score).toBe(8);
  });

  it("binds the result to the photo that was sent, even when the model mistypes its id", () => {
    // Real 2026-10-23 benchmark failure: one character of the uuid echoed wrong.
    const typo = JSON.stringify({ photos: [photo("11111111-1111-4111-8111-111111111112")] });
    expect(validateSinglePhotoResponse(typo, ID1).session_photo_id).toBe(ID1);
    const missingId = JSON.stringify({ photos: [{ ...photo(ID1), session_photo_id: undefined }] });
    expect(validateSinglePhotoResponse(missingId, ID1).session_photo_id).toBe(ID1);
  });

  it("rejects anything but exactly one photo", () => {
    expect(() => validateSinglePhotoResponse(JSON.stringify({ photos: [] }), ID1)).toThrow(/exactly one/i);
    expect(() => validateSinglePhotoResponse(JSON.stringify({ photos: [photo(ID1), photo(ID2)] }), ID1))
      .toThrow(/exactly one/i);
    expect(() => validateSinglePhotoResponse(JSON.stringify({ result: "ok" }), ID1)).toThrow(/exactly one/i);
  });

  it("rejects hostile field values (bad category, out-of-range score, wrong types)", () => {
    const badCat = JSON.stringify({ photos: [photo(ID1, { suggested_category: "weddings" })] });
    expect(() => validateSinglePhotoResponse(badCat, ID1)).toThrow();
    const badScore = JSON.stringify({ photos: [photo(ID1, { quality_score: 11 })] });
    expect(() => validateSinglePhotoResponse(badScore, ID1)).toThrow();
    const badTags = JSON.stringify({ photos: [photo(ID1, { tags: "not-an-array" })] });
    expect(() => validateSinglePhotoResponse(badTags, ID1)).toThrow();
  });

  it("clamps over-long text fields instead of rejecting (real prod failure: 1000+ char description)", () => {
    const text = JSON.stringify({
      photos: [photo(ID1, {
        description: "word ".repeat(300),
        alt_text: "a".repeat(400),
        title: "t".repeat(200),
        tags: Array.from({ length: 20 }, (_, i) => `tag-${i}-${"x".repeat(70)}`),
      })],
    });
    const out = validateSinglePhotoResponse(text, ID1);
    expect(out.description!.length).toBeLessThanOrEqual(1000);
    expect(out.description!.endsWith("word")).toBe(true);
    expect(out.alt_text.length).toBe(300);
    expect(out.title!.length).toBeLessThanOrEqual(160);
    expect(out.tags).toHaveLength(15);
    for (const t of out.tags) expect(t.length).toBeLessThanOrEqual(60);
  });

  it("still rejects an empty alt_text", () => {
    const text = JSON.stringify({ photos: [photo(ID1, { alt_text: "" })] });
    expect(() => validateSinglePhotoResponse(text, ID1)).toThrow();
  });

  it("tolerates null optional fields", () => {
    const text = JSON.stringify({
      photos: [photo(ID1, { suggested_category: null, destination_recommendations: null })],
    });
    const out = validateSinglePhotoResponse(text, ID1);
    expect(out.suggested_category).toBeNull();
  });
});
