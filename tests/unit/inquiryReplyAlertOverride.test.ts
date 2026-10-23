// The manual "Dismiss Reply Alert" override, as the Darkroom inquiry card uses
// it. Three states have to stay distinct — awaiting a reply, replied to, and
// manually dismissed — and a dismissal has to be scoped to the conversation
// state it was made in, so a later client message brings the alert back.

import { describe, it, expect } from "vitest";
import {
  deriveNeedsReply,
  inquiryConversationStatus,
  inquiryNeedsReply,
  replyAlertDismissed,
  type AdminInquiry,
} from "@/lib/adminInquiries";

/** An inquiry as it looks right after the client submitted the form. */
const inquiry = (over: Partial<AdminInquiry> = {}): AdminInquiry => ({
  id: 141, name: "Farnaz", email: "farnaz@example.com", phone: null,
  session_type: "Graduation", date_in_mind: null, message: "Thank you so much!",
  status: "new", created_at: "2026-10-01T18:00:00Z", payment_status: "unpaid",
  payment_note: null, payment_detected_at: null, booking_confirmed: false,
  session_date: null, reply_sent_at: null, invoice_sent_at: null, contract_sent_at: null,
  deposit_paid_at: null, gallery_delivered_at: null, instagram: null, school: null,
  preferred_time: null, people: null, location: null, confirmation_sent_at: null,
  needs_reply: true, needs_reply_dismissed_at: null,
  last_inbound_at: "2026-10-01T18:00:00Z", last_outbound_at: null,
  last_message_at: "2026-10-01T18:00:00Z", last_message_direction: "inbound",
  status_source: "automatic", gmail_thread_ids: ["t1"], ...over,
});

/**
 * The reported case: the session happened and was paid for, the client's thank-you
 * is the latest message, and the card keeps asking for a reply that is not coming.
 */
const farnaz = (over: Partial<AdminInquiry> = {}) => inquiry({
  status: "responded", payment_status: "paid",
  reply_sent_at: "2026-09-02T10:00:00Z", last_outbound_at: "2026-09-20T10:00:00Z",
  gallery_delivered_at: "2026-09-25T10:00:00Z",
  last_inbound_at: "2026-10-01T18:00:00Z", ...over,
});

/** What the dashboard writes when "Dismiss Reply Alert" is clicked. */
const dismissedAt = (at: string, row: AdminInquiry) => ({
  ...row, needs_reply: false, needs_reply_dismissed_at: at,
});

describe("replyAlertDismissed", () => {
  it("is false with no dismissal recorded", () => {
    expect(replyAlertDismissed(farnaz())).toBe(false);
  });

  it("holds while the client has not written since the dismissal", () => {
    expect(replyAlertDismissed(dismissedAt("2026-10-02T09:00:00Z", farnaz()))).toBe(true);
  });

  it("lapses once a newer inbound message arrives", () => {
    const row = dismissedAt("2026-10-02T09:00:00Z", farnaz());
    expect(replyAlertDismissed({
      ...row, last_inbound_at: "2026-10-05T11:00:00Z", needs_reply: true,
    })).toBe(false);
  });

  it("does not outlive a dismissal made before the client's message", () => {
    // Clock-level tie: a dismissal stamped at the same instant as the inbound
    // still counts — the message it was answering is that one.
    expect(replyAlertDismissed(dismissedAt("2026-10-01T18:00:00Z", farnaz()))).toBe(true);
  });
});

describe("inquiryNeedsReply with a dismissal", () => {
  it("queues the reported case before dismissal", () => {
    expect(inquiryNeedsReply(farnaz())).toBe(true);
    expect(inquiryConversationStatus(farnaz())).toBe("needs_reply");
  });

  it("drops it from the queue after dismissal, without claiming a reply", () => {
    const row = dismissedAt("2026-10-02T09:00:00Z", farnaz());
    expect(inquiryNeedsReply(row)).toBe(false);
    // Status and reply history are untouched — the dismissal is not a reply.
    expect(row.status).toBe("responded");
    expect(row.reply_sent_at).toBe("2026-09-02T10:00:00Z");
  });

  it("drops a never-answered inquiry from the queue too, and keeps it NEW", () => {
    const row = dismissedAt("2026-10-02T09:00:00Z", inquiry());
    expect(inquiryNeedsReply(row)).toBe(false);
    // Not promoted to "responded" — nothing was ever sent.
    expect(inquiryConversationStatus(row)).toBe("new");
  });

  it("re-queues the inquiry when the client writes again", () => {
    const row = dismissedAt("2026-10-02T09:00:00Z", farnaz());
    expect(inquiryNeedsReply({
      ...row, needs_reply: true, last_inbound_at: "2026-10-06T08:00:00Z",
      last_message_direction: "inbound",
    })).toBe(true);
  });

  it("leaves archived and not-interested rows out of it either way", () => {
    for (const status of ["archived", "not_interested"]) {
      expect(inquiryNeedsReply(farnaz({ status }))).toBe(false);
      expect(inquiryNeedsReply(dismissedAt("2026-10-02T09:00:00Z", farnaz({ status })))).toBe(false);
    }
  });
});

describe("deriveNeedsReply — what Restore Reply Alert writes back", () => {
  it("re-flags a conversation whose latest message is the client's", () => {
    expect(deriveNeedsReply(dismissedAt("2026-10-02T09:00:00Z", farnaz()))).toBe(true);
  });

  it("leaves a conversation we answered last alone", () => {
    expect(deriveNeedsReply(farnaz({ last_outbound_at: "2026-10-03T10:00:00Z" }))).toBe(false);
  });

  it("counts the submission itself as the first inbound message", () => {
    expect(deriveNeedsReply(inquiry({ last_inbound_at: null }))).toBe(true);
  });

  it("ignores the stored flag and the dismissal", () => {
    // Both say "no reply needed"; the timestamps say otherwise and win.
    expect(deriveNeedsReply({
      ...farnaz(), needs_reply: false, needs_reply_dismissed_at: "2026-10-02T09:00:00Z",
    })).toBe(true);
  });

  it("stays false for closed dispositions", () => {
    expect(deriveNeedsReply(farnaz({ status: "archived" }))).toBe(false);
    expect(deriveNeedsReply(farnaz({ status: "not_interested" }))).toBe(false);
  });

  it("treats a stamped milestone as our latest word", () => {
    expect(deriveNeedsReply(inquiry({
      last_inbound_at: "2026-10-01T18:00:00Z",
      confirmation_sent_at: "2026-10-02T12:00:00Z",
    }))).toBe(false);
  });
});
