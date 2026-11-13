// Which session is being invoiced, and what the rate card charges for it.
// Every amount comes from PRICING_CATALOG through lib/pricing.ts.

import { classifySession, type PlaybookKey } from "../ai/sessionClassifier";
import { EIGHT_PERSON_SPORTS_SENIOR_OFFER, sportsTeamDeliverables, sportsTeamOfferOptions } from "../ai/sportsTeamPortraitPricing";
import {
  COUPLES_PACKAGES, GRAD_PACKAGES, GROUP_MAX_PEOPLE, MINI_MAX_PEOPLE,
  graduationPackageFor, graduationSessionLabel, graduationSessionPrice, includedMinutesFor, isHeadcountPriced,
} from "../pricing";
import { PRICING_CATALOG } from "../pricingCatalog";
import { SUPPORTED_SOLO_MINUTES, choosePackage } from "./packageEvidence";
import { NO_PACKAGE, type PackageEvidence } from "./types";

export type InvoiceServiceKey =
  | "graduation" | "senior-portraits" | "family" | "extended-family" | "couples" | "engagement" | "proposal" | "elopement" | "maternity";

const ITEM_NAMES: Record<InvoiceServiceKey, string> = {
  graduation: "Graduation Session",
  "senior-portraits": "Senior Portraits",
  family: "Family Session",
  "extended-family": "Extended Family Session",
  couples: "Couples Session",
  engagement: "Engagement Session",
  proposal: "Proposal Session",
  elopement: "Elopement & Courthouse Ceremony",
  maternity: "Maternity Session",
};

const PRICED_KEYS = new Set<string>(Object.keys(ITEM_NAMES));
/** Types the thread can name that the rate card does not price: a person quotes them. */
const UNPRICED_EMAIL_TYPES = new Set(["event", "other"]);

const NUMBER_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

export type PackageSource = "email" | "inquiry" | "default" | "catalog" | "unresolved";

export interface ResolvedSession {
  serviceKey: InvoiceServiceKey | null;
  itemName: string;
  description: string;
  people: number;
  /**
   * Rate-card price in cents, or null when the rate card has none, or the
   * evidence names more than one package (see baseOptions).
   */
  baseCents: number | null;
  /** Every package the session could be on; more than one only when the evidence conflicts. */
  baseOptions: BaseOption[];
  /** The booked length; null when it is open or needs a person. */
  durationMinutes: number | null;
  packageSource: PackageSource;
  /** How the package was chosen, for the reviewer ("Default: 60-minute Graduation Session"). */
  packageNote: string | null;
  problems: string[];
  /**
   * Set when the session is quoted per booking, so a total the thread
   * settled is the price (totals.ts negotiatedTotals). `reason`, when set,
   * is shown only if the thread settled no total either.
   */
  handQuoted?: { reason: string | null };
}

/** What the thread adds to the inquiry form about who is being photographed and what was promised. */
export interface SessionEvidence {
  /** Headcount the emails state; it replaces the form's when both exist. */
  people?: number | null;
  /** In scope for the eight-person sports senior offer (decided in lib/ai/sportsTeamPortraitPricing.ts). */
  sportsTeamOffer?: boolean;
  /** What the photographer committed to deliver, in a few words. */
  deliverables?: string | null;
}

export interface BaseOption {
  label: string;
  baseCents: number;
}

/** "Two people", "One person", "12 people". */
export function headcountDescription(people: number): string {
  if (people === 1) return "One person";
  const word = NUMBER_WORDS[people] ?? String(people);
  return `${word} people`;
}

/** The inquiry's group size; null when the field holds nothing usable. */
export function parseHeadcount(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isInteger(value) && value > 0 ? value : null;
  const digits = String(value ?? "").match(/\d+/);
  if (!digits) return null;
  const count = Number(digits[0]);
  return count > 0 ? count : null;
}

