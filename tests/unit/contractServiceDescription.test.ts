// The contract's Description of Services, resolved from the same booking
// facts as the invoice. Everything here is synthetic.

import { describe, expect, it } from "vitest";
import {
  GRADUATION_CONTRACT_DEFAULT_IMAGES, contractServicesFor, describePackage, resolveContractServices,
} from "@/lib/contracts/serviceDescription";
import { packageTermsByKey } from "@/lib/contracts/servicePackages";
import { contractTermsFromInquiry, imageCommitmentOnRecord, inquirySelectsExpedited, normalizeContractTerms } from "@/lib/extension/contractTerms";
import { factsFromInquiry, normalizeExtractedFacts } from "@/lib/extension/sessionFacts";
import { PRICING_CATALOG } from "@/lib/pricingCatalog";
import { NO_CONTRACT_TERMS, NO_FACTS, type InvoiceInquiry, type SessionFacts } from "@/lib/invoiceDraft/types";

const TWO_WEEKS = "delivered within two weeks through an online gallery.";

const inquiry = (over: Partial<InvoiceInquiry> = {}): InvoiceInquiry => ({
  id: 9001, name: "Example Client", email: "client@example.test", school: null, location: "San Francisco",
  people: "2", session_type: "Couples Session", message: "", date_in_mind: null, ...over,
});
const email = (facts: Partial<SessionFacts>): SessionFacts => ({ ...NO_FACTS, source: "email", email_status: "read", ...facts });
const images = (count: number, per_person = false, verified = true) => ({ ...NO_CONTRACT_TERMS, images: { count, per_person, verified } });
const expedited = (selection: "selected" | "removed" | "unclear" | "none", source: "email" | "inquiry" | null = "email") =>
  ({ ...NO_CONTRACT_TERMS, expedited_gallery: { selection, source } });
const rushSelected = { selection: "selected" as const, source: "email" as const, source_message: 2, included_in_total: null, total_fee_message: null };

describe("single-package services", () => {
  const CASES: [string, string, number][] = [
    ["engagement", "Engagement photography session", 70],
    ["proposal", "Proposal photography session", 50],
    ["maternity", "Maternity photography session", 30],
    ["family", "Family photography session", 10],
    ["extended-family", "Extended family photography session", 30],
    ["elopement", "Elopement photography coverage", 60],
  ];
  for (const [type, title, minimum] of CASES) {
    it(`${type}: minimum of ${minimum}`, () => {
      const services = contractServicesFor(inquiry({ session_type: null }), email({ session_type: type }));
      expect(services.text).toBe(`${title}. Minimum of ${minimum} edited images ${TWO_WEEKS}`);
      expect(services.serviceKey).toBe(type);
    });
  }

  it("is ready when nothing needs checking", () => {
    const services = contractServicesFor(inquiry({ session_type: null }), email({ session_type: "engagement" }));
    expect(services).toMatchObject({ status: "ready", reviewReasons: [], packageKey: "engagement" });
  });
});

describe("couples packages", () => {
  it("names the mini with its 30 minutes and 25 images, never a graduation", () => {
    const services = contractServicesFor(inquiry({ message: "We'd love the mini session" }), NO_FACTS);
    expect(services.text).toBe(`Couples Mini photography session — 30 minutes. Minimum of 25 edited images ${TWO_WEEKS}`);
    expect(services).toMatchObject({ serviceKey: "couples", packageKey: "couples-mini" });
  });

  it("gives the hour 40 and the Signature 60, with the catalog's own length wording", () => {
    const hour = contractServicesFor(inquiry({ message: "the 1 hour session please" }), NO_FACTS);
    expect(hour.text).toBe(`Couples photography session — 1 hour. Minimum of 40 edited images ${TWO_WEEKS}`);
    expect(hour.status).toBe("ready");
    const signature = contractServicesFor(inquiry({ message: "the signature session" }), NO_FACTS);
    expect(signature.text).toBe(`Couples Signature photography session — 75-90 minutes. Minimum of 60 edited images ${TWO_WEEKS}`);
  });

  it("does not read a stray mini, hour or signature as a named package", () => {
    for (const message of ["a shoot with our mini schnauzer", "we live an hour away", "see my email signature"]) {
      const services = contractServicesFor(inquiry({ message }), NO_FACTS);
      expect(services.status).toBe("review");
      expect(services.reviewReasons.join(" ")).toMatch(/no couples package is clearly named/i);
    }
    const form = contractServicesFor(inquiry({ message: "— Session request —\nPackage: 30-Min Mini Session" }), NO_FACTS);
    expect(form).toMatchObject({ status: "ready", packageKey: "couples-mini" });
  });

  it("sends a couples booking that names no package to review instead of promising the hour silently", () => {
    const services = contractServicesFor(inquiry({ message: "photos for our anniversary" }), NO_FACTS);
    expect(services.status).toBe("review");
    expect(services.reviewReasons.join(" ")).toMatch(/no couples package/i);
    expect(services.text).toContain("Minimum of 40 edited images");
  });

  it("flags a thread length that disagrees with the package the draft priced", () => {
    const services = contractServicesFor(inquiry({ message: "the 1 hour session" }), email({ package: { status: "selected", minutes: 30, source_message: 2 } }));
    expect(services.status).toBe("review");
    expect(services.reviewReasons.join(" ")).toMatch(/30-minute/);
  });
});

