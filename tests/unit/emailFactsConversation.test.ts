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
