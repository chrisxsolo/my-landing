// ─────────────────────────────────────────────────────────────────────────────
// The fifteen scenarios behind "I would not send this".
//
// Every case here comes from a draft Chris rejected, or from a rule he stated
// after rejecting one. The two named failures are inquiry #131 (Catherine, a
// family session where the draft claimed an invoice had been sent that had
// not) and inquiry #129 (Danel, a graduation inquiry that passed validation
// and still sounded nothing like him).
//
// All of it runs against the fake model caller, so the suite costs nothing and
// guards every fix on each commit. Where a case is genuinely about prose the
// model produces, it is tested two ways: the prompt must carry the
// instruction, and the validator must flag the bad output.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { buildEmailContext } from "@/lib/ai/buildEmailContext";
import { buildSystemPrompt, buildGenerateUserPrompt } from "@/lib/ai/emailPrompt";
import { validateEmailDraft } from "@/lib/ai/validateEmailDraft";
import { detectStage } from "@/lib/ai/conversationStage";
import { buildAdminStatus } from "@/lib/ai/adminStatus";
import { buildThreadDigest } from "@/lib/ai/threadDigest";
import { resolvePlaybookKey } from "@/lib/ai/sessionClassifier";
import { naturalizeDraft, shortenDraft } from "@/lib/ai/emailOperations";
import { AVAILABILITY, NOW, inquiry, message, fakeCaller } from "./fixtures";
import type { InquiryAdminRow } from "@/lib/ai/adminStatus";
import type { ThreadMessage } from "@/lib/ai/threadDigest";

type Ctx = Parameters<typeof validateEmailDraft>[1];

function ctx(opts: {
  inquiry?: Parameters<typeof inquiry>[0];
  messages?: ThreadMessage[];
  adminRow?: InquiryAdminRow | null;
  latest?: string | null;
} = {}): Ctx {
  return buildEmailContext({
    inquiry: inquiry(opts.inquiry),
    messages: opts.messages ?? [],
    availability: AVAILABILITY,
    threadLoaded: true,
    adminRow: opts.adminRow,
    latestClientMessage: opts.latest ?? null,
    now: NOW,
  });
}

function prompt(context: Ctx, latest: string | null = null): string {
  const system = buildSystemPrompt(context, []);
  return [
    system.stable,
    system.volatile,
    buildGenerateUserPrompt({ context, latestClientMessage: latest, threadText: null }),
  ].join("\n");
}

const types = (context: Ctx, draft: string) =>
  validateEmailDraft(draft, context).issues.map((i) => i.type);

