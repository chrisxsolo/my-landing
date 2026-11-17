// Which package a booking is on, and what that package promises in a
// contract. Counts and lengths come from PRICING_CATALOG; the one figure
// that does not is the graduation contract default below. Nothing here
// falls back to a generic minimum: a session the rate card does not name
// has no terms, and a person writes its description.

import { sportsTeamDeliverables } from "../ai/sportsTeamPortraitPricing";
import type { ResolvedSession } from "../invoiceDraft/session";
import type { SessionFacts } from "../invoiceDraft/types";
import { PRICING_CATALOG } from "../pricingCatalog";

/**
 * The image minimum a standard individual graduation CONTRACT states when
 * the thread promised no count of its own. Chosen for contracts on
 * 2026-11-08 with the rate card's 50+ in view; the catalog and the public
 * pages are deliberately not changed by it.
 */
export const GRADUATION_CONTRACT_DEFAULT_IMAGES = 30;

export interface PackageTerms {
  packageKey: string;
  /** "Couples Mini photography session — 30 minutes". */
  title: string;
  /** The package minimum; null when `deliverables` states the promise instead. */
  minimumImages: number | null;
  perPerson: boolean;
  /** A fixed deliverables phrase used in place of "Minimum of N edited images". */
  deliverables: string | null;
  /** Whether the service's rate card sells 72-hour full gallery delivery. */
  expeditedOffered: boolean;
  /** Reasons that apply only while the package's own count is used. */
  defaultReasons: string[];
}

export interface PackageResolution {
  /** Null when no package can be named: the description is left to a person. */
  terms: PackageTerms | null;
  reviewReasons: string[];
}

const { graduation, couples, families, maternity, elopement, events } = PRICING_CATALOG;

const terms = (packageKey: string, title: string, minimumImages: number, over: Partial<PackageTerms> = {}): PackageTerms => ({
  packageKey, title, minimumImages, perPerson: false, deliverables: null, expeditedOffered: true, defaultReasons: [], ...over,
});

/** "30 minute session" → "30 minutes"; "1 hour session" → "1 hour". */
const lengthFromLabel = (label: string): string => label.replace(/ minute session$/, " minutes").replace(/ session$/, "");
const lengthWords = (minutes: number): string => (minutes % 60 === 0 ? `${minutes / 60} hour${minutes === 60 ? "" : "s"}` : `${minutes} minutes`);

const MINI_COUNT_REASON = `The Graduation Mini has no confirmed contract image count. The rate card's ${graduation.standardMinimumImages} is shown; confirm the count before filling.`;
const STANDARD_COUNT_REASON = `The graduation contract default of ${GRADUATION_CONTRACT_DEFAULT_IMAGES} edited images is applied, while the public rate card says ${graduation.standardMinimumImages}+. Confirm the count that was promised.`;

const STATIC_TERMS: Readonly<Record<string, PackageTerms>> = {
  "graduation-mini": terms("graduation-mini", `Graduation Mini photography session — ${lengthWords(graduation.packages.mini.durationMinutes)} for one graduate`, graduation.standardMinimumImages, { defaultReasons: [MINI_COUNT_REASON] }),
  "graduation-standard": terms("graduation-standard", "Graduation photography session for one graduate", GRADUATION_CONTRACT_DEFAULT_IMAGES, { defaultReasons: [STANDARD_COUNT_REASON] }),
  "couples-mini": terms("couples-mini", `Couples Mini photography session — ${lengthFromLabel(couples.packages.mini.durationLabel)}`, couples.packages.mini.minimumImages),
  "couples-1hr": terms("couples-1hr", `Couples photography session — ${lengthFromLabel(couples.packages["1hr"].durationLabel)}`, couples.packages["1hr"].minimumImages),
  "couples-signature": terms("couples-signature", `Couples Signature photography session — ${lengthFromLabel(couples.packages.signature.durationLabel)}`, couples.packages.signature.minimumImages),
  engagement: terms("engagement", "Engagement photography session", couples.packages.engagement.minimumImages),
  proposal: terms("proposal", "Proposal photography session", couples.packages.proposal.minimumImages),
  maternity: terms("maternity", "Maternity photography session", maternity.minimumImages),
  family: terms("family", "Family photography session", families.packages.standard.minimumImages),
  "extended-family": terms("extended-family", "Extended family photography session", families.packages.extended.minimumImages),
  elopement: terms("elopement", "Elopement photography coverage", elopement.minimumImages, { expeditedOffered: false }),
  "small-event": terms("small-event", "Small event photography coverage", events.smallEvent.minimumImages, { expeditedOffered: false }),
};

/** The terms of a package named outright (for a caller that already knows which one applies). */
export function packageTermsByKey(packageKey: string): PackageTerms | null {
  return STATIC_TERMS[packageKey] ?? null;
}

const explicitLength = (session: ResolvedSession): string | null =>
  session.durationMinutes !== null && (session.packageSource === "email" || session.packageSource === "inquiry") ? lengthWords(session.durationMinutes) : null;

