// Pure planning rules for the timeline sync. Synthetic fixtures only.
import { describe, expect, it } from "vitest";
import {
  addEvidence,
  createEvidenceBook,
  evidenceInWindow,
  inquiryWindows,
  OPEN_WINDOW,
  type WindowEvidence,
} from "@/lib/timelineSync/evidence";
import {
  pairSessionsWithInquiries,
  planInquiryStamps,
  planSessionUpdates,
  selectScanTargets,
  type SyncInquiry,
  type SyncSession,
} from "@/lib/timelineSync/plan";

const EMAIL = "alex@example.com";
const NONE: WindowEvidence = {
  reply: null, invoiceSent: null, contractSent: null, depositPaid: null, contractSigned: null, galleryDelivered: null,
};

const inquiry = (over: Partial<SyncInquiry> = {}): SyncInquiry => ({
  id: 1, email: EMAIL, name: "Alex Example", status: "responded", created_at: "2026-11-01T00:00:00Z",
  last_message_at: null, session_type: "Graduation", session_date: null, date_in_mind: null,
  preferred_time: null, location: null, reply_sent_at: null, invoice_sent_at: null, contract_sent_at: null,
  deposit_paid_at: null, gallery_delivered_at: null, booking_confirmed: false, ...over,
});

const session = (over: Partial<SyncSession> = {}): SyncSession => ({
  id: "s1", client_email: EMAIL, client_name: "Alex Example", session_type: "Graduation", session_date: null,
  invoice_status: null, contract_status: null, current_status: "inquiry_received",
  estimated_delivery_date: null, ...over,
});

describe("evidence windows", () => {
  it("ignores evidence with no usable timestamp", () => {
    const book = createEvidenceBook();
    addEvidence(book, EMAIL, "invoiceSent", null);
    addEvidence(book, EMAIL, "invoiceSent", "not a date");
    expect(evidenceInWindow(book, EMAIL, OPEN_WINDOW).invoiceSent).toBeNull();
  });

  it("gives each of a client's inquiries only the evidence from its own period", () => {
    const older = inquiry({ id: 1, created_at: "2025-11-01T00:00:00Z" });
    const newer = inquiry({ id: 2, created_at: "2026-11-01T00:00:00Z" });
    const book = createEvidenceBook();
    addEvidence(book, EMAIL, "invoiceSent", "2025-11-05T00:00:00Z");
    addEvidence(book, EMAIL.toUpperCase(), "invoiceSent", "2026-11-05T00:00:00Z");
    const windows = inquiryWindows([newer, older]);
    expect(evidenceInWindow(book, EMAIL, windows.get(1)!).invoiceSent).toBe("2025-11-05T00:00:00.000Z");
    expect(evidenceInWindow(book, EMAIL, windows.get(2)!).invoiceSent).toBe("2026-11-05T00:00:00.000Z");
  });

  it("does not hand last year's evidence to a new inquiry that has none yet", () => {
    const older = inquiry({ id: 1, created_at: "2025-11-01T00:00:00Z" });
    const newer = inquiry({ id: 2, created_at: "2026-11-01T00:00:00Z" });
    const book = createEvidenceBook();
    addEvidence(book, EMAIL, "contractSent", "2025-11-05T00:00:00Z");
    expect(evidenceInWindow(book, EMAIL, inquiryWindows([older, newer]).get(2)!).contractSent).toBeNull();
  });
});

describe("planInquiryStamps", () => {
  const sent = { ...NONE, invoiceSent: "2026-11-10T18:00:00.000Z", contractSent: "2026-11-10T18:00:05.000Z" };

  it("stamps sent milestones from evidence", () => {
    expect(planInquiryStamps(inquiry(), sent, null)).toEqual({
      invoice_sent_at: sent.invoiceSent, contract_sent_at: sent.contractSent,
    });
  });

  it("never replaces a date that is already recorded", () => {
    const existing = inquiry({ invoice_sent_at: "2026-11-02T00:00:00Z", contract_sent_at: "2026-11-02T00:00:00Z" });
    expect(planInquiryStamps(existing, sent, null)).toEqual({});
  });

  it("a signed contract alone stamps nothing — not sent, not paid, not booked", () => {
    const signedOnly = { ...NONE, contractSigned: "2026-11-11T18:00:00.000Z" };
    expect(planInquiryStamps(inquiry(), signedOnly, null)).toEqual({});
  });

  it("only deposit evidence confirms the booking", () => {
    expect(planInquiryStamps(inquiry(), sent, null)).not.toHaveProperty("booking_confirmed");
    const paid = { ...NONE, depositPaid: "2026-11-12T00:00:00.000Z" };
    expect(planInquiryStamps(inquiry(), paid, null)).toEqual({
      deposit_paid_at: paid.depositPaid, booking_confirmed: true,
    });
  });
});