const SENIOR_PORTRAIT_WORDS = /\bsenior(?: year)? (?:photos?|photoshoot|portraits?|pictures?|pics|session|shoot)\b|\b(?:high school|college) senior\b/i;
const TEAM_WORDS = /\b(?:team|teammates|players|athletes?|roster|varsity|soccer|football|basketball|baseball|softball|volleyball|lacrosse|swim(?:ming)?|tennis|cheer|wrestling|hockey|water polo)\b/i;
const GRADUATION_WORDS = /\bgraduat|\bgrads?\b|\bcap (?:and|&|n) gown\b|\bcommencement\b/i;

/**
 * Senior portraits for a team, in the client's own words, with nothing about
 * graduating. Read from the message only: the form's one portrait option is
 * "Graduation Portrait", which says nothing about what the client wants.
 */
function isTeamSeniorPortraits(message: string | null): boolean {
  const text = message ?? "";
  return SENIOR_PORTRAIT_WORDS.test(text) && TEAM_WORDS.test(text) && !GRADUATION_WORDS.test(text);
}

/**
 * The service being booked. What the thread says wins over the form, and a
 * thread that names a type the rate card does not price is never turned into
 * a graduation because a school is on file. The shared classifier reads
 * "senior portraits" as graduation; team senior portraits are recognised
 * before it. Where a graduation reading still stands against the client's
 * own words (the thread said graduation, or only "senior" was written),
 * graduationDoubts sends the draft to review rather than letting it be ready.
 */
function serviceKeyFor(
  inquiry: { session_type: string | null; message: string | null; school: string | null }, fromEmail: string | null, sportsTeamOffer: boolean,
): InvoiceServiceKey | null {
  if (fromEmail && PRICED_KEYS.has(fromEmail)) return fromEmail as InvoiceServiceKey;
  if (fromEmail && UNPRICED_EMAIL_TYPES.has(fromEmail)) return null;
  if (sportsTeamOffer || isTeamSeniorPortraits(inquiry.message)) return "senior-portraits";
  const text = `${inquiry.session_type ?? ""} ${inquiry.message ?? ""}`.toLowerCase();
  const key: PlaybookKey | null = classifySession(inquiry.session_type, inquiry.message).key;
  if (key === "family" && /\bextended family\b/.test(text)) return "extended-family";
  if (key && PRICED_KEYS.has(key)) return key as InvoiceServiceKey;
  if (!key && inquiry.school) return "graduation";
  return null;
}

function flatPrice(service: InvoiceServiceKey, text: string): { cents: number | null; description: string; minutes: number | null; problem: string | null } {
  const dollars = (n: number) => n * 100;
  switch (service) {
    case "family": {
      const pkg = PRICING_CATALOG.families.packages.standard;
      return { cents: dollars(pkg.price), description: `${pkg.durationMinutes}-minute session`, minutes: pkg.durationMinutes, problem: null };
    }
    case "extended-family": {
      const pkg = PRICING_CATALOG.families.packages.extended;
      return { cents: dollars(pkg.price), description: `${pkg.durationMinutes}-minute session`, minutes: pkg.durationMinutes, problem: null };
    }
    case "maternity":
      return { cents: dollars(PRICING_CATALOG.maternity.price), description: `${PRICING_CATALOG.maternity.durationMinutes}-minute session`, minutes: PRICING_CATALOG.maternity.durationMinutes, problem: null };
    case "couples": {
      const pkg = /\bsignature\b/.test(text) ? COUPLES_PACKAGES.signature : /\bmini\b/.test(text) ? COUPLES_PACKAGES.mini : COUPLES_PACKAGES["1hr"];
      return { cents: dollars(pkg.price), description: pkg.durationLabel, minutes: pkg.durationMinutes, problem: null };
    }
    case "engagement":
      return { cents: dollars(COUPLES_PACKAGES.engagement.price), description: COUPLES_PACKAGES.engagement.durationLabel, minutes: COUPLES_PACKAGES.engagement.durationMinutes, problem: null };
    case "proposal":
      return { cents: dollars(COUPLES_PACKAGES.proposal.price), description: COUPLES_PACKAGES.proposal.durationLabel, minutes: null, problem: null };
    case "elopement":
      return {
        cents: dollars(PRICING_CATALOG.elopement.startingPrice), description: PRICING_CATALOG.elopement.durationLabel,
        minutes: PRICING_CATALOG.elopement.durationMinutes,
        problem: "Elopement coverage starts at the base price and is quoted per booking. Confirm the total.",
      };
    default:
      return { cents: null, description: "", minutes: null, problem: null };
  }
}

