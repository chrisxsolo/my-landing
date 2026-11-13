// Field-level standing for the Pixieset autofill: each fact (date, total,
// type, headcount) is judged on its own evidence, the eight-person sports
// senior offer stays inside its own scope, and the transcript reader says
// what it could not read. Everything here is synthetic.

import { describe, expect, it } from "vitest";
import { sportsTeamScopeMatches } from "@/lib/ai/sportsTeamPortraitScope";
import { bookingQuery, bookingWindow, orderMessages } from "@/lib/extension/emailThread";
import { normalizeExtractedFacts, systemPrompt, totalIsOnRecord } from "@/lib/extension/sessionFacts";
import { buildInvoiceDraft, validateInvoiceDraft } from "@/lib/invoiceDraft/build";
import { NO_FACTS, type InvoiceInquiry, type PackageEvidence, type SessionFacts } from "@/lib/invoiceDraft/types";

const team: InvoiceInquiry = {
  id: 9201, name: "Jordan Example", email: "jordan@example.test", school: null, location: null, people: "8",
  session_type: "Graduation Portrait", message: "Sports team portraits for 8 senior athletes on our soccer team.", date_in_mind: null,
};
const selected = (minutes: number): PackageEvidence => ({ status: "selected", minutes, source_message: 3 });
const thread = (facts: Partial<SessionFacts>): SessionFacts => ({ ...NO_FACTS, source: "email", email_status: "read", ...facts });
const inSf = { location: "Golden Gate Park" };
const draftOf = (inquiry: InvoiceInquiry, facts: SessionFacts) => {
  const draft = buildInvoiceDraft(inquiry, facts);
  expect(validateInvoiceDraft(draft)).toMatchObject({ ok: true });
  return draft;
};

describe("normalizing the model's answer", () => {
  const dates = ["2026-11-02", "2026-11-05", "2026-11-12"];

  it("parses the client's own words for the date and ignores the model's year", () => {
    const facts = normalizeExtractedFacts({ date: "2027-11-29", date_text: "29th Nov", date_message: 3, date_status: "proposed" }, { messageDates: dates });
    expect(facts).toMatchObject({ date: "2026-11-29", readable: "November 29th, 2026", date_status: "proposed" });
  });

  it("resolves a yearless date from the day its message was sent, not from today", () => {
    const old = normalizeExtractedFacts({ date_text: "May 16", date_message: 1, date_status: "confirmed" }, { messageDates: ["2025-03-02"], today: "2026-11-13" });
    expect(old.date).toBe("2025-05-16");
  });

  it("drops a date that is not on the calendar", () => {
    expect(normalizeExtractedFacts({ date: "2026-02-30", date_status: "confirmed" }, { messageDates: dates })).toMatchObject({ date: null, date_status: null });
  });

  it("shows a date the model worked out from relative wording as proposed, never confirmed", () => {
    const facts = normalizeExtractedFacts({ date: "2026-11-21", date_text: "next Saturday", date_message: 3, date_status: "confirmed" }, { messageDates: dates });
    expect(facts).toMatchObject({ date: "2026-11-21", date_status: "proposed" });
  });

  it("treats a field the model gave no standing for as proposed, whatever its overall confidence", () => {
    const facts = normalizeExtractedFacts({ date: "2026-11-29", total_fee: 1200, total_kind: "agreed_total", confidence: "high" }, { messageDates: dates });
    expect(facts).toMatchObject({ date_status: "proposed", total_status: "proposed" });
  });

  it("accepts senior portraits as a type and keeps a sane headcount and a short deliverables line", () => {
    const facts = normalizeExtractedFacts({ session_type: "senior-portraits", people: 8, deliverables: "5 portraits each plus 2 group photos" });
    expect(facts).toMatchObject({ session_type: "senior-portraits", people: 8, deliverables: "5 portraits each plus 2 group photos" });
    expect(normalizeExtractedFacts({ session_type: "wedding", people: 8.5, deliverables: "x".repeat(400) })).toMatchObject({ session_type: null, people: null, deliverables: null });
    expect(normalizeExtractedFacts({ people: 0 }).people).toBeNull();
  });

  it("tells the model how to read dates, totals, signatures and terse replies", () => {
    const prompt = systemPrompt("2026-11-13", 2026);
    expect(prompt).toMatch(/most recently asked for or offered, even though nobody has accepted it yet/);
    expect(prompt).toMatch(/Judge every field on its own evidence/);
    expect(prompt).toMatch(/signature or footer .* never this booking/);
    expect(prompt).toMatch(/per-person rate, a deposit, a retainer, a remaining balance and an add-on price are not the total/);
    expect(prompt).toMatch(/short reply like these confirms what the message it answers proposed/);
    expect(prompt).toMatch(/"senior-portraits"/);
  });
});

