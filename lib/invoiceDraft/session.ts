// Which session is being invoiced, and what the rate card charges for it.
// Every amount comes from PRICING_CATALOG through lib/pricing.ts.

import { classifySession, type PlaybookKey } from "../ai/sessionClassifier";
import {
  COUPLES_PACKAGES, GRAD_PACKAGES, GROUP_MAX_PEOPLE, MINI_MAX_PEOPLE,
  detectGraduationDurationMinutes, graduationSessionLabel, graduationSessionPrice, includedMinutesFor, isHeadcountPriced,
} from "../pricing";
import { PRICING_CATALOG } from "../pricingCatalog";

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

export interface ResolvedSession {
  serviceKey: InvoiceServiceKey | null;
  itemName: string;
  description: string;
  people: number;
  /**
   * Rate-card price in cents, or null when the rate card has none, or cannot
   * choose between packages without the thread (see baseOptions).
   */
  baseCents: number | null;
  /** Every package the session could be on; two for one graduate who named no length. */
  baseOptions: BaseOption[];
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

function flatPrice(service: InvoiceServiceKey, text: string): { cents: number | null; description: string; problem: string | null } {
  const dollars = (n: number) => n * 100;
  switch (service) {
    case "family": {
      const pkg = PRICING_CATALOG.families.packages.standard;
      return { cents: dollars(pkg.price), description: `${pkg.durationMinutes}-minute session`, problem: null };
    }
    case "extended-family": {
      const pkg = PRICING_CATALOG.families.packages.extended;
      return { cents: dollars(pkg.price), description: `${pkg.durationMinutes}-minute session`, problem: null };
    }
    case "maternity":
      return { cents: dollars(PRICING_CATALOG.maternity.price), description: `${PRICING_CATALOG.maternity.durationMinutes}-minute session`, problem: null };
    case "couples": {
      const pkg = /\bsignature\b/.test(text) ? COUPLES_PACKAGES.signature : /\bmini\b/.test(text) ? COUPLES_PACKAGES.mini : COUPLES_PACKAGES["1hr"];
      return { cents: dollars(pkg.price), description: pkg.durationLabel, problem: null };
    }
    case "engagement":
      return { cents: dollars(COUPLES_PACKAGES.engagement.price), description: COUPLES_PACKAGES.engagement.durationLabel, problem: null };
    case "proposal":
      return { cents: dollars(COUPLES_PACKAGES.proposal.price), description: COUPLES_PACKAGES.proposal.durationLabel, problem: null };
    case "elopement":
      return {
        cents: dollars(PRICING_CATALOG.elopement.startingPrice), description: PRICING_CATALOG.elopement.durationLabel,
        problem: "Elopement coverage starts at the base price and is quoted per booking. Confirm the total.",
      };
    default:
      return { cents: null, description: "", problem: null };
  }
}

export function resolveSession(
  inquiry: { session_type: string | null; message: string | null; school: string | null; people: string | number | null },
  sessionTypeFromEmail: string | null,
): ResolvedSession {
  const serviceKey = serviceKeyFor(inquiry, sessionTypeFromEmail);
  const problems: string[] = [];
  if (!serviceKey) {
    problems.push("The session type has no rate-card price. Enter the item and price by hand.");
    return { serviceKey: null, itemName: "Photo Session", description: "", people: 1, baseCents: null, baseOptions: [], problems };
  }
  const itemName = ITEM_NAMES[serviceKey];
  const text = `${inquiry.session_type ?? ""} ${inquiry.message ?? ""}`.toLowerCase();
  if (serviceKey === "graduation") return resolveGraduation(itemName, parseHeadcount(inquiry.people) ?? 1, text, problems);
  const flat = flatPrice(serviceKey, text);
  if (flat.problem) problems.push(flat.problem);
  const single = flat.cents === null ? [] : [{ label: flat.description, baseCents: flat.cents }];
  return { serviceKey, itemName, description: flat.description, people: parseHeadcount(inquiry.people) ?? 1, baseCents: flat.cents, baseOptions: single, problems };
}

/**
 * A graduation session: the per-graduate group rate for 2-8, or for one
 * graduate the package the inquiry names. One graduate who named no length
 * gets both packages as options and no price of its own, so the invoice is
 * never filled with a package nobody chose. Nine or more is a hand quote.
 */
function resolveGraduation(itemName: string, people: number, text: string, problems: string[]): ResolvedSession {
  const serviceKey = "graduation" as const;
  const description = headcountDescription(people);
  if (!isHeadcountPriced(people)) {
    problems.push(`A group of ${people} is larger than the rate card prices (up to ${GROUP_MAX_PEOPLE} graduates). Confirm the headcount and quote it by hand.`);
    return { serviceKey, itemName, description, people, baseCents: null, baseOptions: [], problems };
  }
  const named = detectGraduationDurationMinutes(text);
  const lengths = named !== null
    ? [named]
    : people <= MINI_MAX_PEOPLE ? [GRAD_PACKAGES.mini.durationMinutes, GRAD_PACKAGES.standard.durationMinutes] : [includedMinutesFor(people)];
  const baseOptions = lengths.flatMap((minutes) => {
    const price = graduationSessionPrice(people, minutes);
    return price === null ? [] : [{ label: graduationSessionLabel(people, minutes), baseCents: price * 100 }];
  });
  const only = baseOptions.length === 1 ? baseOptions[0] : null;
  return {
    serviceKey, itemName,
    description: only && people <= MINI_MAX_PEOPLE ? `${description}, ${only.label}` : description,
    people, baseCents: only?.baseCents ?? null, baseOptions, problems,
  };
}
