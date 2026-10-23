import { describe, expect, it } from "vitest";
import {
  chooseThreads, groupIntoThreads, numberConversation, rankThreadCandidates,
  stripQuotedReply, type ConversationMessage,
} from "@/lib/contentEngine/emailFacts/conversation";

const message = (over: Partial<ConversationMessage> & { gmailMessageId: string }): ConversationMessage => ({
  threadId: "t1",
  at: "2026-10-01T10:00:00.000Z",
  direction: "client",
  subject: "Couples session",
  body: "hello",
  ...over,
});

describe("stripQuotedReply", () => {
  it("keeps only the new text above a quoted reply", () => {
    const body = [
      "Palace of Fine Arts works perfectly!",
      "",
      "On Tue, Oct 5, 2026 at 9:12 AM Dana <dana@example.com> wrote:",
      "> Actually, could we do Palace of Fine Arts instead?",
    ].join("\n");
    expect(stripQuotedReply(body)).toBe("Palace of Fine Arts works perfectly!");
  });

  it("drops a trailing signature", () => {
    const body = "Let's confirm October 25th at 5:30 pm.\n\n--\nDana\nSent from my iPhone";
    expect(stripQuotedReply(body)).toBe("Let's confirm October 25th at 5:30 pm.");
  });

  it("never empties a message that was only a short reply over a quote", () => {
    const body = "> everything quoted\n> more quoting";
    expect(stripQuotedReply(body)).not.toBe("");
  });

  it("leaves an ordinary message untouched", () => {
    expect(stripQuotedReply("We're thinking about Baker Beach.")).toBe("We're thinking about Baker Beach.");
  });
});

describe("numberConversation", () => {
  it("orders oldest first and numbers from one", () => {
    const numbered = numberConversation([
      message({ gmailMessageId: "b", at: "2026-10-05T10:00:00.000Z", body: "second" }),
      message({ gmailMessageId: "a", at: "2026-10-01T10:00:00.000Z", body: "first" }),
    ]);
    expect(numbered.map((m) => [m.index, m.body])).toEqual([[1, "first"], [2, "second"]]);
  });

  it("keeps one entry per Gmail message id", () => {
    const numbered = numberConversation([
      message({ gmailMessageId: "a" }),
      message({ gmailMessageId: "a" }),
    ]);
    expect(numbered).toHaveLength(1);
  });

  it("drops a repeated identical send but keeps distinct text", () => {
    const numbered = numberConversation([
      message({ gmailMessageId: "a", at: "2026-10-01T10:00:00.000Z", body: "same" }),
      message({ gmailMessageId: "b", at: "2026-10-01T10:01:00.000Z", body: "same" }),
      message({ gmailMessageId: "c", at: "2026-10-01T10:02:00.000Z", body: "different" }),
    ]);
    expect(numbered.map((m) => m.body)).toEqual(["same", "different"]);
  });

  it("skips messages with no text", () => {
    expect(numberConversation([message({ gmailMessageId: "a", body: "   " })])).toHaveLength(0);
  });
});