describe("the photographer being on record for a total", () => {
  const client = (body: string) => ({ direction: "client" as const, body });
  const photographer = (body: string) => ({ direction: "photographer" as const, body });

  it("holds when the photographer wrote the figure, or answered the client's message that wrote it", () => {
    expect(totalIsOnRecord(1200, [photographer("The hour is $1,200 total.")])).toBe(true);
    expect(totalIsOnRecord(1200, [client("So $1200 for the hour?"), photographer("Yes, confirmed!")])).toBe(true);
    expect(totalIsOnRecord(412.5, [photographer("Your balance is $412.50.")])).toBe(true);
  });

  it("fails for a figure only the client wrote last, an automated notice, or a different number", () => {
    expect(totalIsOnRecord(1200, [photographer("Options from $800."), client("Could you do $1,200?")])).toBe(false);
    expect(totalIsOnRecord(1200, [{ direction: "other", body: "Payment of $1,200 received" }])).toBe(false);
    expect(totalIsOnRecord(1200, [photographer("It is $11,200 for the season."), photographer("or $1,200.50")])).toBe(false);
  });

  it("is not satisfied by a reply that names another amount, or by a number that is not money", () => {
    expect(totalIsOnRecord(800, [client("Can you do $800?"), photographer("No, the total is $900.")])).toBe(false);
    expect(totalIsOnRecord(800, [client("Can you do $800?"), photographer("Let me check my calendar.")])).toBe(false);
    expect(totalIsOnRecord(800, [photographer("Call me at 415-800-1234.")])).toBe(false);
    expect(totalIsOnRecord(425, [photographer("Let's meet at 425 Market St.")])).toBe(false);
    expect(totalIsOnRecord(60, [photographer("The 60 minute session works.")])).toBe(false);
    expect(totalIsOnRecord(2026, [photographer("See you 11/8/2026!")])).toBe(false);
  });

  it("does not read a hedge, a refusal or a counter-offer as agreement", () => {
    const asked = client("Could you do $800 total?");
    for (const reply of [
      "Great question! Let me check and get back to you.", "I can't confirm that price yet.", "That's not correct, it is 900 all in.",
      "Saturday works. The total is 900 though.", "Unfortunately no deal at that price.", "No, $800 is too low. The total is $900.",
    ]) expect(totalIsOnRecord(800, [asked, photographer(reply)]), reply).toBe(false);
    expect(totalIsOnRecord(800, [asked, photographer("Yes, that works!")])).toBe(true);
    expect(totalIsOnRecord(900, [asked, photographer("No, $800 is too low. The total is $900.")])).toBe(true);
  });

  it("looks past an automated notice between the client's figure and the photographer's yes", () => {
    expect(totalIsOnRecord(1200, [client("So $1,200 total?"), { direction: "other", body: "Calendar invite sent" }, photographer("Yes, that's right.")])).toBe(true);
  });

  it("does not guess at a figure written with a decimal comma", () => {
    expect(normalizeExtractedFacts({ total_fee: "1.200,50", total_kind: "agreed_total", total_status: "confirmed" }).total_fee).toBeNull();
    expect(normalizeExtractedFacts({ total_fee: "$1,200.00" }).total_fee).toBe(1200);
    expect(normalizeExtractedFacts({ total_fee: 75000 }).total_fee).toBeNull();
  });
});

