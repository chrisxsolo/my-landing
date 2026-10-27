import { describe, expect, it } from "vitest";
import { findDuplicateCandidates } from "@/lib/paymentLedgerMatches";
import type { MatchablePayment } from "@/lib/paymentMatching";

const ledger: MatchablePayment[] = [
  { id: 182, inquiry_id: null, client_name: "Vanshika Sharma", client_email: "", amount_cents: 17500, method: "Venmo", paid_at: "2026-03-31T19:00:00Z", source: "auto" },
  { id: 226, inquiry_id: 123, client_name: "Nancy Nunez", client_email: "nancy@example.com", amount_cents: 42500, method: "Venmo", paid_at: "2026-10-18T17:04:36Z", source: "pass1", source_txn_id: "gmail:bb" },
];

describe("findDuplicateCandidates (manual entry guard)", () => {
  it("flags a manual row that re-enters a payment already in the ledger", () => {
    const dupes = findDuplicateCandidates([
      { inquiry_id: null, client_name: "Vanshika Sharma", client_email: "v@example.com", amount_cents: 17500, method: "Venmo", paid_at: "2026-04-01T02:00:00Z" },
      { inquiry_id: 9, client_name: "Someone Else", client_email: "", amount_cents: 17500, method: "Venmo", paid_at: "2026-04-01T02:00:00Z" },
    ], ledger);
    expect(dupes.map(d => [d.index, d.matches.map(m => m.id)])).toEqual([[0, [182]]]);
  });

  it("lets a new balance payment from a known client through", () => {
    const dupes = findDuplicateCandidates([
      { inquiry_id: 123, client_name: "Nancy Nunez", client_email: "nancy@example.com", amount_cents: 42500, method: "Venmo", paid_at: "2026-11-20T17:00:00Z" },
    ], ledger);
    expect(dupes).toEqual([]);
  });
});
