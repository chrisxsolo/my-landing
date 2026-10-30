// The Pixieset invoice draft prices the session at the place it is actually
// shot. An SJSU graduate shooting at City Hall pays no SJSU travel; an SJSU
// graduate shooting on campus pays the approved fee as a separate line.

import { describe, expect, it } from "vitest";
import { buildInvoiceDraft, validateInvoiceDraft } from "@/lib/invoiceDraft/build";
import { NO_FACTS, type InvoiceInquiry, type SessionFacts } from "@/lib/invoiceDraft/types";
import { hasUsefulFacts, normalizeExtractedFacts } from "@/lib/extension/sessionFacts";

const anthony: InvoiceInquiry = {
  id: 412, name: "Anthony Trujillo", email: "anthony@example.com",
  school: "SJSU", location: null, people: "2", session_type: "Graduation Portrait",
  message: "Grad photos for me and my sister, both graduating from SJSU.", date_in_mind: "May 16",
};

const email = (facts: Partial<SessionFacts>): SessionFacts => ({ ...NO_FACTS, source: "email", confidence: "high", ...facts });

describe("Anthony: SJSU graduate shooting at San Francisco City Hall", () => {
  const draft = buildInvoiceDraft(anthony, email({ location: "San Francisco City Hall", date: "2027-05-16" }));

  it("is ready at $600 with travel included and no travel line", () => {
    expect(draft.status).toBe("ready");
    expect(draft.reviewReasons).toEqual([]);
    expect(draft.session).toMatchObject({ itemName: "Graduation Session", description: "Two people", quantity: 1, people: 2 });
    expect(draft.session.location).toBe("San Francisco City Hall");
    expect(draft.session.locationSource).toBe("email");
    expect(draft.session.school).toBe("SJSU");
    expect(draft.pricing.baseCents).toBe(60000);
    expect(draft.pricing.travel).toEqual({ kind: "included", amountCents: 0, place: "San Francisco City Hall" });
    expect(draft.pricing.totalCents).toBe(60000);
  });

  it("uses the confirmed session date as the due date", () => {
    expect(draft.session.dateConfidence).toBe("confirmed");
    expect(draft.dueDate).toBe("2027-05-16");
    expect(draft.warnings).toEqual([]);
  });

  it("passes the response contract", () => {
    expect(validateInvoiceDraft(draft)).toMatchObject({ ok: true });
  });

  it("never shows $675 once City Hall is known, even if the thread mentions SJSU", () => {
    const withMention = buildInvoiceDraft({ ...anthony, message: "SJSU grads! Meeting at City Hall." }, email({ location: "San Francisco City Hall" }));
    expect(withMention.pricing.totalCents).toBe(60000);
    expect(withMention.pricing.travel.kind).toBe("included");
  });
});