describe("graduation", () => {
  const grad = (over: Partial<InvoiceInquiry> = {}) => inquiry({ session_type: "Graduation Portrait", school: "SF State", people: "1", message: "grad photos in May", ...over });

  it("applies the contract-only 30-image default and says the rate card disagrees", () => {
    const services = contractServicesFor(grad(), NO_FACTS);
    expect(GRADUATION_CONTRACT_DEFAULT_IMAGES).toBe(30);
    expect(PRICING_CATALOG.graduation.standardMinimumImages).toBe(50);
    expect(services.text).toBe(`Graduation photography session for one graduate. Minimum of 30 edited images ${TWO_WEEKS}`);
    expect(services.status).toBe("review");
    expect(services.reviewReasons.join(" ")).toMatch(/30.*50|50.*30/);
  });

  it("lets a 50-image agreement on record win, with no default notice", () => {
    const services = contractServicesFor(grad({ message: "the 1 hour session" }), email({ contract_terms: images(50) }));
    expect(services.text).toBe(`Graduation photography session — 1 hour for one graduate. Minimum of 50 edited images ${TWO_WEEKS}`);
    expect(services).toMatchObject({ status: "ready", reviewReasons: [] });
  });

  it("resolves the mini as its own package and asks for its count", () => {
    const services = contractServicesFor(grad({ message: "the 30 minute mini please" }), NO_FACTS);
    expect(services.text).toBe(`Graduation Mini photography session — 30 minutes for one graduate. Minimum of 50 edited images ${TWO_WEEKS}`);
    expect(services).toMatchObject({ serviceKey: "graduation", packageKey: "graduation-mini", status: "review" });
    expect(services.reviewReasons.join(" ")).toMatch(/Graduation Mini.*confirm/i);
  });

  it("writes the handoff's mini wording when 50 images are on record", () => {
    const services = contractServicesFor(grad({ message: "the 30 minute mini please" }), email({ contract_terms: images(50) }));
    expect(services.text).toBe(`Graduation Mini photography session — 30 minutes for one graduate. Minimum of 50 edited images ${TWO_WEEKS}`);
    expect(services.status).toBe("ready");
  });

  it("keeps a group's minimum per person and never the individual default", () => {
    const services = contractServicesFor(grad({ people: "4" }), NO_FACTS);
    expect(services.text).toBe(`Graduation group photography session for 4 graduates. Minimum of 25 edited images per person ${TWO_WEEKS}`);
    expect(services).toMatchObject({ packageKey: "graduation-group", status: "ready" });
  });

  it("writes nothing while the package is undecided", () => {
    const services = contractServicesFor(grad({ message: "the 1 hour session, or the 30 minute mini if cheaper" }), NO_FACTS);
    expect(services.text).toBe("");
    expect(services.status).toBe("review");
  });
});

describe("unknown and custom sessions", () => {
  it("gives an unpriced session no fallback promise", () => {
    const services = contractServicesFor(inquiry({ session_type: null }), email({ session_type: "event" }));
    expect(services).toMatchObject({ text: "", status: "review", packageKey: null });
    expect(services.text).not.toMatch(/Minimum of/);
  });

  it("does not turn a bare mini with no session type into a package", () => {
    const services = contractServicesFor(inquiry({ session_type: null, message: "a mini for $325" }), NO_FACTS);
    expect(services.text).toBe("");
  });

  it("knows the small-event minimum only when that package is named outright", () => {
    expect(describePackage(packageTermsByKey("small-event")!)).toBe(`Small event photography coverage. Minimum of 30 edited images ${TWO_WEEKS}`);
    expect(packageTermsByKey("large-event")).toBeNull();
  });

  it("writes the sports offer's own deliverables, never a graduation minimum", () => {
    const team = inquiry({ session_type: "Graduation Portrait", school: null, people: "8", message: "senior portraits for our soccer team" });
    const services = contractServicesFor(team, email({ session_type: "senior-portraits", sports_team_offer: true, people: 8, package: { status: "selected", minutes: 60, source_message: 3 } }));
    expect(services.text).toBe("Team senior portrait photography session for 8 people — 1 hour. 5 edited portraits per person (2 headshots and 3 full-body) delivered within two weeks through an online gallery.");
    expect(services.packageKey).toBe("sports-team-offer");
  });

  it("leaves ordinary senior portraits for a person", () => {
    const services = contractServicesFor(inquiry({ session_type: null, people: "3" }), email({ session_type: "senior-portraits", people: 3 }));
    expect(services).toMatchObject({ text: "", status: "review" });
  });
});

