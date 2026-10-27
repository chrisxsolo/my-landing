// ─────────────────────────────────────────────────────────────────────────────
// The rate-card inputs a quote is checked against, for one inquiry.
//
// Deterministic and model-free, so the same inputs serve a fresh draft
// (buildEmailContext), a draft restored from storage (/api/admin/drafts) and a
// contract's agreed total (lib/contractPricing). Each surface used to assemble
// its own copy, and a restored draft had none at all: a stored "$70 SJSU
// travel" draft came back with no pricing check, because PricingCheck only
// runs when it is handed these inputs.
// ─────────────────────────────────────────────────────────────────────────────

import { classifySession } from "./sessionClassifier";
import { buildPricingFacts, type PricingFacts } from "./businessFacts";
import { buildThreadDigest, type ThreadMessage } from "./threadDigest";
import { parseQuotedPrices, staleQuotedPrices, type QuoteInput } from "./quotePricing";
import { resolveTravel, schoolImpliesLocationFor, type TravelResolution } from "@/lib/travelResolution";

/** The inquiry fields a quote depends on: the row's columns, or the form's. */
export type QuoteSubject = {
  sessionType?: string | null;
  message?: string | null;
  school?: string | null;
  location?: string | null;
  people?: string | number | null;
};

export type InquiryQuote = {
  playbook: string | null;
  facts: PricingFacts;
  travel: TravelResolution;
  input: QuoteInput;
  /** Thread prices only an outdated travel figure explains; not quotable. */
  stalePrices: number[];
};

export type InquiryQuoteOptions = {
  /** The email thread, so a price built on a superseded travel fee is caught. */
  messages?: readonly ThreadMessage[];
  /** Earlier quotes the admin confirmed as agreed for this client. */
  confirmedPrices?: readonly number[];
  /** A travel resolution the caller already settled, used instead of resolving one. */
  travel?: TravelResolution;
};

/**
 * Where the camera goes for this inquiry. The school stands in for the shoot
 * location only for a graduation, the same rule the contract applies.
 */
export function resolveInquiryTravel(subject: QuoteSubject, playbook: string | null): TravelResolution {
  return resolveTravel({
    school: subject.school,
    location: subject.location,
    message: subject.message,
    schoolImpliesLocation: schoolImpliesLocationFor(playbook),
  });
}

export function buildQuoteInputForInquiry(subject: QuoteSubject, options: InquiryQuoteOptions = {}): InquiryQuote {
  const message = subject.message ?? "";
  const playbook = classifySession(subject.sessionType, message).key;
  const facts = buildPricingFacts({ sessionType: subject.sessionType, message, people: subject.people });
  const travel = options.travel ?? resolveInquiryTravel(subject, playbook);
  const messages = options.messages ?? [];
  const confirmedPrices = [...(options.confirmedPrices ?? [])];

  const input: QuoteInput = {
    playbook,
    people: subject.people != null ? String(subject.people) : null,
    basePrices: facts.basePrices,
    addOnPrices: facts.addOnPrices,
    travel,
    confirmedPrices,
  };
  const quoted = parseQuotedPrices(buildThreadDigest([...messages]).quotedPrices);
  return { playbook, facts, travel, input, stalePrices: staleQuotedPrices(quoted, input, messages) };
}
