import { describe, expect, it } from "vitest";
import { describePaymentCheck } from "@/lib/checkPaymentClient";

describe("describePaymentCheck", () => {
  it("says the payment was recorded and the booking updated", () => {
    const result = describePaymentCheck({ paid: true, note: "$200 already detected for this client", ledger: "recorded" });
    expect(result).toMatchObject({ ok: true, paid: true });
    expect(result.toasts.map(t => t.text)).toEqual([
      "Payment confirmed — $200 already detected for this client",
      "Recorded in revenue and the booking was updated",
    ]);
  });

  it("explains a detection held back as a possible duplicate, as a warning", () => {
    const result = describePaymentCheck({ paid: true, note: "Venmo receipt", ledger: "staged" });
    expect(result.toasts[1]).toMatchObject({ ok: false });
    expect(result.toasts[1].text).toContain("Not added to revenue automatically");
  });

  it("reports no evidence as unpaid without an error", () => {
    expect(describePaymentCheck({ paid: false, note: "" })).toEqual({
      ok: true, paid: false, toasts: [{ text: "No payment evidence found", ok: false }],
    });
  });

  it("passes server warnings through", () => {
    const result = describePaymentCheck({ paid: true, note: "x", ledger: "no_amount", warning: "No amount found." });
    expect(result.toasts.at(-1)).toEqual({ text: "No amount found.", ok: false });
  });
});