const UNRESOLVED = { durationMinutes: null, packageSource: "unresolved" as const, packageNote: null };

/**
 * Reasons a graduation price must be looked at before it is filled. The
 * rate card is still shown, but never as "ready": the client's own words say
 * senior or team portraits and nothing about graduating, or the headcount
 * that sets the price came from the emails rather than the form.
 */
function graduationDoubts(message: string | null, fromEmail: string | null, evidence: SessionEvidence, stated: number | null): string[] {
  const doubts: string[] = [];
  const text = message ?? "";
  if (evidence.sportsTeamOffer || isTeamSeniorPortraits(message)) {
    doubts.push("The thread reads as a graduation session, but the client's own words describe senior portraits for a team. Confirm the session type and price before filling.");
  } else if (fromEmail !== "graduation" && SENIOR_PORTRAIT_WORDS.test(text) && !GRADUATION_WORDS.test(text)) {
    doubts.push("The inquiry asks for senior portraits and does not mention graduating. The graduation rate card is shown; confirm the session type and price before filling.");
  }
  if (evidence.people != null && evidence.people !== (stated ?? 1)) {
    const form = stated === null ? "the inquiry form gives no headcount" : `the inquiry form says ${stated}`;
    doubts.push(`The emails say ${evidence.people} ${evidence.people === 1 ? "person" : "people"}, but ${form}. The price uses ${evidence.people}; confirm the headcount before filling.`);
  }
  return doubts;
}

export function resolveSession(
  inquiry: { session_type: string | null; message: string | null; school: string | null; people: string | number | null },
  sessionTypeFromEmail: string | null,
  packageFromEmail: PackageEvidence = NO_PACKAGE,
  evidence: SessionEvidence = {},
): ResolvedSession {
  const serviceKey = serviceKeyFor(inquiry, sessionTypeFromEmail, evidence.sportsTeamOffer === true);
  const problems: string[] = [];
  if (!serviceKey) {
    problems.push("The session type has no rate-card price. Enter the item and price by hand.");
    return { serviceKey: null, itemName: "Photo Session", description: "", people: 1, baseCents: null, baseOptions: [], ...UNRESOLVED, problems, handQuoted: { reason: null } };
  }
  const itemName = ITEM_NAMES[serviceKey];
  const text = `${inquiry.session_type ?? ""} ${inquiry.message ?? ""}`.toLowerCase();
  const stated = parseHeadcount(inquiry.people);
  const people = evidence.people ?? stated ?? 1;
  if (serviceKey === "graduation") {
    const graduation = people <= MINI_MAX_PEOPLE ? resolveGraduate(text, packageFromEmail) : resolveGraduationGroup(people, text, packageFromEmail);
    return { ...graduation, problems: [...graduation.problems, ...graduationDoubts(inquiry.message, sessionTypeFromEmail, evidence, stated)] };
  }
  if (serviceKey === "senior-portraits") return resolveSeniorPortraits(people, packageFromEmail, evidence);
  const flat = flatPrice(serviceKey, text);
  if (flat.problem) problems.push(flat.problem);
  const single = flat.cents === null ? [] : [{ label: flat.description, baseCents: flat.cents }];
  return {
    serviceKey, itemName, description: flat.description, people, baseCents: flat.cents, baseOptions: single,
    durationMinutes: flat.minutes, packageSource: "catalog", packageNote: null, problems,
  };
}

