import { describe, it, expect } from "vitest";
import {
  FALLBACK_NOTE_PAID,
  FALLBACK_NOTE_UNPAID,
  findDeterministicPaymentEvidence,
  parsePaymentDetectionResult,
  sanitizeModelPreview,
} from "@/lib/paymentDetection";

const CLEAN = `{"paid": true, "amount": "$200", "method": "Venmo", "note": "Venmo notification found"}`;

describe("parsePaymentDetectionResult", () => {
  it("parses clean JSON", () => {
    expect(parsePaymentDetectionResult(CLEAN)).toEqual({
      paid: true, amount: "$200", method: "Venmo", note: "Venmo notification found",
    });
  });

  it("parses JSON wrapped in ```json fences", () => {
    const result = parsePaymentDetectionResult("```json\n" + CLEAN + "\n```");
    expect(result?.paid).toBe(true);
    expect(result?.amount).toBe("$200");
  });

  it("parses JSON wrapped in generic ``` fences", () => {
    const result = parsePaymentDetectionResult("```\n" + CLEAN + "\n```");
    expect(result?.paid).toBe(true);
  });

  it("parses JSON preceded by introductory prose", () => {
    const result = parsePaymentDetectionResult(
      "Sure! Here is my analysis of the emails:\n\n" + CLEAN
    );
    expect(result?.paid).toBe(true);
    expect(result?.method).toBe("Venmo");
  });

  it("parses JSON followed by trailing prose", () => {
    const result = parsePaymentDetectionResult(
      CLEAN + "\n\nLet me know if you need anything else!"
    );
    expect(result?.paid).toBe(true);
  });

  it("parses JSON surrounded by whitespace", () => {
    expect(parsePaymentDetectionResult("\n\n   " + CLEAN + "   \n")?.paid).toBe(true);
  });

  it("keeps a real boolean false as false", () => {
    const result = parsePaymentDetectionResult(
      `{"paid": false, "amount": null, "method": null, "note": "Nothing found"}`
    );
    expect(result).toEqual({ paid: false, amount: null, method: null, note: "Nothing found" });
  });

  it('never treats the string "false" as true', () => {
    const result = parsePaymentDetectionResult(
      `{"paid": "false", "amount": null, "method": null, "note": "Nothing found"}`
    );
    expect(result?.paid).toBe(false);
  });

  it('normalizes the string "true" to boolean true', () => {
    expect(parsePaymentDetectionResult(`{"paid": "true", "note": "Found it"}`)?.paid).toBe(true);
  });

  it("rejects arbitrary truthy strings for paid", () => {
    expect(parsePaymentDetectionResult(`{"paid": "yes", "note": "hm"}`)).toBeNull();
    expect(parsePaymentDetectionResult(`{"paid": 1, "note": "hm"}`)).toBeNull();
  });

  it("defaults a missing amount to null", () => {
    const result = parsePaymentDetectionResult(`{"paid": true, "method": "Zelle", "note": "Sent"}`);
    expect(result?.amount).toBeNull();
  });

  it("defaults a missing method to null", () => {
    const result = parsePaymentDetectionResult(`{"paid": true, "amount": "$150", "note": "Sent"}`);
    expect(result?.method).toBeNull();
  });

  it("supplies fallback notes when note is missing or empty", () => {
    expect(parsePaymentDetectionResult(`{"paid": true}`)?.note).toBe(FALLBACK_NOTE_PAID);
    expect(parsePaymentDetectionResult(`{"paid": false, "note": "  "}`)?.note).toBe(FALLBACK_NOTE_UNPAID);
  });

  it("returns null for malformed JSON", () => {
    expect(parsePaymentDetectionResult(`{"paid": true, "amount": `)).toBeNull();
  });

  it("returns null when there is no JSON object at all", () => {
    expect(parsePaymentDetectionResult("I could not determine the payment status.")).toBeNull();
    expect(parsePaymentDetectionResult("")).toBeNull();
    expect(parsePaymentDetectionResult("   \n  ")).toBeNull();
  });

  it("skips unrelated braces before the real result", () => {
    const result = parsePaymentDetectionResult(
      `The data {looks weird} and {"unrelated": 1} but here: ${CLEAN}`
    );
    expect(result?.paid).toBe(true);
    expect(result?.amount).toBe("$200");
  });

  it("handles braces inside JSON string values", () => {
    const result = parsePaymentDetectionResult(
      `{"paid": true, "amount": "$50", "method": "Venmo", "note": "Client wrote {sent it} yesterday"}`
    );
    expect(result?.note).toBe("Client wrote {sent it} yesterday");
  });

  it("stringifies a numeric amount", () => {
    expect(parsePaymentDetectionResult(`{"paid": true, "amount": 200, "note": "ok"}`)?.amount).toBe("200");
  });
});

describe("sanitizeModelPreview", () => {
  it("collapses whitespace and caps length", () => {
    const raw = "line one\n\n  line   two " + "x".repeat(500);
    const preview = sanitizeModelPreview(raw);
    expect(preview.length).toBeLessThanOrEqual(200);
    expect(preview.startsWith("line one line two")).toBe(true);
  });
});

describe("findDeterministicPaymentEvidence", () => {
  it("matches high-confidence client phrases", () => {
    expect(findDeterministicPaymentEvidence("Hi Chris, I just sent you the deposit!")).not.toHaveLength(0);
    expect(findDeterministicPaymentEvidence("I just paid via Zelle")).not.toHaveLength(0);
    expect(findDeterministicPaymentEvidence("Payment sent this morning")).not.toHaveLength(0);
    expect(findDeterministicPaymentEvidence("Deposit sent!")).not.toHaveLength(0);
  });

  it("matches provider confirmation language", () => {
    expect(findDeterministicPaymentEvidence("Jane Doe sent you $200.00")).not.toHaveLength(0);
    expect(findDeterministicPaymentEvidence("You received $175 from Jane")).not.toHaveLength(0);
    expect(findDeterministicPaymentEvidence("Venmo: Jane Doe paid you")).not.toHaveLength(0);
  });

  it("does not match a generic mention of payment", () => {
    expect(findDeterministicPaymentEvidence("What payment methods do you accept?")).toHaveLength(0);
    expect(findDeterministicPaymentEvidence("The deposit is due at booking.")).toHaveLength(0);
    expect(findDeterministicPaymentEvidence("")).toHaveLength(0);
  });
});
