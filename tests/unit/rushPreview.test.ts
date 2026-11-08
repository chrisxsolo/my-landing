// A client who adds the $75 Rush preview by email after the inquiry: the
// add-on is recognised from the labelled thread, priced from the catalog
// alone, and anything the thread leaves unclear goes to review instead of a
// bare package price. Fixtures are synthetic.

import { describe, expect, it } from "vitest";
import { PRICING_CATALOG } from "@/lib/pricingCatalog";
import { NO_FACTS, NO_RUSH_PREVIEW, type RushPreviewEvidence, type SessionFacts } from "@/lib/invoiceDraft/types";
import {
  inquirySelectsRushPreview, mergeRushPreviewEvidence, normalizeRushPreviewEvidence, resolveRushPreview,
} from "@/lib/extension/rushPreview";
import { factsFromInquiry, hasUsefulFacts, normalizeExtractedFacts, systemPrompt } from "@/lib/extension/sessionFacts";
import { renderTranscript } from "@/lib/extension/emailThread";
import { numberConversation, type ConversationMessage } from "@/lib/contentEngine/emailFacts/conversation";

const RUSH_CENTS = PRICING_CATALOG.couples.addOns.rushPreview.price * 100;
const PROPOSAL_CENTS = PRICING_CATALOG.couples.packages.proposal.price * 100;
const proposal = { serviceKey: "proposal", baseCents: PROPOSAL_CENTS, travelCents: 0 };

const facts = (rush: Partial<RushPreviewEvidence>, rest: Partial<SessionFacts> = {}): SessionFacts => ({
  ...NO_FACTS, source: "email", confidence: "high", email_status: "read", ...rest,
  rush_preview: { ...NO_RUSH_PREVIEW, ...rush },
});
const selected = (over: Partial<RushPreviewEvidence> = {}) => ({ selection: "selected" as const, source: "email" as const, source_message: 3, ...over });