describe("travel precedence", () => {
  it("charges the approved $75 SJSU fee as a separate line for an on-campus shoot", () => {
    const draft = buildInvoiceDraft(anthony, email({ location: "SJSU campus" }));
    expect(draft.status).toBe("ready");
    expect(draft.pricing.travel).toEqual({ kind: "verified", amountCents: 7500, place: "SJSU campus" });
    expect(draft.pricing.totalCents).toBe(67500);
  });

  it("falls back to the school's campus only when no shoot location is known", () => {
    const draft = buildInvoiceDraft(anthony, NO_FACTS);
    expect(draft.session.locationSource).toBe("school");
    expect(draft.pricing.travel).toMatchObject({ kind: "verified", amountCents: 7500 });
    expect(draft.pricing.totalCents).toBe(67500);
  });

  it("lets an explicit San Francisco location override any non-SF school", () => {
    for (const school of ["UC Berkeley", "Stanford", "CSU East Bay", "Santa Clara University"]) {
      const draft = buildInvoiceDraft({ ...anthony, school }, email({ location: "Palace of Fine Arts, San Francisco" }));
      expect(draft.pricing.travel.kind, school).toBe("included");
      expect(draft.pricing.totalCents, school).toBe(60000);
    }
  });

  it("uses the inquiry's stored location before the school", () => {
    const draft = buildInvoiceDraft({ ...anthony, location: "Baker Beach" }, NO_FACTS);
    expect(draft.session.locationSource).toBe("inquiry");
    expect(draft.pricing.travel.kind).toBe("included");
    expect(draft.pricing.totalCents).toBe(60000);
  });

  it("asks for review on an unknown outside-SF location, guessing nothing and keeping the location", () => {
    const draft = buildInvoiceDraft(anthony, email({ location: "Point Reyes" }));
    expect(draft.status).toBe("review");
    expect(draft.pricing.travel).toEqual({ kind: "unknown", amountCents: null, place: "Point Reyes" });
    expect(draft.pricing.totalCents).toBeNull();
    expect(draft.session.location).toBe("Point Reyes");
    expect(draft.session.locationSource).toBe("email");
    expect(draft.reviewReasons.join(" ")).toMatch(/Point Reyes.*no approved travel fee/);
  });

  it("never swaps a confirmed but unplaced location for the school", () => {
    const draft = buildInvoiceDraft(anthony, email({ location: "Filoli Gardens" }));
    expect(draft.session.location).toBe("Filoli Gardens");
    expect(draft.pricing.travel.kind).toBe("unknown");
    expect(draft.status).toBe("review");
  });

  it("treats a free-text location note as a review item, not a place (live inquiry 126)", () => {
    const note = "Still thinking of a spot but don’t want it to be basic SJSU campus and more federal building / justice studies related / federal law enforcement";
    const draft = buildInvoiceDraft({ ...anthony, location: note }, NO_FACTS);
    expect(draft.status).toBe("review");
    expect(draft.reviewReasons.join(" ")).toMatch(/location field is a note, not a place/);
    expect(draft.session.locationSource).toBe("school");
    expect(draft.pricing.travel.place).not.toBe(note);
  });

  it("still lets a confirmed email location win over a free-text note", () => {
    const note = "Still thinking of a spot but don’t want it to be basic SJSU campus";
    const draft = buildInvoiceDraft({ ...anthony, location: note }, email({ location: "City Hall, San Francisco" }));
    expect(draft.status).toBe("ready");
    expect(draft.pricing.totalCents).toBe(60000);
    expect(draft.pricing.travel.kind).toBe("included");
  });

  it("charges no campus fee on a couples session that lists a school", () => {
    const draft = buildInvoiceDraft({ ...anthony, session_type: "Couples Session", message: "", people: "2" }, NO_FACTS);
    expect(draft.session.itemName).toBe("Couples Session");
    expect(draft.pricing.travel.kind).toBe("none");
    expect(draft.pricing.totalCents).toBe(45000);
    expect(draft.status).toBe("ready");
  });
});