describe("thread selection", () => {
  // Scenario F: one client, a May graduation and a September couples session.
  const gradThread = groupIntoThreads([
    message({
      gmailMessageId: "g1", threadId: "grad", subject: "Graduation photos",
      at: "2026-04-01T10:00:00.000Z",
      body: "I graduate in May and want cap and gown photos at UC Berkeley.",
    }),
  ])[0];
  const couplesThread = groupIntoThreads([
    message({
      gmailMessageId: "c1", threadId: "couples", subject: "Couples shoot",
      at: "2026-09-01T10:00:00.000Z",
      body: "My partner and I want a couples session at Palace of Fine Arts on September 28.",
    }),
  ])[0];

  it("ranks the thread that matches the booking's own facts first", () => {
    const ranked = rankThreadCandidates([gradThread, couplesThread], {
      serviceType: "couples",
      sessionDate: "2026-09-28",
      primaryLocation: "Palace of Fine Arts",
    });
    expect(ranked[0].candidate.threadId).toBe("couples");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("picks the clearly matching thread for a couples booking", () => {
    const choice = chooseThreads([gradThread, couplesThread], {
      serviceType: "couples", sessionDate: "2026-09-28", primaryLocation: "Palace of Fine Arts",
    });
    expect(choice.outcome).toBe("chosen");
    if (choice.outcome === "chosen") {
      expect(choice.threads.map((t) => t.threadId)).toEqual(["couples"]);
    }
  });

  it("asks rather than guesses when two threads are equally plausible", () => {
    const choice = chooseThreads([gradThread, couplesThread], { serviceType: "other" });
    expect(choice.outcome).toBe("ambiguous");
    if (choice.outcome === "ambiguous") expect(choice.candidates).toHaveLength(2);
  });

  it("uses a single conversation without asking", () => {
    const choice = chooseThreads([couplesThread], {});
    expect(choice.outcome).toBe("chosen");
  });

  // Regression (2026-10-23, found on a live session): the photographer's own
  // "Payment Confirmed" email quotes the service type and the session date, so
  // it outscored the nine-message thread that actually settled them, and the
  // extraction ran over a receipt.
  const bookingThread = groupIntoThreads([
    message({
      gmailMessageId: "b1", threadId: "booking", subject: "Re: Your Couples Session inquiry",
      at: "2026-07-28T10:00:00.000Z", direction: "photographer",
      body: "Thanks for reaching out! Which dates are you thinking?",
    }),
    message({
      gmailMessageId: "b2", threadId: "booking", subject: "Re: Your Couples Session inquiry",
      at: "2026-07-28T12:00:00.000Z", direction: "client",
      body: "We were hoping for late September — maybe the 28th, around sunset?",
    }),
    message({
      gmailMessageId: "b3", threadId: "booking", subject: "Re: Your Couples Session inquiry",
      at: "2026-07-29T10:00:00.000Z", direction: "photographer",
      body: "September 28 at 6:00pm works. Let's meet at Crissy Field.",
    }),
  ])[0];
  const receiptThread = groupIntoThreads([
    message({
      gmailMessageId: "r1", threadId: "receipt", subject: "Payment Confirmed",
      at: "2026-07-30T10:00:00.000Z", direction: "photographer",
      body: "Your Couples Session is confirmed. Session date: September 28, 2026. Deposit received.",
    }),
  ])[0];

  it("ranks the real back-and-forth above the photographer's own receipt", () => {
    const ranked = rankThreadCandidates([receiptThread, bookingThread], {
      serviceType: "couples", sessionDate: "2026-09-28",
    });
    expect(ranked[0].candidate.threadId).toBe("booking");
  });

  it("chooses the conversation, not the receipt", () => {
    const choice = chooseThreads([receiptThread, bookingThread], {
      serviceType: "couples", sessionDate: "2026-09-28",
    });
    expect(choice.outcome).toBe("chosen");
    if (choice.outcome === "chosen") expect(choice.threads[0].threadId).toBe("booking");
  });

  it("ignores a primary location that is really a date", () => {
    // The live row held "September 28" in primary_location, which matched the
    // receipt's printed date and pushed it over the booking thread.
    const ranked = rankThreadCandidates([receiptThread, bookingThread], {
      serviceType: "couples", sessionDate: "2026-09-28", primaryLocation: "September 28",
    });
    expect(ranked[0].candidate.threadId).toBe("booking");
  });

  it("still lets a real location vouch for a thread", () => {
    const ranked = rankThreadCandidates([receiptThread, bookingThread], {
      serviceType: "couples", primaryLocation: "Crissy Field",
    });
    expect(ranked[0].candidate.threadId).toBe("booking");
  });

  it("never settles on a thread the client never wrote in", () => {
    // Only transactional mail found: asking beats extracting from a receipt.
    const otherReceipt = groupIntoThreads([
      message({
        gmailMessageId: "r2", threadId: "invoice", subject: "Invoice from SoloXSnaps",
        at: "2026-07-29T10:00:00.000Z", direction: "photographer",
        body: "Your couples session invoice for September 28 is attached.",
      }),
    ])[0];
    const choice = chooseThreads([receiptThread, otherReceipt], {
      serviceType: "couples", sessionDate: "2026-09-28",
    });
    expect(choice.outcome).toBe("ambiguous");
  });

  it("sets receipts aside entirely once a real conversation exists", () => {
    // The receipt matches the service and the date just as well as the thread
    // that settled them, so it must be out of the running, not merely behind.
    const choice = chooseThreads([receiptThread, bookingThread], {
      serviceType: "couples", sessionDate: "2026-09-28",
    });
    expect(choice.outcome).toBe("chosen");
    if (choice.outcome === "chosen") expect(choice.threads).toHaveLength(1);
  });

  it("does not let a longer thread stand in for a different booking", () => {
    // Two couples conversations, nothing known that tells them apart: length
    // alone must not decide which photoshoot's details get pulled in.
    const shortOther = groupIntoThreads([
      message({
        gmailMessageId: "o1", threadId: "anniversary", subject: "Anniversary couples photos",
        at: "2026-03-02T10:00:00.000Z", direction: "client",
        body: "We'd love couples photos for our anniversary at Lands End.",
      }),
    ])[0];
    const choice = chooseThreads([bookingThread, shortOther], { serviceType: "couples" });
    expect(choice.outcome).toBe("ambiguous");
  });

  it("prefers an explicitly linked thread over any ranking", () => {
    const choice = chooseThreads([gradThread, couplesThread], { serviceType: "couples" }, ["grad"]);
    expect(choice.outcome).toBe("chosen");
    if (choice.outcome === "chosen") expect(choice.threads[0].threadId).toBe("grad");
  });
});

describe("groupIntoThreads", () => {
  it("groups by thread id, most recent activity first", () => {
    const threads = groupIntoThreads([
      message({ gmailMessageId: "a", threadId: "old", at: "2026-01-01T00:00:00.000Z" }),
      message({ gmailMessageId: "b", threadId: "new", at: "2026-09-01T00:00:00.000Z" }),
      message({ gmailMessageId: "c", threadId: "new", at: "2026-09-02T00:00:00.000Z", body: "later" }),
    ]);
    expect(threads.map((t) => t.threadId)).toEqual(["new", "old"]);
    expect(threads[0].messages).toHaveLength(2);
    expect(threads[0].lastMessageId).toBe("c");
  });
});
