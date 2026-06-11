import { describe, it, expect } from "vitest";
import { buildIdempotencyKey } from "@/lib/contentEngine/idempotency";

describe("buildIdempotencyKey", () => {
  it("joins session:package:type:destination:photo", () => {
    expect(buildIdempotencyKey({
      sessionId: "S", packageId: "P", contentType: "school_page_photo",
      destination: "sjsu", photoId: "PH",
    })).toBe("S:P:school_page_photo:sjsu:PH");
  });

  it("uses '-' for absent destination/photo and is stable across calls", () => {
    const args = { sessionId: "S", packageId: "P", contentType: "journal_post" } as const;
    expect(buildIdempotencyKey(args)).toBe("S:P:journal_post:-:-");
    expect(buildIdempotencyKey(args)).toBe(buildIdempotencyKey(args));
  });

  it("distinguishes two photos of the same type+destination", () => {
    const base = { sessionId: "S", packageId: "P", contentType: "portfolio_pick", destination: "grads" } as const;
    expect(buildIdempotencyKey({ ...base, photoId: "A" }))
      .not.toBe(buildIdempotencyKey({ ...base, photoId: "B" }));
  });

  it("rejects segment values containing the ':' delimiter", () => {
    expect(() => buildIdempotencyKey({
      sessionId: "S", packageId: "P", contentType: "portfolio_pick", destination: "a:b",
    })).toThrow(/delimiter|colon/i);
  });
});
