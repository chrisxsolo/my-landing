// The invoice draft when the Rush preview add-on is in play: the add-on
// rides inside the session line's price, a figure the thread wrote before
// the add-on is compared as figure + add-on, and nothing unresolved is
// priced. Fixtures are synthetic; the graduation case reuses the shared
// Anthony fixture shape to prove the add-on never reaches a non-couples bill.

import { describe, expect, it } from "vitest";
import { buildInvoiceDraft, validateInvoiceDraft } from "@/lib/invoiceDraft/build";
import { NO_FACTS, NO_RUSH_PREVIEW, type InvoiceInquiry, type RushPreviewEvidence, type SessionFacts } from "@/lib/invoiceDraft/types";

const anthony: InvoiceInquiry = {
  id: 412, name: "Anthony Trujillo", email: "anthony@example.com",
  school: "SJSU", location: null, people: "2", session_type: "Graduation Portrait",
  message: "Grad photos for me and my sister, both graduating from SJSU.", date_in_mind: "May 16",
};

const email = (facts: Partial<SessionFacts>): SessionFacts => ({ ...NO_FACTS, source: "email", date_status: "confirmed", total_status: "confirmed", ...facts });
describe("Rush preview on a proposal (synthetic client)", () => {
  const client: InvoiceInquiry = {
    id: 913, name: "Example Client", email: "client@example.test",
    school: null, location: null, people: "2", session_type: "Couples Session",
    message: "— Session request —\nPackage: Proposal Session\nLocation: San Francisco", date_in_mind: "November 20",
  };
  const rush = (over: Partial<RushPreviewEvidence>): RushPreviewEvidence => ({ ...NO_RUSH_PREVIEW, ...over });
  const proposal = (facts: Partial<SessionFacts>) => email({ location: "Palace of Fine Arts", session_type: "proposal", date: "2026-11-20", ...facts });

  it("prices $825 in San Francisco when the client adds Rush preview after a $750 quote, never reading the $75 as stale campus travel", () => {
    const draft = buildInvoiceDraft(client, proposal({
      total_fee: 750, total_kind: "agreed_total",
      rush_preview: rush({ selection: "selected", source: "email", source_message: 4, total_fee_message: 2 }),
    }));
    expect(draft.status).toBe("ready");
    expect(draft.pricing).toMatchObject({ baseCents: 82500, totalCents: 82500, agreedTotalCents: 75000, travel: { kind: "included", amountCents: 0 } });
    expect(draft.session.description).toMatch(/Rush preview/);
    expect(draft.warnings.join(" ")).toMatch(/\$75 Rush preview/);
    expect(draft.warnings.join(" ")).not.toMatch(/campus travel/);
    expect(validateInvoiceDraft(draft)).toMatchObject({ ok: true });
  });

  it("adds Rush preview to a proposal with no figure in the thread", () => {
    const draft = buildInvoiceDraft(client, proposal({ rush_preview: rush({ selection: "selected", source: "email", source_message: 3 }) }));
    expect(draft.status).toBe("ready");
    expect(draft.pricing).toMatchObject({ baseCents: 82500, totalCents: 82500, agreedTotalCents: null });
  });

  it("keeps an $825 total that already includes Rush preview at $825, never $900", () => {
    const draft = buildInvoiceDraft(client, proposal({
      total_fee: 825, total_kind: "agreed_total",
      rush_preview: rush({ selection: "selected", source: "email", source_message: 3, included_in_total: true, total_fee_message: 5 }),
    }));
    expect(draft.status).toBe("ready");
    expect(draft.pricing).toMatchObject({ baseCents: 82500, totalCents: 82500, agreedTotalCents: 82500 });
    expect(draft.warnings.join(" ")).toMatch(/already includes/);
  });

  it("keeps a negotiated inclusive total whole instead of reading its extra $75 as a stale campus fee", () => {
    const draft = buildInvoiceDraft(client, proposal({
      total_fee: 900, total_kind: "agreed_total",
      rush_preview: rush({ selection: "selected", source: "email", source_message: 3, included_in_total: true, total_fee_message: 5 }),
    }));
    expect(draft.status).toBe("ready");
    expect(draft.pricing).toMatchObject({ baseCents: 90000, totalCents: 90000, agreedTotalCents: 90000 });
    expect(draft.warnings.join(" ")).not.toMatch(/campus travel/);
    expect(draft.warnings.join(" ")).toMatch(/\$900 total.*already includes/);
  });

  it("still resolves a stale campus quote underneath a later Rush preview request", () => {
    // $795 = $750 + the $45 Berkeley fee, quoted before the shoot moved to San Francisco.
    const draft = buildInvoiceDraft(client, proposal({
      total_fee: 795, total_kind: "quote",
      rush_preview: rush({ selection: "selected", source: "email", source_message: 4, total_fee_message: 2 }),
    }));
    expect(draft.status).toBe("ready");
    expect(draft.pricing).toMatchObject({ baseCents: 82500, totalCents: 82500, agreedTotalCents: null });
    expect(draft.warnings.join(" ")).toMatch(/\$795 \+ \$75 Rush preview quote included a \$45 campus travel fee/);
  });

  it("keeps a $750 proposal at $750 when nobody mentioned Rush preview", () => {
    const draft = buildInvoiceDraft(client, proposal({ total_fee: 750, total_kind: "agreed_total" }));
    expect(draft.status).toBe("ready");
    expect(draft.pricing).toMatchObject({ baseCents: 75000, totalCents: 75000 });
    expect(draft.session.description).not.toMatch(/Rush/);
    expect(draft.warnings).toEqual([]);
  });

  it("goes to review with no total when the Rush preview wording is unclear", () => {
    const draft = buildInvoiceDraft(client, proposal({ total_fee: 750, total_kind: "quote", rush_preview: rush({ selection: "unclear", source: "email", source_message: 3 }) }));
    expect(draft.status).toBe("review");
    expect(draft.pricing.totalCents).toBeNull();
    expect(draft.reviewReasons.join(" ")).toMatch(/Rush preview/);
    expect(validateInvoiceDraft(draft)).toMatchObject({ ok: true });
  });

  it("goes to review when the client cancelled Rush preview after a total that included it", () => {
    const draft = buildInvoiceDraft(client, proposal({
      total_fee: 825, total_kind: "agreed_total",
      rush_preview: rush({ selection: "removed", source: "email", source_message: 6, total_fee_message: 4, included_in_total: true }),
    }));
    expect(draft.status).toBe("review");
    expect(draft.pricing.totalCents).toBeNull();
    expect(draft.reviewReasons.join(" ")).toMatch(/cancelled/i);
  });

  it("never charges Rush preview on a graduation invoice", () => {
    const draft = buildInvoiceDraft(anthony, email({ location: "San Francisco City Hall", rush_preview: rush({ selection: "selected", source: "email", source_message: 2 }) }));
    expect(draft.status).toBe("review");
    expect(draft.pricing.totalCents).toBeNull();
    expect(draft.reviewReasons.join(" ")).toMatch(/couples add-on/i);
  });
});
