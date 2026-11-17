// The contract's Description of Services for one booking: what is being
// photographed, the image minimum, when the gallery is delivered and the
// extras the client confirmed. Deterministic: it is rendered from the same
// validated facts and resolved session the invoice is built from, and never
// from model prose. Anything it cannot stand behind is a review reason for
// the photographer, shown beside the text and never written into it.

import { z } from "zod";
import { RUSH_PREVIEW_SERVICES, inquiryAddOnsLine, resolveRushPreview, type RushPreviewCharge } from "../extension/rushPreview";
import { sessionEvidenceFrom } from "../invoiceDraft/build";
import { resolveSession, type ResolvedSession } from "../invoiceDraft/session";
import type { ImageCommitment, InvoiceInquiry, SessionFacts } from "../invoiceDraft/types";
import { PRICING_CATALOG } from "../pricingCatalog";
import { packageTermsFor, type PackageTerms } from "./servicePackages";

export { GRADUATION_CONTRACT_DEFAULT_IMAGES } from "./servicePackages";

export const SERVICES_TEXT_MAX_CHARS = 1200;
const MAX_REASONS = 8;
const MAX_REASON_CHARS = 400;
const MAX_LISTED_ADD_ONS = 6;
const MAX_ADD_ON_CHARS = 40;

/** The add-ons' own terms, as the catalog labels state them (a test pins the two together). */
const RUSH_PREVIEW_LINE = "Rush Preview: 5 edited images delivered within 48 hours.";
const EXPEDITED_DEADLINE = "72 hours";
const NUMBER_WORDS = ["zero", "one", "two", "three", "four"];

export const contractServicesSchema = z.object({
  /** The paragraph for [DESCRIPTION_OF_SERVICES]; empty when a person has to write it. */
  text: z.string().max(SERVICES_TEXT_MAX_CHARS),
  status: z.enum(["ready", "review"]),
  reviewReasons: z.array(z.string().min(1).max(MAX_REASON_CHARS)).max(MAX_REASONS),
  serviceKey: z.string().min(1),
  packageKey: z.string().nullable(),
  /** Changes whenever the facts the text was written from change. */
  identity: z.string().min(1).max(200),
}).refine((services) => services.status === "review" || (services.text.length > 0 && services.reviewReasons.length === 0), {
  message: "a ready description has text and no review reasons",
});
export type ContractServices = z.infer<typeof contractServicesSchema>;

export interface ContractServicesInput {
  /** The session exactly as the invoice draft resolved it. */
  session: ResolvedSession;
  facts: SessionFacts;
  /** The inquiry's own words (session type and message). */
  inquiryText: string;
  /** The Rush preview charge the draft settled on. */
  rush: RushPreviewCharge;
}

function standardDeadline(): string {
  const days = PRICING_CATALOG.standardTurnaroundDays;
  const weeks = days / 7;
  return Number.isInteger(weeks) && NUMBER_WORDS[weeks] ? `${NUMBER_WORDS[weeks]} week${weeks === 1 ? "" : "s"}` : `${days} days`;
}

/** One package's sentence: "<title>. Minimum of N edited images delivered within <deadline> through an online gallery." */
export function describePackage(terms: PackageTerms, deadline: string = standardDeadline()): string {
  const promise = terms.deliverables ?? `Minimum of ${terms.minimumImages} edited images${terms.perPerson ? " per person" : ""}`;
  return `${terms.title}. ${promise} delivered within ${deadline} through an online gallery.`;
}

interface Part<T> { value: T; reasons: string[] }

/**
 * The package with the booking's own image count, when the photographer is
 * on record for one. A count that cannot be found in their messages never
 * replaces the package's, a lower one never lowers a package minimum, and a
 * higher one is written and flagged: being on record proves the number was
 * written, not which package it was written about.
 */
function applyCommitment(terms: PackageTerms, commitment: ImageCommitment | null): Part<PackageTerms> {
  if (!commitment) return { value: terms, reasons: terms.defaultReasons };
  const stated = `${commitment.count} edited images${commitment.per_person ? " per person" : ""}`;
  if (!commitment.verified) {
    return { value: terms, reasons: [...terms.defaultReasons, `The thread may promise ${stated}, but that count was not found in the photographer's messages. Confirm the image count before filling.`] };
  }
  if (terms.minimumImages === null) {
    return { value: terms, reasons: [`The thread promises ${stated}. Check the description against it before filling.`] };
  }
  const custom = { ...terms, minimumImages: commitment.count, perPerson: commitment.per_person };
  const packageCount = `${terms.minimumImages}${terms.perPerson ? " per person" : ""}`;
  if (commitment.per_person !== terms.perPerson) {
    return { value: custom, reasons: [`The thread promises ${stated}, while the package minimum is ${packageCount}. Confirm which applies before filling.`] };
  }
  if (commitment.count === terms.minimumImages) return { value: terms, reasons: [] };
  const lower = commitment.count < terms.minimumImages;
  // A package whose own count is only a default takes the thread's count; a lower one is still flagged.
  if (terms.defaultReasons.length) {
    return { value: custom, reasons: lower ? [`The thread promises ${stated}, lower than the usual ${packageCount}. Confirm the count before filling.`] : [] };
  }
  if (lower) {
    return { value: terms, reasons: [`The thread mentions ${stated}, lower than the package minimum of ${packageCount}. The package minimum is shown; change it only if the lower count was agreed.`] };
  }
  return { value: custom, reasons: [`The thread promises ${stated}, more than the package minimum of ${packageCount}. Confirm it was promised for this package before filling.`] };
}