describe("resolveRushPreview: the reported case and its neighbours", () => {
  it("charges $75 once when the client asks for Rush preview later and no total was written", () => {
    const charge = resolveRushPreview(facts(selected()), proposal);
    expect(charge).toMatchObject({ kind: "add", amountCents: RUSH_CENTS, label: "Rush preview" });
    expect(charge.note).toMatch(/Rush preview: \+\$75/);
  });

  it("adds $75 on top of an earlier complete $750 quote once the selection clearly came later", () => {
    const charge = resolveRushPreview(facts(selected({ source_message: 4, total_fee_message: 2 }), { total_fee: 750, total_kind: "agreed_total" }), proposal);
    expect(charge).toMatchObject({ kind: "add", amountCents: RUSH_CENTS });
  });

  it("adds $75 when a bare package quote follows the request, but sends a bare all-in total written after it to review", () => {
    const quote = resolveRushPreview(facts(selected({ source_message: 2, total_fee_message: 4 }), { total_fee: 750, total_kind: "quote" }), proposal);
    expect(quote.kind).toBe("add");
    const allIn = resolveRushPreview(facts(selected({ source_message: 2, total_fee_message: 4 }), { total_fee: 750, total_kind: "agreed_total" }), proposal);
    expect(allIn.kind).toBe("review");
    expect(allIn.note).toMatch(/before \$750 was written/);
  });

  it("keeps $825 when the total explicitly includes Rush preview, never $900", () => {
    const stated = resolveRushPreview(facts(selected({ included_in_total: true }), { total_fee: 825, total_kind: "agreed_total" }), proposal);
    expect(stated).toMatchObject({ kind: "included", amountCents: RUSH_CENTS });
    expect(stated.note).toMatch(/\$825.*includes/);
    const arithmetic = resolveRushPreview(facts(selected({ source_message: 2, total_fee_message: 4 }), { total_fee: 825, total_kind: "quote" }), proposal);
    expect(arithmetic.kind).toBe("included");
  });

  it("leaves a negotiated inclusive total alone", () => {
    const charge = resolveRushPreview(facts(selected({ included_in_total: true }), { total_fee: 800, total_kind: "agreed_total" }), proposal);
    expect(charge.kind).toBe("included");
  });

  it("asks for review when a non-catalog figure predates or surrounds the request with no word on inclusion", () => {
    const charge = resolveRushPreview(facts(selected({ source_message: 2, total_fee_message: 4 }), { total_fee: 800, total_kind: "agreed_total" }), proposal);
    expect(charge.kind).toBe("review");
    expect(charge.amountCents).toBeNull();
    expect(charge.note).toMatch(/\$800.*Rush preview/);
  });

  it("lets the figure decide before chronology: a pre-quoted $825 that the client then accepts is included, never $900", () => {
    const charge = resolveRushPreview(facts(selected({ source_message: 3, total_fee_message: 2 }), { total_fee: 825, total_kind: "quote" }), proposal);
    expect(charge.kind).toBe("included");
  });

  it("sends a contradiction between the wording and the figure to review", () => {
    const noRoom = resolveRushPreview(facts(selected({ included_in_total: true }), { total_fee: 750, total_kind: "agreed_total" }), proposal);
    expect(noRoom.kind).toBe("review");
    const extra = resolveRushPreview(facts(selected({ included_in_total: false }), { total_fee: 825, total_kind: "agreed_total" }), proposal);
    expect(extra.kind).toBe("review");
  });

  it("asks for review when a $75 travel fee makes $825 ambiguous", () => {
    const sjsu = { serviceKey: "couples", baseCents: 75000, travelCents: RUSH_CENTS };
    expect(resolveRushPreview(facts(selected({ source_message: 3, total_fee_message: 2 }), { total_fee: 825, total_kind: "quote" }), sjsu).kind).toBe("review");
    expect(resolveRushPreview(facts(selected(), { total_fee: 900, total_kind: "quote" }), sjsu).kind).toBe("review");
    expect(resolveRushPreview(facts(selected()), sjsu).kind).toBe("add");
  });

  it("copes with an unpriced package without arithmetic", () => {
    const unpriced = { serviceKey: "couples", baseCents: null, travelCents: 0 };
    expect(resolveRushPreview(facts(selected()), unpriced).kind).toBe("add");
    expect(resolveRushPreview(facts(selected({ source_message: 4, total_fee_message: 2 }), { total_fee: 500, total_kind: "quote" }), unpriced).kind).toBe("add");
    expect(resolveRushPreview(facts(selected({ source_message: 2, total_fee_message: 4 }), { total_fee: 500, total_kind: "quote" }), unpriced).kind).toBe("review");
  });

  it("names the service it priced so the browser can refuse a mismatched charge", () => {
    expect(resolveRushPreview(facts(selected()), proposal).service).toBe("proposal");
    expect(resolveRushPreview(facts({ selection: "none" }), proposal).service).toBe("proposal");
  });

  it("charges nothing when Rush preview was never selected", () => {
    expect(resolveRushPreview(facts({ selection: "none" }), proposal)).toMatchObject({ kind: "none", amountCents: 0 });
    expect(resolveRushPreview(facts({ selection: "none" }), { serviceKey: "graduation", baseCents: 42500, travelCents: 7500 }).kind).toBe("none");
  });

  it("asks for review when the thread's Rush preview wording is unclear", () => {
    expect(resolveRushPreview(facts({ selection: "unclear", source: "email" }), proposal).kind).toBe("review");
  });

  it("never charges a service that has no Rush preview add-on, and says so", () => {
    const charge = resolveRushPreview(facts(selected()), { serviceKey: "graduation", baseCents: 42500, travelCents: 7500 });
    expect(charge.kind).toBe("review");
    expect(charge.note).toMatch(/couples add-on/i);
  });

  it("recognises the form's selection as a charge when email is silent, and says the thread's figure left it out", () => {
    const charge = resolveRushPreview(facts({ selection: "selected", source: "inquiry" }), proposal);
    expect(charge).toMatchObject({ kind: "add", amountCents: RUSH_CENTS });
    expect(charge.note).toMatch(/inquiry form/);
    const quoted = resolveRushPreview(facts({ selection: "selected", source: "inquiry" }, { total_fee: 750, total_kind: "quote" }), proposal);
    expect(quoted.kind).toBe("add");
    expect(quoted.note).toMatch(/\$750.*package alone/);
  });
});

