// Derived inquiry conversation status — the single source of truth behind the
// Darkroom inquiry card's badge and rail. Covers the alternating back-and-forth
// the dashboard has to track, the dispositions it must never override, and the
// rule that a blue "Responded" card never carries the amber needs-reply look.

import { describe, it, expect } from "vitest";
import {
  inquiryConversationStatus,
  inquiryEverReplied,
  inquiryNeedsReply,
  type AdminInquiry,
} from "@/lib/adminInquiries";
import { INQ_STATUS, T, inquiryCardChrome } from "@/app/admin/adminTheme";

/** An inquiry as it looks right after the client submitted the form. */
const inquiry = (over: Partial<AdminInquiry> = {}): AdminInquiry => ({
  id: 92, name: "Esther Chan", email: "esterchan059@gmail.com", phone: null,
  session_type: "Graduation", date_in_mind: "Nov 26", message: "Are you available November 26th?",
  status: "new", created_at: "2026-11-01T18:00:00Z", payment_status: "unpaid",
  payment_note: null, payment_detected_at: null, booking_confirmed: false,
  session_date: null, reply_sent_at: null, invoice_sent_at: null, contract_sent_at: null,
  deposit_paid_at: null, gallery_delivered_at: null, instagram: null, school: null,
  preferred_time: null, people: null, location: null, confirmation_sent_at: null,
  needs_reply: true, needs_reply_dismissed_at: null,
  last_inbound_at: "2026-11-01T18:00:00Z", last_outbound_at: null,
  last_message_at: "2026-11-01T18:00:00Z", last_message_direction: "inbound",
  status_source: "automatic", gmail_thread_ids: ["t1"], ...over,
});

/** The row as reconciliation leaves it after the photographer wrote at `at`. */
const photographerWroteAt = (at: string, over: Partial<AdminInquiry> = {}) => inquiry({
  status: "responded", reply_sent_at: at, needs_reply: false,
  last_outbound_at: at, last_message_at: at, last_message_direction: "outbound", ...over,
});

/** The row as reconciliation leaves it after the client wrote at `at`. */
const clientWroteAt = (at: string, over: Partial<AdminInquiry> = {}) => inquiry({
  status: "responded", needs_reply: true,
  last_inbound_at: at, last_message_at: at, last_message_direction: "inbound", ...over,
});

describe("inquiryConversationStatus — alternating correspondence", () => {
  it("step 1: a fresh inquiry is NEW", () => {
    expect(inquiryConversationStatus(inquiry())).toBe("new");
  });

  it("step 2: the photographer's first reply is RESPONDED", () => {
    expect(inquiryConversationStatus(photographerWroteAt("2026-11-01T19:00:00Z"))).toBe("responded");
  });

  it("step 3: the client's answer is NEEDS REPLY", () => {
    expect(inquiryConversationStatus(clientWroteAt("2026-11-01T20:00:00Z", {
      reply_sent_at: "2026-11-01T19:00:00Z", last_outbound_at: "2026-11-01T19:00:00Z",
    }))).toBe("needs_reply");
  });

  it("steps 4-7: keeps alternating over unlimited rounds", () => {
    const rounds: { at: string; who: "me" | "client"; expect: string }[] = [
      { at: "2026-11-01T21:00:00Z", who: "me", expect: "responded" },
      { at: "2026-11-02T08:00:00Z", who: "client", expect: "needs_reply" },
      { at: "2026-11-02T09:00:00Z", who: "me", expect: "responded" },
      { at: "2026-11-03T12:00:00Z", who: "client", expect: "needs_reply" },
      { at: "2026-11-03T13:00:00Z", who: "me", expect: "responded" },
    ];
    let lastOutbound = "2026-11-01T19:00:00Z";
    for (const round of rounds) {
      const row = round.who === "me"
        ? photographerWroteAt(round.at, { reply_sent_at: "2026-11-01T19:00:00Z" })
        : clientWroteAt(round.at, { reply_sent_at: "2026-11-01T19:00:00Z", last_outbound_at: lastOutbound });
      if (round.who === "me") lastOutbound = round.at;
      expect(inquiryConversationStatus(row), `${round.who} at ${round.at}`).toBe(round.expect);
    }
  });

  it("stays NEW through several unanswered client messages", () => {
    expect(inquiryConversationStatus(inquiry({
      last_inbound_at: "2026-11-02T10:00:00Z", last_message_at: "2026-11-02T10:00:00Z",
    }))).toBe("new");
  });

  it("stays RESPONDED through several consecutive photographer messages", () => {
    expect(inquiryConversationStatus(photographerWroteAt("2026-11-02T10:00:00Z", {
      reply_sent_at: "2026-11-01T19:00:00Z",
    }))).toBe("responded");
  });
});

describe("inquiryConversationStatus — dispositions and overrides", () => {
  it("preserves Archived even when a newer client message arrived", () => {
    expect(inquiryConversationStatus(inquiry({ status: "archived", needs_reply: true }))).toBe("archived");
  });

  it("preserves Not interested even when a newer client message arrived", () => {
    expect(inquiryConversationStatus(inquiry({ status: "not_interested", needs_reply: true }))).toBe("not_interested");
  });

  it("respects a manual needs-reply dismissal as handled", () => {
    expect(inquiryConversationStatus(clientWroteAt("2026-11-02T08:00:00Z", {
      needs_reply: false, needs_reply_dismissed_at: "2026-11-02T08:30:00Z",
      last_outbound_at: "2026-11-01T19:00:00Z",
    }))).toBe("responded");
  });
});