describe("the eight-person sports senior offer stays in its own scope", () => {
  it("prices the chosen option from the offer when the booking is in scope and no total was written", () => {
    const hour = draftOf(team, thread({ ...inSf, sports_team_offer: true, package: selected(60) }));
    expect(hour.session).toMatchObject({ serviceKey: "senior-portraits", itemName: "Senior Portraits", people: 8, durationMinutes: 60 });
    expect(hour.pricing).toMatchObject({ baseCents: 120000, totalCents: 120000, baseConfirmed: true });
    expect(hour.session.description).toMatch(/5 edited portraits per person \(2 headshots, 3 full-body\)/);
    expect(draftOf(team, thread({ ...inSf, sports_team_offer: true, package: selected(30) })).pricing.totalCents).toBe(80000);
  });

  it("prices neither option until a length is chosen, and never from a figure alone", () => {
    const draft = draftOf(team, thread({ ...inSf, sports_team_offer: true, total_fee: 1200, total_kind: "quote", total_status: "proposed" }));
    expect(draft.pricing).toMatchObject({ totalCents: null, baseConfirmed: false });
    expect(draft.reviewReasons.join(" ")).toMatch(/30-minute sports senior session \$800 or 60-minute sports senior session \$1,200/);
  });

  it("gives another headcount, an ordinary senior session and a 45-minute request no offer rate", () => {
    const seven = draftOf({ ...team, people: "7" }, thread({ ...inSf, session_type: "senior-portraits", sports_team_offer: false, package: selected(60) }));
    const ordinary = draftOf({ ...team, people: "1", message: "Senior portraits for my daughter." }, thread({ ...inSf, session_type: "senior-portraits", package: selected(60) }));
    const odd = draftOf(team, thread({ ...inSf, sports_team_offer: true, package: selected(45) }));
    for (const draft of [seven, ordinary, odd]) {
      expect(draft.pricing).toMatchObject({ baseCents: 0, totalCents: null, baseConfirmed: false });
      expect(draft.status).toBe("review");
    }
  });

  it("matches the scope from the client's own words only", () => {
    const base = { inquiryMessage: team.message, people: "8" };
    expect(sportsTeamScopeMatches(base)).toBe(true);
    expect(sportsTeamScopeMatches({ ...base, people: "7" })).toBe(false);
    expect(sportsTeamScopeMatches({ ...base, clientMessages: ["We also want cap and gown shots for graduation."] })).toBe(false);
    expect(sportsTeamScopeMatches({ inquiryMessage: "Senior portraits for my daughter", people: "1" })).toBe(false);
    // A different price the photographer already quoted is not replaced by the offer.
    expect(sportsTeamScopeMatches({ ...base, photographerMessages: ["I can do the session for $1,000."] })).toBe(false);
    expect(sportsTeamScopeMatches({ ...base, photographerMessages: ["The 60 minute session is $1,200 total."] })).toBe(true);
  });

  it("lets a settled thread total override the offer", () => {
    const draft = draftOf(team, thread({ ...inSf, sports_team_offer: true, package: selected(60), total_fee: 1000, total_kind: "agreed_total", total_status: "confirmed" }));
    expect(draft.pricing).toMatchObject({ baseCents: 100000, totalCents: 100000, baseConfirmed: true });
  });
});