const SENIOR_HAND_QUOTED = { reason: "Senior portraits are quoted per booking and the thread has not settled a total. Enter the agreed price by hand." };

const sportsOptionLabel = (minutes: number) => `${minutes}-minute sports senior session`;

/**
 * Senior portraits have no rate-card price: the total is whatever the thread
 * settled. The one exception is the approved eight-person sports senior
 * offer, and only for a booking in that offer's own scope; no other
 * headcount and no ordinary senior session ever takes its rates.
 */
function resolveSeniorPortraits(people: number, packageFromEmail: PackageEvidence, evidence: SessionEvidence): ResolvedSession {
  const base = { serviceKey: "senior-portraits" as const, itemName: ITEM_NAMES["senior-portraits"], people, problems: [] as string[] };
  const minutes = packageFromEmail.status === "selected" ? packageFromEmail.minutes : null;
  const describe = (delivered: string | null) => [headcountDescription(people), minutes ? `${minutes}-minute session` : null, delivered].filter(Boolean).join(", ");
  const promised = evidence.deliverables?.trim() || null;
  const inOffer = evidence.sportsTeamOffer === true && people === EIGHT_PERSON_SPORTS_SENIOR_OFFER.headcount;
  if (!inOffer) {
    return {
      ...base, description: describe(promised), baseCents: null, baseOptions: [], durationMinutes: minutes,
      packageSource: minutes ? "email" : "unresolved", packageNote: null, handQuoted: SENIOR_HAND_QUOTED,
    };
  }
  const offered = sportsTeamDeliverables();
  const delivered = promised ?? `${offered.perPerson} edited portraits per person (${offered.headshotsPerPerson} headshots, ${offered.fullBodyPerPerson} full-body)`;
  const options = sportsTeamOfferOptions();
  const chosen = options.find((option) => option.durationMinutes === minutes);
  if (!chosen) {
    // No settled length shows both options and prices neither; a length the offer does not have is quoted by hand.
    const open = minutes ? [] : options.map((option) => ({ label: sportsOptionLabel(option.durationMinutes), baseCents: option.total * 100 }));
    return { ...base, description: describe(delivered), baseCents: null, baseOptions: open, ...UNRESOLVED, handQuoted: SENIOR_HAND_QUOTED };
  }
  return {
    ...base, description: describe(delivered), baseCents: chosen.total * 100,
    baseOptions: [{ label: sportsOptionLabel(chosen.durationMinutes), baseCents: chosen.total * 100 }],
    durationMinutes: chosen.durationMinutes, packageSource: "email",
    packageNote: `Selected in email: eight-person sports senior offer, $${chosen.perPerson} per person`,
    handQuoted: SENIOR_HAND_QUOTED,
  };
}

function packageOption(people: number, minutes: number): BaseOption[] {
  const price = graduationSessionPrice(people, minutes);
  return price === null ? [] : [{ label: graduationSessionLabel(people, minutes), baseCents: price * 100 }];
}

const SOURCE_WORDS = { email: "Selected in email", inquiry: "Selected on the inquiry", default: "Default" } as const;

/**
 * One graduate. The thread's agreed package wins, then the inquiry's; with no
 * choice anywhere the invoice is the 60-minute Graduation Session, labelled
 * as a default. Lengths that disagree, or one the rate card does not sell,
 * stay unpriced for a person: a default never papers over real evidence.
 */