describe("inquiryConversationStatus — incomplete / historical data", () => {
  it("falls back to last-message direction for rows never reconciled", () => {
    expect(inquiryConversationStatus(inquiry({
      status: "responded", needs_reply: null, reply_sent_at: "2026-11-01T19:00:00Z",
      last_message_direction: "inbound",
    }))).toBe("needs_reply");
    expect(inquiryConversationStatus(inquiry({
      status: "responded", needs_reply: null, reply_sent_at: "2026-11-01T19:00:00Z",
      last_message_direction: "outbound",
    }))).toBe("responded");
  });

  it("derives a legacy row with only booking progress as RESPONDED", () => {
    expect(inquiryConversationStatus(inquiry({
      status: "new", needs_reply: null, last_message_direction: null,
      invoice_sent_at: "2026-11-01T19:00:00Z", reply_sent_at: null,
    }))).toBe("responded");
  });

  it("never invents a reply when nothing says the photographer wrote", () => {
    const row = inquiry({ needs_reply: null, last_message_direction: null, status: "new" });
    expect(inquiryEverReplied(row)).toBe(false);
    expect(inquiryConversationStatus(row)).toBe("new");
  });

  it("does not change when Gmail sync fails and leaves the row untouched", () => {
    const row = photographerWroteAt("2026-11-01T19:00:00Z");
    expect(inquiryConversationStatus(row)).toBe("responded");
    // Same row re-derived (a page refresh after a failed sync) → same answer.
    expect(inquiryConversationStatus({ ...row })).toBe("responded");
  });
});

describe("inquiryConversationStatus — unread Gmail thread evidence", () => {
  const answered = photographerWroteAt("2026-11-01T19:00:00Z");

  it("flags a client reply Gmail reported before reconciliation ran", () => {
    const at = Date.parse("2026-11-01T20:00:00Z");
    expect(inquiryConversationStatus(answered, { unreadInboundAt: at })).toBe("needs_reply");
  });

  it("ignores an unread thread older than the latest reply", () => {
    const at = Date.parse("2026-11-01T18:30:00Z");
    expect(inquiryConversationStatus(answered, { unreadInboundAt: at })).toBe("responded");
  });

  it("ignores an unread thread older than a manual dismissal", () => {
    const row = clientWroteAt("2026-11-02T08:00:00Z", {
      needs_reply: false, needs_reply_dismissed_at: "2026-11-02T09:00:00Z",
      last_outbound_at: "2026-11-01T19:00:00Z",
    });
    expect(inquiryConversationStatus(row, { unreadInboundAt: Date.parse("2026-11-02T08:00:00Z") })).toBe("responded");
  });

  it("never reopens an archived inquiry because of an unread thread", () => {
    const row = inquiry({ status: "archived" });
    expect(inquiryConversationStatus(row, { unreadInboundAt: Date.now() })).toBe("archived");
  });
});

describe("inquiryNeedsReply queue membership", () => {
  it("includes new and needs-reply inquiries, excludes answered and closed ones", () => {
    expect(inquiryNeedsReply(inquiry())).toBe(true);
    expect(inquiryNeedsReply(clientWroteAt("2026-11-02T08:00:00Z", {
      reply_sent_at: "2026-11-01T19:00:00Z", last_outbound_at: "2026-11-01T19:00:00Z",
    }))).toBe(true);
    expect(inquiryNeedsReply(photographerWroteAt("2026-11-01T19:00:00Z"))).toBe(false);
    expect(inquiryNeedsReply(inquiry({ status: "archived" }))).toBe(false);
    expect(inquiryNeedsReply(inquiry({ status: "not_interested" }))).toBe(false);
  });
});

describe("inquiryCardChrome", () => {
  it("gives every status one badge and a matching rail", () => {
    expect(inquiryCardChrome("new").card.borderLeft).toContain(T.green);
    expect(inquiryCardChrome("needs_reply").card.borderLeft).toContain(T.amber);
    expect(inquiryCardChrome("responded").card.borderLeft).toContain(T.blue);
    expect(inquiryCardChrome("new").label).toBe(INQ_STATUS.new.label);
    expect(inquiryCardChrome("responded").badge.color).toBe(T.blue);
  });

  it("never gives a RESPONDED card the amber needs-reply highlight", () => {
    const responded = inquiryCardChrome("responded");
    expect(responded.card.border).toBe(`1px solid ${T.border}`);
    expect(responded.card.border).not.toContain(T.amberBorder);
    expect(responded.card.borderLeft).not.toContain(T.amber);
    expect(responded.badge.background).not.toBe(T.amberBg);
    expect(responded.label.toLowerCase()).not.toContain("needs reply");
  });

  it("gives a NEEDS REPLY card the amber highlight and no responded label", () => {
    const awaiting = inquiryCardChrome("needs_reply");
    expect(awaiting.card.border).toBe(`1px solid ${T.amberBorder}`);
    expect(awaiting.card.borderLeft).toBe(`3px solid ${T.amber}`);
    expect(awaiting.label.toLowerCase()).not.toContain("responded");
  });
});
