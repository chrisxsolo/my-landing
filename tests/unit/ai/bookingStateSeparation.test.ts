import { describe, it, expect } from "vitest";
import { buildAdminStatus, renderAdminStatus, type InquiryAdminRow } from "@/lib/ai/adminStatus";
import { buildThreadDigest, type ThreadMessage } from "@/lib/ai/threadDigest";
import { detectStage } from "@/lib/ai/conversationStage";

// ─────────────────────────────────────────────────────────────────────────────
// Sent, paid, signed and confirmed are four different events.
//
// The old code folded them into one boolean: `depositPaid || bookingConfirmed
// || invoiceSent`. Six live inquiries have an invoice sent against no payment,
// so under that definition each of them was "booked" — and the draft is what
// tells the client their session is secured.
// ─────────────────────────────────────────────────────────────────────────────

const NOW = new Date("2026-10-15T12:00:00Z");
const digestOf = (messages: ThreadMessage[] = []) => buildThreadDigest(messages, NOW);
const statusOf = (row: InquiryAdminRow | null, messages: ThreadMessage[] = []) =>
  buildAdminStatus(row, digestOf(messages));

describe("an invoice going out is not a booking", () => {
  it("does not call an invoiced, unpaid session booked", () => {
    const status = statusOf({ invoice_sent_at: "2026-10-01T00:00:00Z" });
    expect(status.invoiceSent).toBe(true);
    expect(status.depositPaid).toBe(false);
    expect(status.fullyBooked).toBe(false);
    expect(status.bookingConfirmed).toBe(false);
  });

  it("does not let a payment stand in for a confirmation", () => {
    const status = statusOf({ deposit_paid_at: "2026-10-01T00:00:00Z", booking_confirmed: false });
    expect(status.depositPaid).toBe(true);
    expect(status.bookingConfirmed).toBe(false);
    expect(status.fullyBooked).toBe(false);
  });

  it("calls it booked only when the deposit is in AND the booking is confirmed", () => {
    const status = statusOf({ deposit_paid_at: "2026-10-01T00:00:00Z", booking_confirmed: true });
    expect(status.fullyBooked).toBe(true);
  });

  it("tells the draft not to claim the session is booked on a payment alone", () => {
    const lines = renderAdminStatus(statusOf({
      invoice_sent_at: "2026-10-01T00:00:00Z",
      deposit_paid_at: "2026-10-02T00:00:00Z",
      booking_confirmed: false,
    })).join("\n");
    expect(lines).toMatch(/do not say the session is officially booked or confirmed/i);
  });
});

describe("a contract coming back signed is never knowable", () => {
  it("reports signing as unknown, because no column records it", () => {
    expect(statusOf({ contract_sent_at: "2026-10-01T00:00:00Z" }).contractSigned).toBe("unknown");
  });

  it("forbids the draft from assuming the contract is signed", () => {
    const lines = renderAdminStatus(statusOf({ contract_sent_at: "2026-10-01T00:00:00Z" })).join("\n");
    expect(lines).toMatch(/never say it is signed/i);
  });
});

describe("the stage detector reads the client's words, not just the record", () => {
  const sent = (body: string, fromMe: boolean, daysAgo: number): ThreadMessage => ({
    timestamp: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
    fromMe,
    body,
  });

  it("answers an availability question even on a delivered gallery", () => {
    // The live failure: POST_SESSION matched "edited photos" and the
    // availability question in the same sentence went unanswered.
    const messages = [sent("Here is your gallery", true, 3)];
    expect(detectStage({
      digest: digestOf(messages),
      admin: statusOf({ gallery_delivered_at: "2026-10-01T00:00:00Z" }, messages),
      latestClientMessage: "What do you charge for additional edited photos? Are you available October 3rd?",
      inquiryMessage: "grad photos",
      hasSessionDate: true,
    })).not.toBe("post_session");
  });

  it("still reads a genuine delivery question as post session", () => {
    const messages = [sent("Thanks for shooting with me", true, 3)];
    expect(detectStage({
      digest: digestOf(messages),
      admin: statusOf(null, messages),
      latestClientMessage: "When will my photos be ready? Any link to the gallery?",
      inquiryMessage: "grad photos",
      hasSessionDate: false,
    })).toBe("post_session");
  });

  it("treats paperwork sent with no payment as still scheduling, not confirmed", () => {
    const messages = [sent("I'll send the invoice over", true, 2), sent("October 20th works for me!", false, 1)];
    expect(detectStage({
      digest: digestOf(messages),
      admin: statusOf({ invoice_sent_at: "2026-10-01T00:00:00Z" }, messages),
      latestClientMessage: "October 20th works for me!",
      inquiryMessage: "grad photos",
      hasSessionDate: true,
    })).toBe("scheduling");
  });
});
