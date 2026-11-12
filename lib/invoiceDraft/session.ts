// Which session is being invoiced, and what the rate card charges for it.
// Every amount comes from PRICING_CATALOG through lib/pricing.ts.

import { classifySession, type PlaybookKey } from "../ai/sessionClassifier";
import {
  COUPLES_PACKAGES, GRAD_PACKAGES, GROUP_MAX_PEOPLE, MINI_MAX_PEOPLE,
  graduationPackageFor, graduationSessionLabel, graduationSessionPrice, includedMinutesFor, isHeadcountPriced,
} from "../pricing";
import { PRICING_CATALOG } from "../pricingCatalog";
import { SUPPORTED_SOLO_MINUTES, choosePackage } from "./packageEvidence";
import { NO_PACKAGE, type PackageEvidence } from "./types";

export type InvoiceServiceKey =
  | "graduation" | "family" | "extended-family" | "couples" | "engagement" | "proposal" | "elopement" | "maternity";

const ITEM_NAMES: Record<InvoiceServiceKey, string> = {
  graduation: "Graduation Session",
  family: "Family Session",
  "extended-family": "Extended Family Session",
  couples: "Couples Session",
  engagement: "Engagement Session",
  proposal: "Proposal Session",
  elopement: "Elopement & Courthouse Ceremony",
  maternity: "Maternity Session",
};

const PRICED_KEYS = new Set<string>(Object.keys(ITEM_NAMES));

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

function serviceKeyFor(inquiry: { session_type: string | null; message: string | null; school: string | null }, fromEmail: string | null): InvoiceServiceKey | null {
  if (fromEmail && PRICED_KEYS.has(fromEmail)) return fromEmail as InvoiceServiceKey;
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

export function resolveSession(
  inquiry: { session_type: string | null; message: string | null; school: string | null; people: string | number | null },
  sessionTypeFromEmail: string | null,
  packageFromEmail: PackageEvidence = NO_PACKAGE,
): ResolvedSession {
  const serviceKey = serviceKeyFor(inquiry, sessionTypeFromEmail);
  const problems: string[] = [];
  if (!serviceKey) {
    problems.push("The session type has no rate-card price. Enter the item and price by hand.");
    return { serviceKey: null, itemName: "Photo Session", description: "", people: 1, baseCents: null, baseOptions: [], ...UNRESOLVED, problems };
  }
  const itemName = ITEM_NAMES[serviceKey];
  const text = `${inquiry.session_type ?? ""} ${inquiry.message ?? ""}`.toLowerCase();
  const people = parseHeadcount(inquiry.people) ?? 1;
  if (serviceKey === "graduation") {
    return people <= MINI_MAX_PEOPLE ? resolveGraduate(text, packageFromEmail) : resolveGraduationGroup(people, text, packageFromEmail);
  }
  const flat = flatPrice(serviceKey, text);
  if (flat.problem) problems.push(flat.problem);
  const single = flat.cents === null ? [] : [{ label: flat.description, baseCents: flat.cents }];
  return {
    serviceKey, itemName, description: flat.description, people, baseCents: flat.cents, baseOptions: single,
    durationMinutes: flat.minutes, packageSource: "catalog", packageNote: null, problems,
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
    return { ...base, baseCents: null, baseOptions: [], ...UNRESOLVED, problems: [problem] };
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