describe("agreed totals from the thread", () => {
  it("accepts a quoted amount that matches the rate card", () => {
    const draft = buildInvoiceDraft(anthony, email({ location: "San Francisco City Hall", total_fee: 600, total_kind: "quote" }));
    expect(draft.status).toBe("ready");
    expect(draft.pricing.agreedTotalCents).toBe(60000);
    expect(draft.pricing.totalCents).toBe(60000);
  });

  it("asks for review when an amount could be the session price without travel", () => {
    const draft = buildInvoiceDraft(anthony, email({ location: "SJSU campus", total_fee: 600, total_kind: "agreed_total" }));
    expect(draft.status).toBe("review");
    expect(draft.pricing.totalCents).toBeNull();
    expect(draft.reviewReasons.join(" ")).toMatch(/\$600.*session price alone.*\$75 travel fee/);
  });

  it("asks for review when an unclear amount disagrees with the rate card", () => {
    const draft = buildInvoiceDraft(anthony, email({ location: "San Francisco City Hall", total_fee: 500, total_kind: "unclear" }));
    expect(draft.status).toBe("review");
    expect(draft.reviewReasons.join(" ")).toMatch(/\$500.*differs from the rate card \(\$600\)/);
  });

  it("accepts a clearly negotiated all-in total that is consistent with the shoot location", () => {
    const draft = buildInvoiceDraft(anthony, email({ location: "San Francisco City Hall", total_fee: 550, total_kind: "agreed_total" }));
    expect(draft.status).toBe("ready");
    expect(draft.pricing).toMatchObject({ baseCents: 55000, agreedTotalCents: 55000, totalCents: 55000 });
  });

  it("keeps the travel line under a negotiated total that includes travel", () => {
    const draft = buildInvoiceDraft(anthony, email({ location: "SJSU campus", total_fee: 650, total_kind: "agreed_total", includes_travel: true }));
    expect(draft.status).toBe("ready");
    expect(draft.pricing).toMatchObject({ baseCents: 57500, travel: { kind: "verified", amountCents: 7500 }, totalCents: 65000 });
  });

  it("resolves Anthony's earlier $675 campus quote to $600 once City Hall is confirmed, with a note", () => {
    for (const total_kind of ["agreed_total", "quote", "unclear"] as const) {
      const draft = buildInvoiceDraft(anthony, email({ location: "City Hall, San Francisco", total_fee: 675, total_kind, includes_travel: true }));
      expect(draft.status, total_kind).toBe("ready");
      expect(draft.pricing.totalCents, total_kind).toBe(60000);
      expect(draft.pricing.agreedTotalCents, total_kind).toBeNull();
      expect(draft.pricing.travel.kind, total_kind).toBe("included");
      expect(draft.warnings.join(" "), total_kind).toMatch(/\$675 quote included a \$75 campus travel fee/);
    }
  });

  it("never takes a travel-inclusive total as-is for a shoot with no travel fee", () => {
    const draft = buildInvoiceDraft(anthony, email({ location: "San Francisco City Hall", total_fee: 700, total_kind: "agreed_total", includes_travel: true }));
    expect(draft.status).toBe("review");
    expect(draft.pricing.totalCents).toBeNull();
  });

  it("does not accept a negotiated total at an unpriced location", () => {
    const draft = buildInvoiceDraft(anthony, email({ location: "Point Reyes", total_fee: 700, total_kind: "agreed_total", includes_travel: true }));
    expect(draft.status).toBe("review");
    expect(draft.pricing.totalCents).toBeNull();
  });
});

describe("when the thread cannot be read", () => {
  it("asks for review instead of pricing from the school when Gmail is not connected", () => {
    const draft = buildInvoiceDraft(anthony, { ...NO_FACTS, email_status: "unavailable" });
    expect(draft.status).toBe("review");
    expect(draft.reviewReasons.join(" ")).toMatch(/Gmail is not connected/);
    expect(draft.pricing.travel.kind).toBe("verified");
    expect(draft.pricing.totalCents).toBe(67500);
  });

  it("stays ready when Gmail is connected but the client has no thread yet", () => {
    const draft = buildInvoiceDraft(anthony, { ...NO_FACTS, email_status: "none" });
    expect(draft.status).toBe("ready");
  });
});

describe("due date safety", () => {
  it("leaves the due date alone and warns when the date is only tentative", () => {
    const draft = buildInvoiceDraft(anthony, email({ location: "San Francisco City Hall", date: "2027-05-16", confidence: "medium" }));
    expect(draft.status).toBe("ready");
    expect(draft.dueDate).toBeNull();
    expect(draft.session.dateConfidence).toBe("tentative");
    expect(draft.warnings[0]).toMatch(/not confirmed.*left unchanged/);
  });

  it("never invents a due date when no date is known", () => {
    const draft = buildInvoiceDraft({ ...anthony, date_in_mind: null }, email({ location: "San Francisco City Hall" }));
    expect(draft.dueDate).toBeNull();
    expect(draft.session.dateConfidence).toBe("unknown");
  });
});