/** When the full gallery is due: 72 hours only for a delivery the client selected on a service that sells it. */
function resolveDeadline(terms: PackageTerms, facts: SessionFacts): Part<string> {
  const { selection } = facts.contract_terms.expedited_gallery;
  if (selection === "unclear") {
    return { value: standardDeadline(), reasons: ["The thread mentions faster gallery delivery, but whether it was added is unclear. The standard delivery is shown; confirm it before filling."] };
  }
  if (selection !== "selected") return { value: standardDeadline(), reasons: [] };
  if (!terms.expeditedOffered) {
    return { value: standardDeadline(), reasons: ["The client selected 72-hour gallery delivery, which this session's rate card does not offer. The standard delivery is shown; confirm what was agreed."] };
  }
  return { value: EXPEDITED_DEADLINE, reasons: ["72-hour gallery delivery is written into the description. The total shown does not add that add-on by itself; confirm the total covers it."] };
}

/** The Rush Preview milestone, written once and only for a standing selection on a service that sells it. */
function resolveRushLine(session: ResolvedSession, facts: SessionFacts, rush: RushPreviewCharge): Part<string | null> {
  const { selection } = facts.rush_preview;
  if (selection === "none" || selection === "removed") return { value: null, reasons: [] };
  if (!session.serviceKey || !RUSH_PREVIEW_SERVICES.has(session.serviceKey)) {
    return { value: null, reasons: ["Rush Preview is a couples add-on and this is a different session, so it is not written into the description. Confirm what was agreed."] };
  }
  if (selection === "unclear") {
    return { value: null, reasons: ["The thread mentions Rush Preview, but whether it was added is unclear. It is not in the description; add it by hand if it was confirmed."] };
  }
  const flagged = rush.kind === "review" ? ["Rush Preview is written into the description, but whether it still applies is flagged with the total. Confirm it before filling."] : [];
  return { value: RUSH_PREVIEW_LINE, reasons: flagged };
}

/** Add-ons on the form's own line that this description does not write: named for the reviewer, never promised. */
function otherAddOnReasons(inquiryText: string): string[] {
  const line = inquiryAddOnsLine(inquiryText);
  if (!line) return [];
  const others = line.split(",").map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item && !/rush preview/i.test(item) && !/\b72[\s-]*h/i.test(item))
    .slice(0, MAX_LISTED_ADD_ONS).map((item) => item.slice(0, MAX_ADD_ON_CHARS));
  return others.length ? [`The inquiry form also selected: ${others.join(", ")}. These are not written into the description; add them by hand if they were confirmed.`] : [];
}

/** What the description could be missing because the thread was not read in full. */
function evidenceReasons(facts: SessionFacts): string[] {
  const missing = "so an agreed image count, delivery date or add-on may be missing from the description";
  switch (facts.email_status) {
    case "unavailable": return [`The email thread was not read, ${missing}.`];
    case "partial": return [`Part of the email thread could not be loaded, ${missing}.`];
    case "unparsed": return [`The email thread could not be interpreted, ${missing}.`];
    default: return facts.email_coverage?.omitted ? [`Older messages in the email thread were not read, ${missing}.`] : [];
  }
}

function finish(text: string, reasons: string[], session: ResolvedSession, packageKey: string | null, facts: SessionFacts): ContractServices {
  const reviewReasons = [...new Set(reasons)].slice(0, MAX_REASONS).map((reason) => reason.slice(0, MAX_REASON_CHARS));
  const { images, expedited_gallery } = facts.contract_terms;
  const identity = [
    session.serviceKey ?? "unknown", packageKey ?? "none", session.people, session.durationMinutes ?? "open",
    images?.verified ? `${images.count}${images.per_person ? "pp" : ""}` : "std", expedited_gallery.selection, facts.rush_preview.selection,
  ].join("|");
  return {
    text: text.slice(0, SERVICES_TEXT_MAX_CHARS), status: reviewReasons.length || !text ? "review" : "ready",
    reviewReasons, serviceKey: session.serviceKey ?? "unknown", packageKey, identity,
  };
}

/**
 * The description for a session that is already resolved. A booking's own
 * agreement wins over the package's terms, which win over the contract
 * default; anything unsettled is a review reason, never a guess.
 */
export function resolveContractServices({ session, facts, inquiryText, rush }: ContractServicesInput): ContractServices {
  const resolved = packageTermsFor(session, facts, inquiryText);
  const context = [...otherAddOnReasons(inquiryText), ...evidenceReasons(facts)];
  if (!resolved.terms) return finish("", [...resolved.reviewReasons, ...context], session, null, facts);
  const counted = applyCommitment(resolved.terms, facts.contract_terms.images);
  const deadline = resolveDeadline(resolved.terms, facts);
  const rushLine = resolveRushLine(session, facts, rush);
  const flagged = session.problems.length ? ["The session type, package or headcount is flagged above. The description follows what is shown; check it once that is settled."] : [];
  const text = [describePackage(counted.value, deadline.value), rushLine.value].filter(Boolean).join("\n");
  const reasons = [...resolved.reviewReasons, ...counted.reasons, ...deadline.reasons, ...rushLine.reasons, ...flagged, ...context];
  return finish(text, reasons, session, resolved.terms.packageKey, facts);
}

/** The description for an inquiry and its facts, resolving the session the way the invoice draft does. */
export function contractServicesFor(inquiry: InvoiceInquiry, facts: SessionFacts, options: { travelCents?: number } = {}): ContractServices {
  const session = resolveSession(inquiry, facts.session_type, facts.package, sessionEvidenceFrom(facts));
  const rush = resolveRushPreview(facts, { serviceKey: session.serviceKey, baseCents: session.baseCents, travelCents: options.travelCents ?? 0 });
  return resolveContractServices({ session, facts, inquiryText: `${inquiry.session_type ?? ""} ${inquiry.message ?? ""}`, rush });
}