describe("custom commitments", () => {
  const engagement = (terms: SessionFacts["contract_terms"], over: Partial<SessionFacts> = {}) =>
    contractServicesFor(inquiry({ session_type: null }), email({ session_type: "engagement", contract_terms: terms, ...over }));

  it("writes a higher count that is on record, and asks that it be confirmed for this package", () => {
    const services = engagement(images(100));
    expect(services.text).toContain("Minimum of 100 edited images");
    expect(services.status).toBe("review");
    expect(services.reviewReasons.join(" ")).toMatch(/more than the package minimum of 70/);
    expect(engagement(images(70))).toMatchObject({ status: "ready", reviewReasons: [] });
  });

  it("never lowers a package minimum on a count from the thread", () => {
    const services = engagement(images(40));
    expect(services.text).toContain("Minimum of 70 edited images");
    expect(services.reviewReasons.join(" ")).toMatch(/40 edited images, lower than/);
  });

  it("keeps the package minimum when the count cannot be found in the photographer's messages", () => {
    const services = engagement(images(100, false, false));
    expect(services.text).toContain("Minimum of 70 edited images");
    expect(services.status).toBe("review");
  });

  it("says so when the thread was not fully read", () => {
    for (const email_status of ["unavailable", "partial", "unparsed"] as const) {
      const services = engagement(NO_CONTRACT_TERMS, { email_status });
      expect(services.status).toBe("review");
      expect(services.reviewReasons.join(" ")).toMatch(/email thread/i);
    }
  });

  it("rejects malformed model terms", () => {
    expect(normalizeContractTerms({ count: "lots" }, { status: "yes" }, null)).toEqual(NO_CONTRACT_TERMS);
    expect(normalizeContractTerms({ count: 100000 }, null, null).images).toBeNull();
    expect(normalizeContractTerms({ count: 60, per_person: true }, { status: "selected" }, null)).toEqual({
      images: { count: 60, per_person: true, verified: false }, expedited_gallery: { selection: "selected", source: "email" },
    });
  });

  it("verifies a count only against what the photographer wrote", () => {
    const thread = [{ direction: "client" as const, body: "Could we get 80 edited images?" }, { direction: "photographer" as const, body: "Yes! You'll get a minimum of 60 edited images." }];
    expect(imageCommitmentOnRecord(60, thread)).toBe(true);
    expect(imageCommitmentOnRecord(80, thread)).toBe(false);
  });

  it("does not take a length, a headcount or the Rush Preview's images for a gallery count", () => {
    const said = (body: string) => [{ direction: "photographer" as const, body }];
    expect(imageCommitmentOnRecord(60, said("It is a 60 minute photo session."))).toBe(false);
    expect(imageCommitmentOnRecord(60, said("60 minutes of photos around campus."))).toBe(false);
    expect(imageCommitmentOnRecord(1, said("the 1 hour photo session"))).toBe(false);
    expect(imageCommitmentOnRecord(8, said("all 8 players in photos"))).toBe(false);
    expect(imageCommitmentOnRecord(60, said("The session is $60 photos extra."))).toBe(false);
    expect(imageCommitmentOnRecord(5, said("Rush Preview: 5 edited images within 48 hours."))).toBe(false);
    expect(imageCommitmentOnRecord(5, said("I can send 5 edited images in 48 hours."))).toBe(false);
    expect(imageCommitmentOnRecord(60, said("You get 60+ professionally edited photos."))).toBe(true);
  });

  it("carries the terms through the facts normalizer", () => {
    const facts = normalizeExtractedFacts({ session_type: "engagement", image_commitment: { count: 80, per_person: false }, expedited_gallery: { status: "selected" } });
    expect(facts.contract_terms).toEqual({ images: { count: 80, per_person: false, verified: false }, expedited_gallery: { selection: "selected", source: "email" } });
  });
});

