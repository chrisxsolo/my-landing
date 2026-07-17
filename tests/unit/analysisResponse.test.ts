import { describe, it, expect } from "vitest";
import {
  validateAnalysisResponse, extractJsonObject, AnalysisValidationError,
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

describe("validateAnalysisResponse (identity validation, spec §8.1 step 4)", () => {
  it("accepts a complete keyed response", () => {
    const text = JSON.stringify({ photos: [photo(ID1), photo(ID2)] });
    const out = validateAnalysisResponse(text, [ID1, ID2]);
    expect(out).toHaveLength(2);
    expect(out[0].session_photo_id).toBe(ID1);
    expect(out[0].quality_score).toBe(8);
  });

  it("rejects a missing id, an unknown id, and a duplicate id", () => {
    const missing = JSON.stringify({ photos: [photo(ID1)] });
    expect(() => validateAnalysisResponse(missing, [ID1, ID2])).toThrow(/missing/i);

    const unknown = JSON.stringify({ photos: [photo(ID1), photo("33333333-3333-4333-8333-333333333333")] });
    expect(() => validateAnalysisResponse(unknown, [ID1, ID2])).toThrow(/unknown/i);

    const dup = JSON.stringify({ photos: [photo(ID1), photo(ID1)] });
    expect(() => validateAnalysisResponse(dup, [ID1, ID1])).toThrow(/duplicate/i);
  });

  it("rejects hostile field values (bad category, out-of-range score, wrong types)", () => {
    const badCat = JSON.stringify({ photos: [photo(ID1, { suggested_category: "weddings" })] });
    expect(() => validateAnalysisResponse(badCat, [ID1])).toThrow();
    const badScore = JSON.stringify({ photos: [photo(ID1, { quality_score: 11 })] });
    expect(() => validateAnalysisResponse(badScore, [ID1])).toThrow();
    const badTags = JSON.stringify({ photos: [photo(ID1, { tags: "not-an-array" })] });
    expect(() => validateAnalysisResponse(badTags, [ID1])).toThrow();
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
    const out = validateAnalysisResponse(text, [ID1]);
    expect(out[0].description!.length).toBeLessThanOrEqual(1000);
    expect(out[0].description!.endsWith("word")).toBe(true);
    expect(out[0].alt_text.length).toBe(300);
    expect(out[0].title!.length).toBeLessThanOrEqual(160);
    expect(out[0].tags).toHaveLength(15);
    for (const t of out[0].tags) expect(t.length).toBeLessThanOrEqual(60);
  });

  it("still rejects an empty alt_text", () => {
    const text = JSON.stringify({ photos: [photo(ID1, { alt_text: "" })] });
    expect(() => validateAnalysisResponse(text, [ID1])).toThrow();
  });

  it("tolerates null optional fields", () => {
    const text = JSON.stringify({
      photos: [photo(ID1, { suggested_category: null, destination_recommendations: null })],
    });
    const out = validateAnalysisResponse(text, [ID1]);
    expect(out[0].suggested_category).toBeNull();
  });
});