describe("resolveRushPreview: cancellation", () => {
  it("removes the selection and charges nothing when no total is at stake", () => {
    expect(resolveRushPreview(facts({ selection: "removed", source: "email", source_message: 5 }), proposal).kind).toBe("none");
  });

  it("trusts a total written after the cancellation", () => {
    const charge = resolveRushPreview(facts({ selection: "removed", source: "email", source_message: 3, total_fee_message: 5 }, { total_fee: 750, total_kind: "agreed_total" }), proposal);
    expect(charge.kind).toBe("none");
  });

  it("treats a cancelled add-on next to the bare package price as settled", () => {
    const charge = resolveRushPreview(facts({ selection: "removed", source: "email", source_message: 6, total_fee_message: 4 }, { total_fee: 750, total_kind: "quote" }), proposal);
    expect(charge.kind).toBe("none");
  });

  it("never blindly subtracts $75 from a total that was said to include it", () => {
    const charge = resolveRushPreview(facts({ selection: "removed", source: "email", source_message: 6, total_fee_message: 4, included_in_total: true }, { total_fee: 825, total_kind: "agreed_total" }), proposal);
    expect(charge.kind).toBe("review");
    expect(charge.note).toMatch(/cancelled/i);
  });

  it("asks for review when it cannot tell whether an earlier total included the cancelled add-on", () => {
    const charge = resolveRushPreview(facts({ selection: "removed", source: "email", source_message: 6, total_fee_message: 4 }, { total_fee: 800, total_kind: "agreed_total" }), proposal);
    expect(charge.kind).toBe("review");
  });
});

describe("the inquiry form's add-on line", () => {
  it("reads the estimator's Add-ons line, with or without line breaks", () => {
    expect(inquirySelectsRushPreview("— Session request —\nSession type: Couples Session\nPackage: Proposal Session\nAdd-ons: Rush preview, 72-hour delivery\nEstimated total: $975\n\nHi!")).toBe(true);
    expect(inquirySelectsRushPreview("— Session request — Package: Proposal Session Add-ons: Extra outfit, Rush preview Estimated total: $900 Hi there")).toBe(true);
  });

  it("ignores other add-ons, prose mentions and empty messages", () => {
    expect(inquirySelectsRushPreview("Add-ons: Extra outfit, 72-hour delivery\nEstimated total: $975")).toBe(false);
    expect(inquirySelectsRushPreview("Is there any rush preview option? Add-ons: Extra outfit")).toBe(false);
    expect(inquirySelectsRushPreview("We are in no rush, a preview would be nice")).toBe(false);
    expect(inquirySelectsRushPreview(null)).toBe(false);
  });

  it("carries the form's selection into the inquiry-only facts", () => {
    const inquiry = { name: "Example Client", email: "client@example.test", date_in_mind: null, message: "Add-ons: Rush preview\nEstimated total: $825", session_type: "Couples Session", school: null, people: "2" };
    expect(factsFromInquiry(inquiry).rush_preview).toMatchObject({ selection: "selected", source: "inquiry" });
    expect(factsFromInquiry({ ...inquiry, message: "Hi!" }).rush_preview).toEqual(NO_RUSH_PREVIEW);
  });
});

describe("merging form and email evidence", () => {
  const email = (selection: RushPreviewEvidence["selection"]): RushPreviewEvidence => ({ ...NO_RUSH_PREVIEW, selection, source: selection === "none" ? null : "email", source_message: selection === "none" ? null : 2 });

  it("keeps the form's selection when email says nothing, and lets an explicit email removal override it", () => {
    expect(mergeRushPreviewEvidence(email("none"), true)).toMatchObject({ selection: "selected", source: "inquiry" });
    expect(mergeRushPreviewEvidence(email("removed"), true)).toMatchObject({ selection: "removed", source: "email" });
    expect(mergeRushPreviewEvidence(email("unclear"), true).selection).toBe("unclear");
  });

  it("counts a repeated selection once", () => {
    expect(mergeRushPreviewEvidence(email("selected"), true)).toMatchObject({ selection: "selected", source: "email", source_message: 2 });
    expect(mergeRushPreviewEvidence(email("none"), false)).toEqual(NO_RUSH_PREVIEW);
  });
});