describe("extras", () => {
  const proposal = (over: Partial<SessionFacts> = {}, message = "") =>
    contractServicesFor(inquiry({ session_type: null, message }), email({ session_type: "proposal", ...over }));
  const RUSH_LINE = "Rush Preview: 5 edited images delivered within 48 hours.";

  it("adds a selected Rush Preview as its own milestone without inflating the minimum", () => {
    const services = proposal({ rush_preview: rushSelected });
    expect(services.text).toBe(`Proposal photography session. Minimum of 50 edited images ${TWO_WEEKS}\n${RUSH_LINE}`);
    expect(services.status).toBe("ready");
  });

  it("writes it once however often it was repeated, and keeps a form selection through email silence", () => {
    const message = "— Session request —\nPackage: Proposal Session\nAdd-ons: Rush preview\nEstimated total: $825";
    const fromForm = contractServicesFor(inquiry({ session_type: "Couples Session", message }), factsFromInquiry(inquiry({ message })));
    expect(fromForm.text.match(/Rush Preview/g)).toHaveLength(1);
    const repeated = normalizeExtractedFacts({ session_type: "proposal", rush_preview: { status: "selected", source_message: 1 } }, { messageCount: 3, inquiryMessage: message });
    expect(contractServicesFor(inquiry({ message }), repeated).text.match(/Rush Preview/g)).toHaveLength(1);
  });

  it("leaves out a cancelled, offered or unclear Rush Preview", () => {
    expect(proposal({ rush_preview: { ...rushSelected, selection: "removed" } }).text).not.toContain("Rush Preview");
    expect(proposal().text).not.toContain("Rush Preview");
    const unclear = proposal({ rush_preview: { ...rushSelected, selection: "unclear" } });
    expect(unclear.text).not.toContain("Rush Preview");
    expect(unclear.status).toBe("review");
  });

  it("does not write a couples add-on into a family session", () => {
    const services = contractServicesFor(inquiry({ session_type: null }), email({ session_type: "family", rush_preview: rushSelected }));
    expect(services.text).not.toContain("Rush Preview");
    expect(services.status).toBe("review");
  });

  it("replaces the gallery deadline for a 72-hour delivery and flags the price", () => {
    const services = proposal({ contract_terms: expedited("selected") });
    expect(services.text).toBe("Proposal photography session. Minimum of 50 edited images delivered within 72 hours through an online gallery.");
    expect(services.reviewReasons.join(" ")).toMatch(/72-hour.*total/i);
  });

  it("states both milestones when both apply", () => {
    const services = proposal({ contract_terms: expedited("selected"), rush_preview: rushSelected });
    expect(services.text).toBe(`Proposal photography session. Minimum of 50 edited images delivered within 72 hours through an online gallery.\n${RUSH_LINE}`);
  });

  it("keeps two weeks when the faster delivery was cancelled or only discussed", () => {
    expect(proposal({ contract_terms: expedited("removed") }).text).toContain("two weeks");
    const unclear = proposal({ contract_terms: expedited("unclear") });
    expect(unclear.text).toContain("two weeks");
    expect(unclear.status).toBe("review");
  });

  it("reads the form's add-on line for the 72-hour delivery and lists the others for review", () => {
    const message = "— Session request —\nPackage: Proposal Session\nAdd-ons: 72-hour delivery, Extra outfit\nEstimated total: $975";
    expect(inquirySelectsExpedited(message)).toBe(true);
    expect(inquirySelectsExpedited("Is 72-hour delivery available?")).toBe(false);
    const services = proposal({ contract_terms: contractTermsFromInquiry(message) }, message);
    expect(services.text).toContain("72 hours");
    expect(services.text).not.toContain("outfit");
    expect(services.reviewReasons.join(" ")).toContain("Extra outfit");
  });

  it("keeps the catalog wording these lines are written from", () => {
    expect(PRICING_CATALOG.couples.addOns.rushPreview.label).toContain("5 edited images within 48 hours");
    expect(PRICING_CATALOG.couples.addOns.expedited.label).toContain("72 hours");
    expect(PRICING_CATALOG.standardTurnaroundDays).toBe(14);
  });
});

describe("result shape", () => {
  it("changes identity with the package and stays bounded", () => {
    const mini = contractServicesFor(inquiry({ message: "the mini" }), NO_FACTS);
    const hour = contractServicesFor(inquiry({ message: "the 1 hour session" }), NO_FACTS);
    expect(mini.identity).not.toBe(hour.identity);
    expect(mini.text.length).toBeLessThanOrEqual(1200);
  });

  it("is reusable from an already resolved session", () => {
    expect(typeof resolveContractServices).toBe("function");
  });
});