describe("validation", () => {
  it("rejects negative, fractional and implausible money", () => {
    const draft = buildInvoiceDraft(anthony, email({ location: "San Francisco City Hall" }));
    expect(validateInvoiceDraft({ ...draft, pricing: { ...draft.pricing, baseCents: -1, totalCents: -1 } })).toMatchObject({ ok: false });
    expect(validateInvoiceDraft({ ...draft, pricing: { ...draft.pricing, baseCents: 600.5, totalCents: 600.5 } })).toMatchObject({ ok: false });
    expect(validateInvoiceDraft({ ...draft, pricing: { ...draft.pricing, baseCents: 99_000_000, totalCents: 99_000_000 } })).toMatchObject({ ok: false });
  });

  it("rejects a total that does not equal base plus travel", () => {
    const draft = buildInvoiceDraft(anthony, email({ location: "San Francisco City Hall" }));
    expect(validateInvoiceDraft({ ...draft, pricing: { ...draft.pricing, totalCents: 67500 } })).toMatchObject({ ok: false });
  });

  it("rejects a ready draft with unknown travel", () => {
    const draft = buildInvoiceDraft(anthony, email({ location: "San Francisco City Hall" }));
    const broken = { ...draft, pricing: { ...draft.pricing, travel: { kind: "unknown", amountCents: null, place: "Point Reyes" } } };
    expect(validateInvoiceDraft(broken)).toMatchObject({ ok: false });
  });

  it("flags an implausible headcount and an unusable email for review", () => {
    const crowd = buildInvoiceDraft({ ...anthony, people: "40" }, email({ location: "San Francisco City Hall" }));
    expect(crowd.status).toBe("review");
    expect(crowd.reviewReasons.join(" ")).toMatch(/group of 40/);
    const noEmail = buildInvoiceDraft({ ...anthony, email: "not an email" }, email({ location: "San Francisco City Hall" }));
    expect(noEmail.status).toBe("review");
  });

  it("writes the note and keeps the payment policy wording", () => {
    const draft = buildInvoiceDraft(anthony, email({ location: "San Francisco City Hall" }));
    expect(draft.note).toMatch(/^Thank you for booking, Anthony!/);
    expect(draft.note).toMatch(/50% non-refundable retainer/);
    expect(draft.note).toMatch(/on or before the session date/);
  });
});

describe("email extraction", () => {
  it("retains a location-only result", () => {
    const facts = normalizeExtractedFacts({ date: null, time: null, location: "San Francisco City Hall", session_type: null, total_fee: null, confidence: "high" });
    expect(hasUsefulFacts(facts)).toBe(true);
    expect(facts.location).toBe("San Francisco City Hall");
    expect(facts.total_kind).toBeNull();
  });

  it("retains a time-only result", () => {
    const facts = normalizeExtractedFacts({ time: "6:00 PM" });
    expect(hasUsefulFacts(facts)).toBe(true);
    expect(facts.time).toBe("6:00 PM");
  });

  it("drops an empty result", () => {
    expect(hasUsefulFacts(normalizeExtractedFacts({ date: null, confidence: "low" }))).toBe(false);
  });

  it("marks model facts as read from email", () => {
    expect(normalizeExtractedFacts({ location: "SJSU" }).email_status).toBe("read");
  });

  it("coerces and bounds every field", () => {
    const facts = normalizeExtractedFacts({
      date: "May 16th, 2027", time: 1234, location: "x".repeat(500), session_type: "wedding",
      total_fee: "-50", total_kind: "bogus", includes_travel: "yes", confidence: "certain",
    });
    expect(facts).toMatchObject({
      date: "2027-05-16", readable: "May 16th, 2027", time: null, location: null, session_type: null,
      total_fee: null, total_kind: null, includes_travel: null, confidence: "low", source: "email",
    });
    expect(normalizeExtractedFacts({ total_fee: 350 }).total_kind).toBe("unclear");
    expect(normalizeExtractedFacts("nonsense").date).toBeNull();
  });
});