function resolveGraduate(text: string, packageFromEmail: PackageEvidence): ResolvedSession {
  const base = { serviceKey: "graduation" as const, itemName: ITEM_NAMES.graduation, people: 1 };
  const headcount = headcountDescription(1);
  const choice = choosePackage(text, packageFromEmail);
  if (choice.status === "conflicting" || choice.status === "unclear") {
    const lengths = choice.status === "conflicting" && choice.lengths.length ? choice.lengths : [GRAD_PACKAGES.mini.durationMinutes, GRAD_PACKAGES.standard.durationMinutes];
    const where = choice.source === "email" ? "email thread" : "inquiry";
    const problem = choice.status === "conflicting"
      ? `The ${where} names more than one session length. Confirm which package was booked before filling.`
      : `The ${where} mentions a session length, but not as a clear choice. Confirm which package was booked before filling.`;
    return { ...base, description: headcount, baseCents: null, baseOptions: [...lengths].sort((a, b) => a - b).flatMap((m) => packageOption(1, m)), ...UNRESOLVED, problems: [problem] };
  }
  if (!SUPPORTED_SOLO_MINUTES.includes(choice.minutes)) {
    const problem = `The ${choice.source === "email" ? "email thread" : "inquiry"} asks for a ${choice.minutes}-minute session, which the rate card does not sell (${SUPPORTED_SOLO_MINUTES.join(", ")} minutes). Confirm the length and price by hand.`;
    return { ...base, description: headcount, baseCents: null, baseOptions: [], ...UNRESOLVED, problems: [problem] };
  }
  const [option] = packageOption(1, choice.minutes);
  const packageKey = graduationPackageFor(choice.minutes);
  const packageNote = choice.source === "default"
    ? `Default: ${choice.minutes}-minute ${GRAD_PACKAGES[packageKey].label}`
    : `${SOURCE_WORDS[choice.source]}: ${option.label}`;
  return {
    ...base, itemName: GRAD_PACKAGES[packageKey].label, description: `${headcount}, ${option.label}`,
    baseCents: option.baseCents, baseOptions: [option],
    durationMinutes: choice.minutes, packageSource: choice.source, packageNote, problems: [],
  };
}

/** A group's included time, or that plus one or two extra half hours. */
const groupLengthsFor = (included: number): number[] => [included, included + 30, included + 60];

/**
 * Two to eight graduates pay the per-graduate rate, which covers the group's
 * included time; a longer agreed length adds the extra-time charge. Nine or
 * more is a hand quote. A length shorter than the group's minimum (a "mini"
 * for three) is priced at the group rate and flagged, never silently fixed.
 */
function resolveGraduationGroup(people: number, text: string, packageFromEmail: PackageEvidence): ResolvedSession {
  const base = { serviceKey: "graduation" as const, itemName: ITEM_NAMES.graduation, description: headcountDescription(people), people };
  if (!isHeadcountPriced(people)) {
    const problem = `A group of ${people} is larger than the rate card prices (up to ${GROUP_MAX_PEOPLE} graduates). Confirm the headcount and quote it by hand.`;
    return { ...base, baseCents: null, baseOptions: [], ...UNRESOLVED, problems: [problem], handQuoted: { reason: null } };
  }
  const included = includedMinutesFor(people);
  const choice = choosePackage(text, packageFromEmail, included);
  const problems: string[] = [];
  if (choice.status === "conflicting" || choice.status === "unclear") {
    problems.push(`The ${choice.source === "email" ? "email thread" : "inquiry"} does not settle the session length. The price shown covers the included ${included} minutes; confirm the length before filling.`);
  } else if (choice.minutes < included) {
    problems.push(`A ${choice.minutes}-minute session is not offered for a group of ${people} (the group rate covers ${included} minutes). Confirm the length before filling.`);
  } else if (!groupLengthsFor(included).includes(choice.minutes)) {
    problems.push(`A ${choice.minutes}-minute session is not a length the rate card prices for a group (${groupLengthsFor(included).join(", ")} minutes). The price shown covers the included ${included} minutes; confirm the length and price by hand.`);
  }
  const settled = choice.status === "explicit" || choice.status === "default";
  const minutes = settled && !problems.length ? choice.minutes : included;
  const baseOptions = packageOption(people, minutes);
  return {
    ...base, baseCents: baseOptions[0]?.baseCents ?? null, baseOptions,
    durationMinutes: problems.length ? null : minutes,
    packageSource: settled && choice.source !== "default" ? choice.source : "catalog", packageNote: null, problems,
  };
}