describe("session identity", () => {
  it("reads team senior portraits from the client's message even when the form's dropdown says Graduation Portrait", () => {
    const inquiry = { ...team, people: "6", message: "Senior portraits for 6 players on our basketball team." };
    const draft = draftOf(inquiry, NO_FACTS);
    expect(draft.session.serviceKey).toBe("senior-portraits");
    expect(draft.status).toBe("review");
    expect(draft.pricing.totalCents).toBeNull();
  });

  it("never marks plain senior portraits ready at the graduation rate", () => {
    const inquiry = { ...team, people: "1", school: "SF State", message: "Looking for senior portraits for my daughter this fall." };
    for (const facts of [NO_FACTS, thread({ ...inSf }), thread({ ...inSf, session_type: null, total_fee: null })]) {
      const draft = draftOf(inquiry, facts);
      expect(draft.status).toBe("review");
      expect(draft.reviewReasons.join(" ")).toMatch(/asks for senior portraits and does not mention graduating/);
    }
    for (const message of ["A senior photoshoot for my daughter", "I want senior year portraits for my daughter", "Portraits for my high school senior please"]) {
      expect(draftOf({ ...inquiry, message }, NO_FACTS).status, message).toBe("review");
    }
    for (const message of ["Senior photos in my cap & gown", "College senior photos for grad season"]) {
      expect(draftOf({ ...inquiry, message }, thread({ ...inSf })).reviewReasons.join(" "), message).not.toMatch(/senior portraits/);
    }
  });

  it("sends a graduation reading to review when the client's own words say team senior portraits", () => {
    const draft = draftOf({ ...team, school: "SF State" }, thread({ ...inSf, session_type: "graduation", sports_team_offer: true }));
    expect(draft.status).toBe("review");
    expect(draft.reviewReasons.join(" ")).toMatch(/client's own words describe senior portraits for a team/);
  });

  it("flags a graduation priced on a headcount only the emails gave", () => {
    const grad = { ...team, people: null, school: "SF State", message: "Grad photos, we are graduating in May." };
    const draft = draftOf(grad, thread({ ...inSf, session_type: "graduation", people: 3 }));
    expect(draft.pricing.baseCents).toBe(97500);
    expect(draft.status).toBe("review");
    expect(draft.reviewReasons.join(" ")).toMatch(/emails say 3 people, but the inquiry form gives no headcount/);
    expect(draftOf(grad, thread({ ...inSf, session_type: "graduation", people: 1 })).reviewReasons.join(" ")).not.toMatch(/headcount/);
  });

  it("shows an unusable client name or address as a review reason instead of failing the response", () => {
    for (const client of [{ name: "" }, { email: "a@b" }, { email: "jordan@example.test " }]) {
      const draft = draftOf({ ...team, ...client }, thread({ ...inSf, session_type: "family" }));
      expect(draft.status, JSON.stringify(client)).toBe("review");
    }
  });

  it("keeps a real graduation booking a graduation", () => {
    const grad = { ...team, people: "2", school: "SF State", message: "Senior portraits for me and my teammate, we are graduating in May!" };
    const draft = draftOf(grad, NO_FACTS);
    expect(draft.session.serviceKey).toBe("graduation");
    expect(draft.pricing.totalCents).toBe(70000);
  });

  it("never turns a type the thread calls something else into a graduation because a school is on file", () => {
    const inquiry = { ...team, school: "SJSU", people: "3", message: "Photos for our club event." };
    for (const type of ["event", "other"]) {
      const draft = draftOf(inquiry, thread({ session_type: type }));
      expect(draft.session, type).toMatchObject({ serviceKey: "unknown", itemName: "Photo Session" });
      expect(draft.pricing.travel.kind, type).not.toBe("verified");
    }
  });

  it("honours a settled total for a type the rate card does not name, and still asks for review", () => {
    const draft = draftOf({ ...team, message: "Photos for our club event." }, thread({ ...inSf, session_type: "event", total_fee: 600, total_kind: "agreed_total", total_status: "confirmed" }));
    expect(draft.pricing).toMatchObject({ baseCents: 60000, totalCents: 60000 });
    expect(draft.status).toBe("review");
  });

  it("prices a graduation on the headcount the emails state and flags the change", () => {
    const grad = { ...team, people: "2", school: "SF State", message: "Grad photos for two of us graduating." };
    const draft = draftOf(grad, thread({ ...inSf, people: 3 }));
    expect(draft.session.people).toBe(3);
    expect(draft.pricing.baseCents).toBe(97500);
    expect(draft.reviewReasons.join(" ")).toMatch(/emails say 3 people, but the inquiry form says 2/);
  });
});

describe("travel under a hand-quoted total", () => {
  const settled = { session_type: "senior-portraits", total_fee: 1200, total_kind: "agreed_total" as const, total_status: "confirmed" as const };

  it("keeps the travel line under a total that says it includes travel", () => {
    const draft = draftOf(team, thread({ ...settled, location: "SJSU campus", includes_travel: true }));
    expect(draft.pricing).toMatchObject({ baseCents: 112500, travel: { kind: "verified", amountCents: 7500 }, totalCents: 120000 });
  });

  it("asks whether a fee on file is inside the total when the thread does not say", () => {
    const draft = draftOf(team, thread({ ...settled, location: "SJSU campus" }));
    expect(draft.pricing).toMatchObject({ totalCents: null, baseConfirmed: false, agreedTotalCents: 120000 });
    expect(draft.reviewReasons.join(" ")).toMatch(/\$75 travel fee .* is included/);
  });

  it("asks for the location when none is known instead of assuming a campus", () => {
    const draft = draftOf({ ...team, school: "SJSU" }, thread(settled));
    expect(draft.session.location).toBeNull();
    expect(draft.pricing.travel.kind).toBe("none");
    expect(draft.status).toBe("review");
    expect(draft.reviewReasons.join(" ")).toMatch(/No shoot location is known/);
  });
});

describe("the booking's stretch of mail", () => {
  it("opens two weeks before the form and closes only for a later, separate booking", () => {
    expect(bookingWindow(null)).toEqual({ after: null, before: null });
    expect(bookingWindow("2026-11-02T00:00:00Z")).toEqual({ after: "2026-10-19T00:00:00.000Z", before: null });
    expect(bookingWindow("2026-11-02T00:00:00Z", "2026-11-10T00:00:00Z").before).toBeNull();
    expect(bookingWindow("2026-11-02T00:00:00Z", "2027-03-15T00:00:00Z").before).toBe("2027-03-01T00:00:00.000Z");
    expect(bookingQuery("a@example.test", { after: null, before: null })).toBe("{from:a@example.test to:a@example.test}");
  });

  it("keeps an early priced message from the photographer when a long thread is cut", () => {
    const at = (i: number) => new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString();
    const message = (i: number, direction: "client" | "photographer", body: string) => ({ id: `syn-${String(i).padStart(2, "0")}`, threadId: "t", at: at(i), direction, body, truncated: false });
    const long = [message(0, "client", "hello"), message(1, "photographer", "The session is $900 total."), ...Array.from({ length: 30 }, (_, i) => message(i + 2, "client", "logistics"))];
    const kept = orderMessages(long, 25);
    expect(kept).toHaveLength(26);
    expect(kept[0]).toMatchObject({ index: 1, body: "The session is $900 total." });
    expect(kept.at(-1)?.index).toBe(26);
  });
});
