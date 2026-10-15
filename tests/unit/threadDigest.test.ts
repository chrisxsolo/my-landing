import { describe, it, expect } from "vitest";
import { buildThreadDigest, renderThreadDigest, type ThreadMessage } from "@/lib/ai/threadDigest";

const NOW = new Date("2026-10-14T12:00:00Z");

function msg(body: string, fromMe: boolean, daysAgo = 1): ThreadMessage {
  return { body, fromMe, timestamp: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString() };
}

describe("invoice and contract state", () => {
  it("treats a promise to send as promised, never as sent", () => {
    const digest = buildThreadDigest([
      msg("Once we confirm the date, I'll go ahead and send over the invoice and contract", true),
    ], NOW);
    expect(digest.invoice).toBe("promised");
    expect(digest.contract).toBe("promised");
    expect(renderThreadDigest(digest).join(" ")).toMatch(/Do not say it has been sent/);
  });

  it("treats an explicit send as sent", () => {
    const digest = buildThreadDigest([
      msg("I just sent over the invoice and contract to secure your session!", true),
    ], NOW);
    expect(digest.invoice).toBe("sent");
  });

  it("does not count a client asking about the invoice as evidence it was sent", () => {
    const digest = buildThreadDigest([
      msg("Hey, did you send the invoice yet? I haven't seen it", false),
    ], NOW);
    expect(digest.invoice).toBe("none");
  });

  it("keeps sent once seen, even if an earlier message only promised", () => {
    const digest = buildThreadDigest([
      msg("I'll send the invoice once we lock the date", true, 5),
      msg("Just sent the invoice over!", true, 2),
    ], NOW);
    expect(digest.invoice).toBe("sent");
  });
});

describe("deposit evidence", () => {
  it("stays false with no payment talk", () => {
    const digest = buildThreadDigest([msg("Sounds great, see you Friday", false)], NOW);
    expect(digest.depositPaid).toBe(false);
    expect(renderThreadDigest(digest).join(" ")).toMatch(/Do not treat this booking as confirmed/);
  });

  it("detects the client reporting payment", () => {
    expect(buildThreadDigest([msg("Just paid the deposit!", false)], NOW).depositPaid).toBe(true);
    expect(buildThreadDigest([msg("I venmoed you the retainer", false)], NOW).depositPaid).toBe(true);
  });

  it("detects Chris confirming receipt", () => {
    expect(buildThreadDigest([msg("Your deposit came through, thank you!", true)], NOW).depositPaid).toBe(true);
  });
});

describe("quoted prices", () => {
  it("collects every figure Chris quoted, most recent message first", () => {
    const digest = buildThreadDigest([
      msg("My 30-minute family session is $350", true, 6),
      msg("With the extra outfit at $75 the total comes to $425", true, 2),
    ], NOW);
    // Newest message first; within that message, reading order.
    expect(digest.quotedPrices).toEqual(["$75", "$425", "$350"]);
  });

  it("ignores prices the client names", () => {
    const digest = buildThreadDigest([msg("My budget is around $200", false)], NOW);
    expect(digest.quotedPrices).toEqual([]);
  });
});

describe("dates and questions", () => {
  it("collects dates in reading order", () => {
    const digest = buildThreadDigest([
      msg("Are you free November 26th?", false, 3),
      msg("I'm open November 27th or 11/28", true, 1),
    ], NOW);
    expect(digest.datesDiscussed).toEqual(["November 26th", "November 27th", "11/28"]);
  });

  it("only surfaces questions from the newest client message", () => {
    const digest = buildThreadDigest([
      msg("What are your rates?", false, 9),
      msg("They start at $350", true, 8),
      msg("Do you shoot at sunrise? Can we bring our dog?", false, 1),
    ], NOW);
    expect(digest.openQuestions).toEqual(["Do you shoot at sunrise?", "Can we bring our dog?"]);
  });
});

describe("reply latency", () => {
  it("flags a delay only when the client is the one waiting", () => {
    const waiting = buildThreadDigest([msg("Still interested!", false, 6)], NOW);
    expect(waiting.awaitingChrisReply).toBe(true);
    expect(renderThreadDigest(waiting).join(" ")).toMatch(/waiting 6 days/);

    const chrisLast = buildThreadDigest([msg("Let me know!", true, 6)], NOW);
    expect(chrisLast.awaitingChrisReply).toBe(false);
    expect(renderThreadDigest(chrisLast).join(" ")).not.toMatch(/waiting/);
  });
});

describe("empty thread", () => {
  it("says there is no history rather than inventing any", () => {
    const digest = buildThreadDigest([], NOW);
    expect(digest.messageCount).toBe(0);
    expect(digest.daysSinceLastMessage).toBeNull();
    expect(renderThreadDigest(digest)).toEqual(["No prior email history with this client."]);
  });
});
