import { describe, expect, it } from "vitest";
import type { AdminInquiry } from "@/lib/adminInquiries";
import type { LedgerRow } from "@/lib/revenue/enrich";
import { findQualityIssues } from "@/lib/revenue/quality";
import { findPaidInquiriesWithoutLedger, namesAgree, suggestInquiryLinks } from "@/lib/revenue/linking";

function row(overrides: Partial<LedgerRow>): LedgerRow {
  return {
    id: 1,
    inquiry_id: null,
    client_name: "Jane Doe",
    client_email: "jane@example.com",
    amount: "$100",
    amount_cents: 10000,
    method: "Venmo",
    payment_type: "deposit_1",
    invoice: "",
    note: "",
    source: "manual",
    status: "active",
    paid_at: "2026-05-01T12:00:00.000Z",
    session_date: null,
    fee_cents: 0,
    refund_cents: 0,
    imported_at: "2026-05-02T00:00:00.000Z",
    reconciliation_status: "confirmed",
    source_txn_id: "",
    inquiry_session_type: null,
    serviceKey: "unlinked",
    schoolKey: "unlinked",
    inquiry: null,
    ...overrides,
  };
}

function inquiry(overrides: Partial<AdminInquiry>): AdminInquiry {
  return {
    id: 1, name: "Jane Doe", email: "jane@example.com", phone: null,
    session_type: "Graduation Portrait", date_in_mind: null, message: "",
    status: "responded", created_at: "2026-04-01T00:00:00.000Z",
    payment_status: "paid", payment_note: null, payment_detected_at: null,
    booking_confirmed: true, session_date: "2026-05-10", reply_sent_at: null,
    invoice_sent_at: null, contract_sent_at: null, deposit_paid_at: null,
    gallery_delivered_at: null, instagram: null, school: "SJSU",
    preferred_time: null, people: null, location: null, confirmation_sent_at: null,
    needs_reply: null, needs_reply_dismissed_at: null, last_inbound_at: null,
    last_outbound_at: null,
    last_message_at: null, last_message_direction: null, status_source: null,
    gmail_thread_ids: null,
    ...overrides,
  };
}

describe("suggestInquiryLinks", () => {
  const inquiries = [
    inquiry({ id: 84, name: "Milthon", email: "milthon@example.com" }),
    inquiry({ id: 90, name: "Lauren Marsh", email: "lauren@example.com" }),
    inquiry({ id: 91, name: "Lauren Owens", email: "owens@example.com" }),
  ];

  it("prefers an exact payer email over names", () => {
    const links = suggestInquiryLinks([row({ id: 150, client_name: "Milthon Marquez", client_email: "MILTHON@example.com" })], inquiries);
    expect(links).toEqual([expect.objectContaining({ inquiryId: 84, evidence: "email", paymentIds: [150] })]);
  });

  it("falls back to a full-name match and never matches on a shared first name alone", () => {
    const links = suggestInquiryLinks([row({ id: 179, client_name: "Lauren Marsh", client_email: "" })], inquiries);
    expect(links.map(l => [l.inquiryId, l.evidence])).toEqual([[90, "name"]]);
  });

  it("names agree only when every token of the shorter name appears in the longer one", () => {
    expect(namesAgree("Milthon", "Milthon Marquez")).toBe(true);
    expect(namesAgree("Lauren Owens", "Lauren Marsh")).toBe(false);
  });
});

describe("paid inquiries missing from revenue", () => {
  it("flags an inquiry marked paid with no active ledger payment and offers to link the client's unlinked rows", () => {
    const inquiries = [inquiry({ id: 84, name: "Milthon", email: "m@example.com", payment_note: "Venmo: 425.00" })];
    const rows = [
      row({ id: 150, client_name: "Milthon Marquez", client_email: "m@example.com", amount_cents: 21250 }),
      row({ id: 172, client_name: "Milthon Marquez", client_email: "m@example.com", amount_cents: 21250, payment_type: "deposit_2" }),
    ];
    const issue = findQualityIssues(rows, inquiries).find(i => i.rule === "paidInquiryWithoutLedger");
    expect(issue?.severity).toBe("high");
    expect(issue?.inquiryId).toBe(84);
    expect(issue?.linkActions).toEqual([expect.objectContaining({ inquiryId: 84, paymentIds: [150, 172], evidence: "email" })]);
  });

  it("points at a duplicate inquiry when the client's payments are linked elsewhere", () => {
    const inquiries = [inquiry({ id: 32, name: "Kim Hoang", email: "k@example.com" }), inquiry({ id: 33, name: "Kim Hoang", email: "k@example.com" })];
    const rows = [row({ id: 152, inquiry_id: 33, client_name: "Kim Hoang", client_email: "k@example.com" })];
    const issue = findQualityIssues(rows, inquiries).find(i => i.rule === "paidInquiryWithoutLedger");
    expect(issue?.reason).toMatch(/#33/);
    expect(issue?.linkActions).toEqual([]);
  });

  it("does not flag a paid inquiry whose payment is voided only when another active one exists", () => {
    const inquiries = [inquiry({ id: 5 })];
    expect(findPaidInquiriesWithoutLedger(inquiries, [row({ inquiry_id: 5 })])).toEqual([]);
    expect(findPaidInquiriesWithoutLedger(inquiries, [row({ inquiry_id: 5, status: "voided" })])).toHaveLength(1);
  });

  it("ignores unpaid inquiries", () => {
    expect(findPaidInquiriesWithoutLedger([inquiry({ payment_status: "unpaid" })], [])).toEqual([]);
  });
});

describe("cross-import duplicate finding", () => {
  it("suggests voiding the copy without transaction evidence", () => {
    const rows = [
      row({ id: 177, client_name: "Allen Mata", client_email: "", source: "auto", paid_at: "2026-02-05T20:00:00Z", amount_cents: 19000 }),
      row({ id: 222, client_name: "Allen Mata", client_email: "a@example.com", source: "pass1", source_txn_id: "gmail:1", paid_at: "2026-02-05T17:27:27Z", amount_cents: 19000 }),
    ];
    const dup = findQualityIssues(rows).find(i => i.rule === "duplicate");
    expect(dup?.paymentIds.sort()).toEqual([177, 222]);
    expect(dup?.suggestedVoidId).toBe(177);
  });
});

describe("unlinked payer grouping", () => {
  it("folds a no-email import row into the same payer's email group", () => {
    const rows = [
      row({ id: 177, client_name: "Allen Mata", client_email: "", amount_cents: 19000 }),
      row({ id: 178, client_name: "Allen Mata", client_email: "", amount_cents: 19000, payment_type: "deposit_2", paid_at: "2026-02-21T20:00:00Z" }),
      row({ id: 222, client_name: "Allen Mata", client_email: "a@example.com", amount_cents: 19000, source_txn_id: "gmail:1" }),
      row({ id: 300, client_name: "Allen Smith", client_email: "", amount_cents: 5000 }),
    ];
    const unlinked = findQualityIssues(rows).filter(i => i.rule === "unlinkedClient");
    expect(unlinked.map(i => i.paymentIds.sort())).toEqual([[177, 178, 222], [300]]);
  });
});