// ─────────────────────────────────────────────────────────────────────────────
describe("1. Catherine, inquiry #131: family session confirmation", () => {
  // Her thread: he offered Friday 5:45 pm, she accepted and offered a parking
  // pin. The record has invoice_sent_at NULL.
  const thread = [
    message("Thank you so much for reaching out! I'm available this Friday, October 16th, at 5:45 pm", true, 2),
    message("Awesome!! Yes, 5:45 would be great! I will send you the location of the public parking lot at Rockaway Beach where we can meet", false, 1),
  ];
  const UNSENT: InquiryAdminRow = {
    invoice_sent_at: null, contract_sent_at: null, deposit_paid_at: null,
    booking_confirmed: false, payment_status: "unpaid", session_date: "2026-10-16",
  };
  const base = {
    inquiry: { sessionType: "Family Session", message: "Our family is in town in Pacifica for a family funeral. We have 8 adults, 3 children and 1 baby. We were thinking at Rockaway Beach in Pacifica", location: null as string | null },
    messages: thread,
    adminRow: UNSENT,
    latest: "Awesome!! Yes, 5:45 would be great! I will send you the location of the public parking lot at Rockaway Beach where we can meet",
  };

  it("is not treated as a first reply", () => {
    const context = ctx(base);
    expect(context.conversation.stage).not.toBe("initial_inquiry");
    expect(prompt(context)).toMatch(/This is NOT a first reply/);
  });

  it("forbids claiming the invoice was sent", () => {
    expect(prompt(ctx(base))).toMatch(/No invoice has been sent/);
  });

  it("flags the claim the real draft made", () => {
    const draft = "Hi Catherine,\n\nI sent the invoice and contract to your email to secure your session";
    expect(types(ctx(base), draft)).toContain("fabricated_booking_state");
  });

  it("flags the lighting description the real draft made", () => {
    const draft = "Hi Catherine,\n\nSo glad 5:45 pm works! Friday, October 16th should be a beautiful evening for it, and the light at Rockaway Beach is going to be lovely";
    const found = types(ctx(base), draft);
    expect(found).toContain("scenery_description");
  });

  it("flags a phone number offered but not given", () => {
    const draft = "Hi Catherine,\n\nIf you need to reach me, here's my number\n\nTalk soon!";
    expect(types(ctx(base), draft)).toContain("dangling_reference");
  });

  it("accepts the number when it is actually there", () => {
    const draft = "Hi Catherine,\n\nYou can text me at 408-722-7680 if you need anything before the session";
    expect(types(ctx(base), draft)).not.toContain("dangling_reference");
  });

  it("gives the model the phone number so it never has to dangle one", () => {
    expect(prompt(ctx(base))).toContain("408-722-7680");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("2. Danel, inquiry #129: graduation inquiry", () => {
  const base = {
    inquiry: {
      sessionType: "Graduation Portrait",
      message: "Since it is in the city, do you have recommendations of the time for the best lighting? I am pretty flexible on time. Also was thinking to opt into a champagne pop!",
      school: "Samuel Merritt University in Oakland",
      location: "In front of the main campus building and possible inside on the stair steps",
      dateInMind: "October 16, 2026",
      people: "1",
    },
  };

  it("quotes graduation as a package, never an hourly rate", () => {
    const text = prompt(ctx(base));
    expect(text).toMatch(/START AT \$350/);
    expect(text).toMatch(/Do NOT say "\$350 per hour"/);
  });

  it("flags the hourly phrasing the real draft used", () => {
    const draft = "Hi Danel,\n\nMy graduation session is $350 per hour";
    expect(types(ctx(base), draft)).toContain("hourly_pricing");
  });

  it("accepts the package phrasing", () => {
    const draft = "Hi Danel,\n\nMy graduation sessions start at $350, and the champagne add-on is $15";
    const found = types(ctx(base), draft);
    expect(found).not.toContain("hourly_pricing");
    expect(found).not.toContain("unsupported_price");
  });

  it("flags the staircase description the real draft added", () => {
    const draft = "Hi Danel,\n\nStarting around 5:30 pm would give you that soft golden light. It'll look great on the building and the stair steps";
    expect(types(ctx(base), draft)).toContain("scenery_description");
  });

  it("tells the model not to predict how the photos will look", () => {
    expect(prompt(ctx(base))).toMatch(/Never predict how the photos will look/);
  });

  it("does not force a travel-fee paragraph when travel is not the subject", () => {
    // Oakland has no entry in the card, so the fee is unknown. The old wording
    // ordered the draft to explain that; now it is conditional on price.
    const text = prompt(ctx(base));
    expect(text).toMatch(/Mention travel ONLY if you are quoting a price/);
    expect(text).not.toMatch(/Say the travel fee depends on the exact location and that you'll confirm it/);
  });

  it("still refuses to invent an Oakland travel fee", () => {
    expect(prompt(ctx(base))).toMatch(/Never state a travel-fee amount/);
    const draft = "Hi Danel,\n\nMy graduation sessions start at $350, plus a $40 travel fee for Oakland";
    expect(types(ctx(base), draft)).toContain("unsupported_price");
  });

  it("asks for one closing, not two", () => {
    expect(prompt(ctx(base))).toMatch(/One closing, not two/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("3. initial graduation inquiry with no university", () => {
  it("is told to ask which university", () => {
    const context = ctx({ inquiry: { sessionType: "Graduation Portrait", message: "I'd love grad photos in the city somewhere", school: null } });
    expect(context.conversation.stage).toBe("initial_inquiry");
    expect(prompt(context)).toMatch(/Ask which university/);
  });
});

describe("4. graduation follow-up where the university is known", () => {
  it("does not ask again, and is not shaped like a first reply", () => {
    const context = ctx({
      inquiry: { sessionType: "Graduation Portrait", school: "San Jose State University", message: "SJSU, thinking late May" },
      messages: [
        message("Which university are you graduating from?", true, 3),
        message("San Jose State. Does the 20th work?", false, 1),
      ],
      latest: "San Jose State. Does the 20th work?",
    });
    expect(context.conversation.stage).not.toBe("initial_inquiry");
    const text = prompt(context, "San Jose State. Does the 20th work?");
    expect(text).toContain("School: San Jose State University");
    expect(text).toMatch(/This is NOT a first reply/);
  });

  it("flags a draft that opens as though nothing had been said", () => {
    const context = ctx({
      inquiry: { sessionType: "Graduation Portrait", school: "San Jose State University", message: "SJSU" },
      messages: [
        message("Which university are you graduating from?", true, 3),
        message("San Jose State. Does the 20th work?", false, 1),
      ],
      latest: "San Jose State. Does the 20th work?",
    });
    const draft = "Hi Sarah,\n\nThank you so much for reaching out! I'd love to take your graduation photos!";
    expect(types(context, draft)).toContain("stale_greeting");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("5. session confirmation once a date is accepted", () => {
  it("asks for a short confirmation, not a fresh pitch", () => {
    const context = ctx({
      messages: [
        message("I'm available October 26th, 28th, or 30th. My graduation sessions start at $350", true, 2),
        message("October 26th works for me!", false, 1),
      ],
      latest: "October 26th works for me!",
      adminRow: { invoice_sent_at: null, session_date: "2026-10-26" },
    });
    expect(context.conversation.stage).toBe("scheduling");
    const text = prompt(context, "October 26th works for me!");
    expect(text).toMatch(/35 to 80 words/);
    expect(text).toMatch(/do not restate them unless they ask about price again/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("6. invoice status unknown", () => {
  it("claims nothing when no record was loaded", () => {
    const context = ctx({ adminRow: null });
    expect(context.admin.verified).toBe(false);
    expect(prompt(context)).toMatch(/Do not claim that any invoice, contract, payment, or gallery has been sent/);
  });

  it("flags a draft that claims it anyway", () => {
    const context = ctx({ adminRow: null });
    const draft = "Hi Sarah,\n\nI just sent over the invoice and contract";
    expect(types(context, draft)).toContain("fabricated_booking_state");
  });
});

describe("7. invoice verified as sent", () => {
  const sent: InquiryAdminRow = {
    invoice_sent_at: "2026-10-13T10:00:00Z",
    contract_sent_at: "2026-10-13T10:00:00Z",
    deposit_paid_at: null, booking_confirmed: false, session_date: "2026-10-26",
  };

  it("says so, and forbids promising it for later", () => {
    const text = prompt(ctx({ adminRow: sent }));
    expect(text).toMatch(/The invoice HAS been sent\. Do not say you will send it later/);
  });

  it("lets the draft acknowledge it", () => {
    const context = ctx({ adminRow: sent });
    const draft = "Hi Sarah,\n\nI just sent over the invoice and contract for October 26th";
    expect(types(context, draft)).not.toContain("fabricated_booking_state");
  });

  it("still refuses to call an unpaid session confirmed", () => {
    const context = ctx({ adminRow: sent });
    const draft = "Hi Sarah,\n\nYour session is confirmed and you're all set!";
    expect(types(context, draft)).toContain("fabricated_payment");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("8. surprise proposal filed as a couples session", () => {
  it("classifies and prices it as a proposal", () => {
    const message_ = "Surprise proposal during a photo session, she thinks it's only a photo session";
    expect(resolvePlaybookKey("Couples Session", message_)).toBe("proposal");
    const context = ctx({ inquiry: { sessionType: "Couples Session", message: message_ } });
    expect(context.pricing.basePrices).toEqual([750]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("9. More Natural names the faults instead of pointing at the corpus", () => {
  const GENERIC = `Hi Danel,

Thank you so much for reaching out! I'd love to shoot your graduation, and congratulations!

The champagne setup is a fun add-on, and it's $15. It'll look great on the building and the stair steps

Let me know which of those dates works for you!

Once we lock in the date, time, and location, I'll send over the invoice and contract to secure your session`;

  it("instructs removal of the specific faults, not just contractions", async () => {
    const call = fakeCaller("Hi Danel,\n\nThe champagne add-on is $15");
    await naturalizeDraft({
      inquiry: inquiry({ sessionType: "Graduation Portrait" }),
      messages: [], availability: AVAILABILITY, threadLoaded: true,
      currentDraft: GENERIC, rules: [], now: NOW,
    }, call);

    const asked = call.calls[0].userPrompt;
    expect(asked).toMatch(/describe how the photos, light, or location will look/);
    expect(asked).toMatch(/Descriptions of a place the CLIENT chose/);
    expect(asked).toMatch(/Two closings doing the same work/);
    expect(asked).toMatch(/Phrasings Chris has rejected/);
    // And it must not aim the model back at the examples for its rhythm.
    expect(asked).not.toMatch(/match the rhythm, warmth, and sentence length of the approved examples/i);
  });

  it("is told to change voice only, never facts", async () => {
    const call = fakeCaller("Hi Danel,\n\nThe champagne add-on is $15");
    await naturalizeDraft({
      inquiry: inquiry({ sessionType: "Graduation Portrait" }),
      messages: [], availability: AVAILABILITY, threadLoaded: true,
      currentDraft: GENERIC, rules: [], now: NOW,
    }, call);
    expect(call.calls[0].userPrompt).toMatch(/Every fact stays exactly as it is/);
    expect(call.calls).toHaveLength(1);
  });
});

describe("10. Shorter keeps the facts and cuts the description first", () => {
  it("says to cut description before information", async () => {
    const call = fakeCaller("Hi Sarah,\n\nOctober 26th works!");
    await shortenDraft({
      inquiry: inquiry(), messages: [], availability: AVAILABILITY, threadLoaded: true,
      currentDraft: "Hi Sarah,\n\nThe light is going to be lovely. My session is $350 on October 26th", rules: [], now: NOW,
    }, call);
    const asked = call.calls[0].userPrompt;
    expect(asked).toMatch(/Cut description before you cut information/);
    expect(asked).toMatch(/do not drop one to save words/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("11. multi-message conversation", () => {
  it("does not re-explain the booking step Chris already explained", () => {
    const context = ctx({
      messages: [
        message("Once we confirm the date, I can send over the invoice and contract to secure the session", true, 3),
        message("Sounds good, let's do October 26th", false, 1),
      ],
      latest: "Sounds good, let's do October 26th",
    });
    expect(prompt(context)).toMatch(/Do not explain the invoice and contract step again/);
  });

  it("does not re-quote a price already quoted", () => {
    const context = ctx({
      messages: [
        message("My graduation sessions start at $350 for a 1-hour session", true, 3),
        message("Great, is the 26th open?", false, 1),
      ],
      latest: "Great, is the 26th open?",
    });
    expect(prompt(context)).toMatch(/do not restate them unless they ask about price again/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("12. signature handling is deterministic", () => {
  it("tells the model Gmail appends one, so the body carries none", () => {
    const text = prompt(ctx());
    expect(text).toMatch(/Gmail signature is appended automatically/);
    expect(text).toMatch(/No sign-off, no name, no signature block/);
  });

  it("flags a draft that adds its own", () => {
    const draft = "Hi Sarah,\n\nOctober 26th works!\n\nBest,\nChris";
    expect(types(ctx(), draft)).toContain("signature_present");
  });

  it("leaves a closing line alone, which is not a signature", () => {
    const draft = "Hi Sarah,\n\nOctober 26th works!\n\nLooking forward to hearing back from you!";
    expect(types(ctx(), draft)).not.toContain("signature_present");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("13. unresolved travel fee", () => {
  const far = { inquiry: { sessionType: "Couples Session", message: "couples session at the coast", location: "Shark Fin Cove Davenport" } };

  it("never invents the fee and never hides it from a total", () => {
    const text = prompt(ctx(far));
    expect(text).toMatch(/Never state a travel-fee amount/);
    expect(text).toMatch(/never give a session total that is missing it/);
  });

  it("flags an invented amount", () => {
    const draft = "Hi Sarah,\n\nMy 1-hour session is $450 plus a $60 travel fee for Davenport";
    expect(types(ctx(far), draft)).toContain("unsupported_price");
  });

  it("warns the admin that the total needs their hand", () => {
    expect(ctx(far).warnings.map((w) => w.code)).toContain("travel_unverified");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("14. awkward sentence construction", () => {
  it("carries the corrections Chris gave, as pairs", () => {
    const text = prompt(ctx({ inquiry: { sessionType: "Graduation Portrait" } }));
    expect(text).toMatch(/Not "I'd love to shoot your graduation, and congratulations!"/);
    expect(text).toMatch(/Not "So glad 5:45 pm works!"/);
    expect(text).toMatch(/Not "My graduation session is \$350 per hour"/);
  });

  it("flags the padded add-on phrasing", () => {
    const context = ctx({ inquiry: { sessionType: "Graduation Portrait", message: "champagne pop please" } });
    const draft = "Hi Sarah,\n\nFriday should be a beautiful evening for it";
    expect(types(context, draft)).toContain("scenery_description");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("15. repetitive closing", () => {
  it("flags an ask and a booking step split across two paragraphs", () => {
    const draft = `Hi Danel,

My graduation sessions start at $350

Let me know which of those dates works for you!

Once we lock in the date, time, and location, I'll send over the invoice and contract to secure your session`;
    expect(types(ctx({ inquiry: { sessionType: "Graduation Portrait" } }), draft)).toContain("duplicate_next_step");
  });

  it("accepts the combined closing Chris writes", () => {
    const draft = `Hi Danel,

My graduation sessions start at $350

Let me know which date works best for you, and I'll send over the invoice and contract to secure the session once we confirm the details`;
    expect(types(ctx({ inquiry: { sessionType: "Graduation Portrait" } }), draft)).not.toContain("duplicate_next_step");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("stage detection, directly", () => {
  const digest = (messages: ThreadMessage[]) => buildThreadDigest(messages, NOW);
  const admin = (row: InquiryAdminRow | null, messages: ThreadMessage[] = []) =>
    buildAdminStatus(row, digest(messages));

  it.each([
    ["initial_inquiry", null, "Looking for grad photos", []],
    ["pricing_discussion", "How much is a family session?", "x", [message("hi", true, 2)]],
    ["availability_discussion", "Do you have the weekend of October 3rd available?", "x", [message("hi", true, 2)]],
    ["rescheduling", "Can we move the session to another date?", "x", [message("hi", true, 2)]],
    ["post_session", "When will my photos be ready? Any link to the gallery?", "x", [message("hi", true, 2)]],
    ["decline_or_close_out", "We went with another photographer, thank you!", "x", [message("hi", true, 2)]],
  ] as const)("reads %s", (expected, latest, inquiryMessage, messages) => {
    expect(detectStage({
      digest: digest([...messages]),
      admin: admin(null, [...messages]),
      latestClientMessage: latest,
      inquiryMessage,
      hasSessionDate: false,
    })).toBe(expected);
  });

  it("reads a parking question on a paid booking as logistics, not booking", () => {
    const messages = [message("invoice sent", true, 5)];
    expect(detectStage({
      digest: digest(messages),
      admin: admin({ deposit_paid_at: "2026-10-01T00:00:00Z", invoice_sent_at: "2026-10-01T00:00:00Z", session_date: "2026-10-26" }, messages),
      latestClientMessage: "Where should we park, and what should we wear?",
      inquiryMessage: "family photos",
      hasSessionDate: true,
    })).toBe("logistics_coordination");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("regressions from reading the live drafts", () => {
  it("does not call a courtesy close a second next step", () => {
    // A 44-word confirmation was flagged because its last line was "let me
    // know if you have any questions", which is politeness, not an ask.
    const draft = `Hi Farnaz,

Perfect! I've got your deposit for August 29th, thank you

I've sent the invoice and contract to your email too. Just sign the contract before the session and we're all set

Let me know if you have any questions in the meantime!`;
    expect(types(ctx({ adminRow: { deposit_paid_at: "2026-08-01T00:00:00Z", invoice_sent_at: "2026-08-01T00:00:00Z" } }), draft))
      .not.toContain("duplicate_next_step");
  });

  it("still catches the real split", () => {
    const draft = `Hi Danel,

My graduation sessions start at $350

Let me know which of those dates works for you!

Once we lock in the date, time, and location, I'll send over the invoice and contract to secure your session`;
    expect(types(ctx({ inquiry: { sessionType: "Graduation Portrait" } }), draft)).toContain("duplicate_next_step");
  });

  it("treats a date range in a client field as covering every day in it", () => {
    // date_in_mind "May 20-22" means the 21st is theirs to discuss.
    const context = ctx({ inquiry: { dateInMind: "May 20-22" } });
    const draft = "Hi Sarah,\n\nI'll double check May 21st and get back to you";
    expect(types(context, draft)).not.toContain("unsupported_date");
  });

  it("keeps the session date nameable without naming the record", () => {
    const context = ctx({ adminRow: { session_date: "2026-05-20" } });
    const text = prompt(context);
    expect(text).toMatch(/Their session is 2026-05-20/);
    expect(text).toMatch(/never as a record, a file, or something you looked up/);
    // And the draft may say it.
    expect(types(context, "Hi Sarah,\n\nYour session on May 20th is all set")).not.toContain("unsupported_date");
  });
});