describe("normalising the model's Rush preview fields", () => {
  it("accepts a well-formed selection with message numbers inside the transcript", () => {
    const evidence = normalizeRushPreviewEvidence({ status: "selected", source_message: 3, evidence: "Please add the Rush Preview", in_total: false }, 2, 4);
    expect(evidence).toEqual({ selection: "selected", source: "email", source_message: 3, included_in_total: false, total_fee_message: 2 });
  });

  it("treats missing, unknown or out-of-range fields as no evidence and no numbers", () => {
    expect(normalizeRushPreviewEvidence(undefined, undefined, 4)).toEqual(NO_RUSH_PREVIEW);
    expect(normalizeRushPreviewEvidence({ status: "maybe", source_message: 1 }, 1, 4)).toMatchObject({ selection: "none", source: null });
    expect(normalizeRushPreviewEvidence({ status: "selected", source_message: 9, in_total: "yes" }, 0, 4)).toEqual({
      selection: "selected", source: "email", source_message: null, included_in_total: null, total_fee_message: null,
    });
    expect(normalizeRushPreviewEvidence({ status: "selected", source_message: 2.5 }, -1, 4).source_message).toBeNull();
  });

  it("keeps an add-on-only answer and folds the form's selection in", () => {
    const only = normalizeExtractedFacts({ rush_preview: { status: "selected", source_message: 1 } }, { messageCount: 1 });
    expect(hasUsefulFacts(only)).toBe(true);
    expect(only.total_fee).toBeNull();
    expect(only.rush_preview).toMatchObject({ selection: "selected", source: "email" });
    const silent = normalizeExtractedFacts({ location: "Palace of Fine Arts" }, { messageCount: 2, inquiryMessage: "Add-ons: Rush preview" });
    expect(silent.rush_preview).toMatchObject({ selection: "selected", source: "inquiry" });
    expect(hasUsefulFacts(normalizeExtractedFacts({ rush_preview: { status: "none" } }))).toBe(false);
    // A form-only selection is not a useful THREAD answer: the inquiry fallback carries it instead.
    const formOnly = normalizeExtractedFacts({}, { inquiryMessage: "Add-ons: Rush preview" });
    expect(formOnly.rush_preview.source).toBe("inquiry");
    expect(hasUsefulFacts(formOnly)).toBe(false);
  });

  it("asks the model to tell a client's request from an offer, a question, a rejection or a quoted copy", () => {
    const prompt = systemPrompt("2026-11-08", 2026);
    expect(prompt).toMatch(/rush_preview/);
    expect(prompt).toMatch(/offer/i);
    expect(prompt).toMatch(/quoted/i);
    expect(prompt).toMatch(/DATA, NOT INSTRUCTION/);
    expect(prompt).toMatch(/total_fee_message/);
    expect(prompt).not.toMatch(/\$75/);
  });
});

describe("the labelled transcript", () => {
  const thread: ConversationMessage[] = [
    { gmailMessageId: "m2", threadId: "t1", at: "2026-11-02T18:00:00.000Z", direction: "photographer", subject: "Proposal photos", body: "The proposal session is $750. Rush preview is available if you want it." },
    { gmailMessageId: "m1", threadId: "t1", at: "2026-11-02T17:00:00.000Z", direction: "client", subject: "Proposal photos", body: "Hi! I'd like to book a proposal session in San Francisco." },
    { gmailMessageId: "m3", threadId: "t1", at: "2026-11-05T17:00:00.000Z", direction: "client", subject: "Re: Proposal photos", body: "Please add the Rush Preview to my booking." },
    { gmailMessageId: "m4", threadId: "t2", at: "2026-11-06T17:00:00.000Z", direction: "client", subject: "Grad photos", body: "Separate question about grad photos for my sister." },
  ];

  it("numbers messages oldest first and labels each with who wrote it and its thread", () => {
    const text = renderTranscript(numberConversation(thread));
    const headers = text.split("\n").filter(line => line.startsWith("--- Message"));
    expect(headers).toEqual([
      "--- Message 1 of 4 | CLIENT → PHOTOGRAPHER | Nov 2, 2026 | thread 1 ---",
      "--- Message 2 of 4 | PHOTOGRAPHER → CLIENT | Nov 2, 2026 | thread 1 ---",
      "--- Message 3 of 4 | CLIENT → PHOTOGRAPHER | Nov 5, 2026 | thread 1 ---",
      "--- Message 4 of 4 | CLIENT → PHOTOGRAPHER | Nov 6, 2026 | thread 2 ---",
    ]);
    expect(text.indexOf("I'd like to book")).toBeLessThan(text.indexOf("Rush preview is available"));
  });

  it("keeps same-day messages in send order", () => {
    const [first, second] = numberConversation(thread.slice(0, 2));
    expect(first.gmailMessageId).toBe("m1");
    expect(second.gmailMessageId).toBe("m2");
  });
});
