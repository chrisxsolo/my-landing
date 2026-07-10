import { describe, it, expect } from "vitest";
import {
  computeInquiryReconciliation,
  isOutboundMessage,
  normalizeEmail,
  type ReconcileInquirySnapshot,
  type ReconcileMessage,
} from "@/lib/inquiryReconcile";

const ME = "soloxsnaps@gmail.com";
const CLIENT = "esterchan059@gmail.com";

const inquiry = (over: Partial<ReconcileInquirySnapshot> = {}): ReconcileInquirySnapshot => ({
  id: 92, email: CLIENT, status: "new", statusSource: "automatic",
  createdAt: "2026-07-07T18:04:08Z", replySentAt: null, invoiceSentAt: null,
  contractSentAt: null, depositPaidAt: null, confirmationSentAt: null,
  galleryDeliveredAt: null, bookingConfirmed: false, paymentStatus: "unpaid",
  needsReply: null, lastInboundAt: null, lastOutboundAt: null, lastMessageAt: null,
  lastMessageDirection: null, gmailThreadIds: null, ...over,
});

const msg = (direction: "inbound" | "outbound", at: string, over: Partial<ReconcileMessage> = {}): ReconcileMessage => ({
  id: `m-${at}`, threadId: "t1", at, fromEmail: direction === "outbound" ? ME : CLIENT, direction, ...over,
});

describe("normalizeEmail", () => {
  it("extracts the address from display-name formatting and lowercases", () => {
    expect(normalizeEmail("Esther Chan <EsterChan059@Gmail.com>")).toBe(CLIENT);
    expect(normalizeEmail("  SOLOXSNAPS@GMAIL.COM ")).toBe(ME);
  });
});

describe("isOutboundMessage", () => {
  it("matches the connected account and its aliases, case-insensitively", () => {
    expect(isOutboundMessage({ fromEmail: `Solo x Snaps <${ME}>` }, [ME])).toBe(true);
    expect(isOutboundMessage({ fromEmail: CLIENT }, [ME])).toBe(false);
    expect(isOutboundMessage({ fromEmail: "chris@soloxsnaps.com" }, [ME, "chris@soloxsnaps.com"])).toBe(true);
  });
});

describe("computeInquiryReconciliation", () => {
  it("keeps a never-replied inquiry new and needing a reply", () => {
    const r = computeInquiryReconciliation(inquiry(), []);
    expect(r.nextStatus).toBe("new");
    expect(r.hasReplied).toBe(false);
    expect(r.needsReply).toBe(true);
    expect(r.updates.needs_reply).toBe(true);
  });

  it("promotes to responded when an outbound reply exists after the inquiry", () => {
    const r = computeInquiryReconciliation(inquiry(), [
      msg("inbound", "2026-07-07T18:04:00Z"),
      msg("outbound", "2026-07-07T18:59:37Z"),
    ]);
    expect(r.nextStatus).toBe("responded");
    expect(r.hasReplied).toBe(true);
    expect(r.needsReply).toBe(false);
    expect(r.updates.status).toBe("responded");
    expect(r.updates.reply_sent_at).toBe("2026-07-07T18:59:37.000Z");
  });

  it("stays responded (never regresses to new) when the client sent the latest message", () => {
    const r = computeInquiryReconciliation(inquiry({ status: "responded", replySentAt: "2026-07-07T18:59:37Z" }), [
      msg("outbound", "2026-07-07T18:59:37Z"),
      msg("inbound", "2026-07-08T09:00:00Z"),
    ]);
    expect(r.nextStatus).toBe("responded");
    expect(r.needsReply).toBe(true);
    expect(r.updates.status).toBeUndefined();
  });

  it("ignores outbound mail sent before the inquiry existed", () => {
    const r = computeInquiryReconciliation(inquiry(), [
      msg("outbound", "2026-06-01T10:00:00Z"),
    ]);
    expect(r.hasReplied).toBe(false);
    expect(r.nextStatus).toBe("new");
  });

  it("treats booking progress as proof of contact even without Gmail messages", () => {
    const r = computeInquiryReconciliation(
      inquiry({ invoiceSentAt: "2026-07-07T23:09:24Z", contractSentAt: "2026-07-07T23:09:24Z" }),
      [],
    );
    expect(r.nextStatus).toBe("responded");
    expect(r.hasReplied).toBe(true);
    expect(r.needsReply).toBe(false); // invoice/contract stamps count as outbound evidence
    expect(r.debug.bookingProgressEvents).toEqual(["invoice_sent", "contract_sent"]);
  });

  it("flags responded inquiries as needing a reply when the client wrote after the last outbound", () => {
    const r = computeInquiryReconciliation(
      inquiry({ status: "responded", replySentAt: "2026-07-07T18:59:37Z", invoiceSentAt: "2026-07-07T23:09:24Z" }),
      [
        msg("outbound", "2026-07-07T23:09:24Z"),
        msg("inbound", "2026-07-09T19:30:00Z"),
      ],
    );
    expect(r.nextStatus).toBe("responded");
    expect(r.needsReply).toBe(true);
    expect(r.updates.last_message_direction).toBe("inbound");
  });

  it("never touches archived or not-interested statuses", () => {
    for (const status of ["archived", "not_interested"]) {
      const r = computeInquiryReconciliation(inquiry({ status }), [
        msg("outbound", "2026-07-07T18:59:37Z"),
        msg("inbound", "2026-07-08T09:00:00Z"),
      ]);
      expect(r.nextStatus).toBe(status);
      expect(r.needsReply).toBe(false);
    }
  });

  it("never overwrites a manually chosen status but still updates message state", () => {
    const r = computeInquiryReconciliation(inquiry({ status: "new", statusSource: "manual" }), [
      msg("outbound", "2026-07-07T18:59:37Z"),
    ]);
    expect(r.nextStatus).toBe("new");
    expect(r.updates.status).toBeUndefined();
    expect(r.updates.last_outbound_at).toBe("2026-07-07T18:59:37.000Z");
  });

  it("reports no change when the stored state already matches", () => {
    const first = computeInquiryReconciliation(inquiry(), [msg("outbound", "2026-07-07T18:59:37Z")]);
    const stored = inquiry({
      status: "responded",
      replySentAt: "2026-07-07T18:59:37.000Z",
      needsReply: false,
      lastInboundAt: first.debug.lastInboundAt,
      lastOutboundAt: first.debug.lastOutboundAt,
      lastMessageAt: first.debug.lastOutboundAt,
      lastMessageDirection: "outbound",
      gmailThreadIds: ["t1"],
    });
    const second = computeInquiryReconciliation(stored, [msg("outbound", "2026-07-07T18:59:37Z")]);
    expect(second.changed).toBe(false);
  });

  it("accepts Postgres timestamptz text for created_at", () => {
    const r = computeInquiryReconciliation(
      inquiry({ createdAt: "2026-07-07 18:04:08.132956+00" }),
      [msg("outbound", "2026-07-07T18:59:37Z")],
    );
    expect(r.nextStatus).toBe("responded");
  });

  it("merges and dedupes matched Gmail thread ids", () => {
    const r = computeInquiryReconciliation(inquiry({ gmailThreadIds: ["t0"] }), [
      msg("inbound", "2026-07-07T18:04:00Z", { threadId: "t1" }),
      msg("outbound", "2026-07-07T18:59:37Z", { threadId: "t1" }),
    ]);
    expect(r.updates.gmail_thread_ids).toEqual(["t0", "t1"]);
  });
});