describe("planSessionUpdates", () => {
  const today = "2026-11-18";

  it("records sent and signed documents and moves an early stage to booking in progress", () => {
    const evidence = { ...NONE, invoiceSent: "2026-11-10T00:00:00Z", contractSigned: "2026-11-11T00:00:00Z" };
    expect(planSessionUpdates(session(), evidence, inquiry(), today).updates).toEqual({
      invoice_status: "sent", contract_status: "signed", current_status: "booking_in_progress",
    });
  });

  it("a signed contract never marks the invoice paid or the session booked", () => {
    const evidence = { ...NONE, contractSigned: "2026-11-11T00:00:00Z" };
    const { updates } = planSessionUpdates(session({ invoice_status: "sent" }), evidence, inquiry(), today);
    expect(updates).toEqual({ contract_status: "signed", current_status: "booking_in_progress" });
  });

  it("never regresses a paid, signed, later-stage session", () => {
    const later = session({ invoice_status: "paid", contract_status: "signed", current_status: "editing" });
    const evidence = { ...NONE, invoiceSent: "2026-11-10T00:00:00Z", contractSent: "2026-11-10T00:00:00Z" };
    expect(planSessionUpdates(later, evidence, inquiry(), today).updates).toEqual({});
  });

  it("applies no evidence to a session that could not be tied to one booking", () => {
    const dated = session({ session_date: "2026-12-01" });
    expect(planSessionUpdates(dated, null, null, today).updates).toEqual({ estimated_delivery_date: "2026-12-15" });
  });
});

describe("pairSessionsWithInquiries", () => {
  it("pairs a client's only session with their newest inquiry", () => {
    const older = inquiry({ id: 1, created_at: "2025-01-01T00:00:00Z" });
    const newer = inquiry({ id: 2 });
    const pairing = pairSessionsWithInquiries([session()], [older, newer]);
    expect(pairing.inquiryBySession.get("s1")?.id).toBe(2);
    expect(pairing.ambiguousSessionIds).toEqual([]);
  });

  it("leaves a second booking ambiguous instead of sharing one client's milestones", () => {
    const sessions = [
      session({ id: "grad", session_type: "Graduation", session_date: "2026-12-01" }),
      session({ id: "family", session_type: "Family", session_date: "2027-03-01" }),
    ];
    const pairing = pairSessionsWithInquiries(sessions, [inquiry({ session_date: "2026-12-01" })]);
    expect(pairing.inquiryBySession.get("grad")?.id).toBe(1);
    expect(pairing.ambiguousSessionIds).toEqual(["family"]);
  });
});

describe("selectScanTargets", () => {
  const now = Date.parse("2026-11-18T00:00:00Z");

  it("scans live, unfinished, recently active clients and counts the overflow", () => {
    const inquiries = [
      inquiry({ id: 1, email: "a@example.com", created_at: "2026-11-10T00:00:00Z" }),
      inquiry({ id: 2, email: "b@example.com", created_at: "2026-11-12T00:00:00Z" }),
      inquiry({ id: 3, email: "c@example.com", created_at: "2026-11-14T00:00:00Z" }),
      inquiry({ id: 4, email: "closed@example.com", status: "archived" }),
      inquiry({ id: 5, email: "old@example.com", created_at: "2026-01-01T00:00:00Z" }),
    ];
    const plan = selectScanTargets(inquiries, now, 2);
    expect(plan.targets.map(t => t.email)).toEqual(["c@example.com", "b@example.com"]);
    expect(plan.overLimit).toBe(1);
  });
});