function graduationTerms(session: ResolvedSession): PackageResolution {
  if (session.people > graduation.headcountRules.miniMaxPeople) {
    const length = explicitLength(session);
    const title = `Graduation group photography session for ${session.people} graduates${length ? ` — ${length}` : ""}`;
    const handQuoted = session.people > graduation.headcountRules.groupMaxPeople
      ? [`A group of ${session.people} is quoted by hand. Confirm the agreed scope before filling.`] : [];
    return { terms: terms("graduation-group", title, graduation.groupMinimumImagesPerPerson, { perPerson: true }), reviewReasons: handQuoted };
  }
  if (session.durationMinutes === null) {
    return { terms: null, reviewReasons: ["The graduation package is not settled, so no description is written. Write it here once the package is confirmed."] };
  }
  if (session.durationMinutes === graduation.packages.mini.durationMinutes) return { terms: STATIC_TERMS["graduation-mini"], reviewReasons: [] };
  const length = explicitLength(session);
  const standard = STATIC_TERMS["graduation-standard"];
  return { terms: length ? { ...standard, title: `Graduation photography session — ${length} for one graduate` } : standard, reviewReasons: [] };
}

/** A package named as a package: "our mini schnauzer", "an hour away" and "email signature" name nothing. */
const PACKAGE_WORD = String.raw`(?:session|package|shoot)`;
const COUPLES_NAMED = {
  mini: new RegExp(String.raw`\bmini[\s-]+${PACKAGE_WORD}\b|\b30[\s-]*min`, "i"),
  "1hr": new RegExp(String.raw`\b(?:1|one|an)[\s-]*(?:hour|hr)[\s-]+${PACKAGE_WORD}\b|\b60[\s-]*min`, "i"),
  signature: new RegExp(String.raw`\bsignature[\s-]+${PACKAGE_WORD}\b`, "i"),
} as const;

/**
 * The couples package the draft priced. session.ts falls back to the hour
 * when the inquiry names none; a contract may not promise it on that
 * footing, so an unnamed package is shown and sent to review.
 */
function couplesTerms(session: ResolvedSession, facts: SessionFacts, inquiryText: string): PackageResolution {
  const { mini, signature } = couples.packages;
  const key = session.durationMinutes === mini.durationMinutes ? "mini" : session.durationMinutes === signature.durationMinutes ? "signature" : "1hr";
  const settled = facts.package.status === "selected" ? facts.package.minutes ?? 0 : 0;
  const inThread = key === "signature" ? settled >= 75 && settled <= signature.durationMinutes : settled === couples.packages[key].durationMinutes;
  const reviewReasons = COUPLES_NAMED[key].test(inquiryText) || inThread
    ? [] : [`No couples package is clearly named in the inquiry or the thread. The ${couples.packages[key].label} is shown; confirm the package before filling.`];
  return { terms: STATIC_TERMS[`couples-${key}`], reviewReasons };
}

function seniorTerms(session: ResolvedSession, facts: SessionFacts): PackageResolution {
  const offer = sportsTeamDeliverables();
  // The offer's rates and deliverables belong to the offer's own scope: resolveSession prices it only there.
  const inOffer = facts.sports_team_offer && session.baseOptions.length > 0;
  if (!inOffer) {
    return { terms: null, reviewReasons: ["Senior portraits are quoted per booking, so no description is written. Write the agreed deliverables here."] };
  }
  const length = session.durationMinutes === null ? "" : ` — ${lengthWords(session.durationMinutes)}`;
  const deliverables = `${offer.perPerson} edited portraits per person (${offer.headshotsPerPerson} headshots and ${offer.fullBodyPerPerson} full-body)`;
  const promised = facts.deliverables
    ? [`The thread describes the deliverables as "${facts.deliverables}". Check the description against it before filling.`] : [];
  return {
    terms: terms("sports-team-offer", `Team senior portrait photography session for ${session.people} people${length}`, 0, { minimumImages: null, perPerson: true, deliverables, expeditedOffered: false }),
    reviewReasons: promised,
  };
}

/** A thread-settled length that is not the length of the package the draft priced. */
function lengthDisagreement(session: ResolvedSession, facts: SessionFacts, packageTerms: PackageTerms): string[] {
  const { status, minutes } = facts.package;
  if (status === "conflicting" || status === "unclear") return ["The thread does not settle the session length. Confirm the package before filling."];
  if (status !== "selected" || minutes === null || session.durationMinutes === null) return [];
  const signature = packageTerms.packageKey === "couples-signature" && minutes >= 75 && minutes <= couples.packages.signature.durationMinutes;
  if (minutes === session.durationMinutes || signature) return [];
  return [`The thread settled a ${minutes}-minute session, but the description is for the ${session.itemName} package (${session.durationMinutes} minutes). Confirm the package before filling.`];
}

/**
 * The package terms for a resolved session. The service family comes first
 * (from resolveSession, never from a bare "mini", a school or a price), the
 * package second.
 */
export function packageTermsFor(session: ResolvedSession, facts: SessionFacts, inquiryText: string): PackageResolution {
  switch (session.serviceKey) {
    case null:
      return { terms: null, reviewReasons: ["This session type has no package terms, so no description is written. Write the agreed scope here."] };
    case "graduation":
      return graduationTerms(session);
    case "senior-portraits":
      return seniorTerms(session, facts);
    default: {
      const resolved = session.serviceKey === "couples" ? couplesTerms(session, facts, inquiryText) : { terms: STATIC_TERMS[session.serviceKey], reviewReasons: [] };
      const disagreement = resolved.terms ? lengthDisagreement(session, facts, resolved.terms) : [];
      return { terms: resolved.terms, reviewReasons: [...resolved.reviewReasons, ...disagreement] };
    }
  }
}
