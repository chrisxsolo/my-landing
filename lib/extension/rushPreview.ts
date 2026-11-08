// The Rush preview add-on for the Pixieset extension: recognised from the
// inquiry form and the labelled thread, priced from the catalog alone, and
// resolved into one charge both extension flows consume. Nothing here does
// arithmetic on model text; the figure comes from PRICING_CATALOG and the
// decision from validated evidence. Unresolved cases become "review".

import { PRICING_CATALOG, formatFee } from "../pricingCatalog";
import {
  NO_RUSH_PREVIEW, RUSH_PREVIEW_SELECTIONS, type RushPreviewEvidence, type RushPreviewSelection, type SessionFacts,
} from "../invoiceDraft/types";

const ADD_ON = PRICING_CATALOG.couples.addOns.rushPreview;
export const RUSH_PREVIEW_CENTS = ADD_ON.price * 100;
export const RUSH_PREVIEW_LABEL = ADD_ON.shortLabel;

/** The services whose rate card carries the couples add-ons. */
export const RUSH_PREVIEW_SERVICES: ReadonlySet<string> = new Set(["couples", "engagement", "proposal"]);

export const RUSH_PREVIEW_CHARGE_KINDS = ["none", "add", "included", "review"] as const;
export type RushPreviewChargeKind = (typeof RUSH_PREVIEW_CHARGE_KINDS)[number];

/** The resolved add-on as the extension receives it. */
export interface RushPreviewCharge {
  kind: RushPreviewChargeKind;
  /** The service the charge was resolved for; the browser refuses a mismatch. */
  service: string | null;
  /** Cents to add ("add"), cents already inside the total ("included"), 0 for "none", null for "review". */
  amountCents: number | null;
  label: string;
  /** What to show next to the price, or why the total must be confirmed. Null for "none". */
  note: string | null;
}

export interface RushPreviewContext {
  serviceKey: string | null;
  /** Rate-card package price in cents, or null when the rate card cannot price it. */
  baseCents: number | null;
  /** Travel due on top of the package, in cents (0 when none). */
  travelCents: number;
}

const money = (cents: number) => formatFee(cents / 100);

// ─── inquiry form ────────────────────────────────────────────────────────────

/**
 * Whether the estimator's "Add-ons: …" line (lib/bookingIntent.ts
 * formatBookingIntentSummary) names Rush preview. Only that structured
 * line is read; prose mentions elsewhere in the message never count. The
 * line may have lost its line breaks, so it ends at the next labelled line
 * or at the end of the text.
 */
export function inquirySelectsRushPreview(message: string | null | undefined): boolean {
  const text = String(message ?? "");
  const match = /add-?ons?\s*:\s*([\s\S]*?)(?=\s*(?:estimated total|session type|package|location|headcount|session length)\s*(?:\(|:)|\n|$)/i.exec(text);
  if (!match) return false;
  const label = RUSH_PREVIEW_LABEL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${label}\\b`, "i").test(match[1]);
}

// ─── model output ────────────────────────────────────────────────────────────

const isSelection = (v: unknown): v is RushPreviewSelection => typeof v === "string" && (RUSH_PREVIEW_SELECTIONS as readonly string[]).includes(v);

/** A 1-based transcript index, or null for anything outside the transcript. */
function messageIndex(raw: unknown, messageCount: number): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= messageCount ? raw : null;
}

/** The model's rush_preview object and total_fee_message, checked and coerced. */
export function normalizeRushPreviewEvidence(rawRush: unknown, rawTotalMessage: unknown, messageCount: number): RushPreviewEvidence {
  const r = (rawRush && typeof rawRush === "object" ? rawRush : {}) as Record<string, unknown>;
  const selection = isSelection(r.status) ? r.status : "none";
  if (selection === "none") return { ...NO_RUSH_PREVIEW, total_fee_message: messageIndex(rawTotalMessage, messageCount) };
  return {
    selection,
    source: "email",
    source_message: messageIndex(r.source_message, messageCount),
    included_in_total: typeof r.in_total === "boolean" ? r.in_total : null,
    total_fee_message: messageIndex(rawTotalMessage, messageCount),
  };
}

/**
 * The form's selection stands when the thread never mentions the add-on;
 * an explicit later selection, removal or conflict in email overrides it.
 * A selection made on the form and repeated in email is still one selection.
 */
export function mergeRushPreviewEvidence(fromEmail: RushPreviewEvidence, inquirySelected: boolean): RushPreviewEvidence {
  if (fromEmail.selection !== "none" || !inquirySelected) return fromEmail;
  return { ...fromEmail, selection: "selected", source: "inquiry", source_message: null };
}

// ─── resolution ──────────────────────────────────────────────────────────────

function charge(kind: RushPreviewChargeKind, service: string | null, note: string | null): RushPreviewCharge {
  const amountCents = kind === "review" ? null : kind === "none" ? 0 : RUSH_PREVIEW_CENTS;
  return { kind, service, amountCents, label: RUSH_PREVIEW_LABEL, note };
}

/** Which total the thread's figure equals: the bare package, the package with the add-on, or neither. */
function figureMatches(agreedCents: number, ctx: RushPreviewContext): "package" | "with_add_on" | "ambiguous" | "neither" {
  if (ctx.baseCents === null) return "neither";
  const bare = ctx.baseCents + ctx.travelCents;
  // When travel costs exactly what the add-on costs, "$825" could be either.
  if (ctx.travelCents === RUSH_PREVIEW_CENTS && (agreedCents === bare || agreedCents === bare + RUSH_PREVIEW_CENTS)) return "ambiguous";
  if (agreedCents === bare) return "package";
  if (agreedCents === bare + RUSH_PREVIEW_CENTS) return "with_add_on";
  return "neither";
}

function selectedAfter(evidence: RushPreviewEvidence): boolean | null {
  if (evidence.source_message === null || evidence.total_fee_message === null) return null;
  return evidence.source_message > evidence.total_fee_message;
}

function addNote(evidence: RushPreviewEvidence, agreedCents: number | null): string {
  const amount = money(RUSH_PREVIEW_CENTS);
  if (evidence.source === "inquiry") {
    const figure = agreedCents === null ? "" : ` The ${money(agreedCents)} in the thread is the package alone.`;
    return `${RUSH_PREVIEW_LABEL}: +${amount} — selected on the inquiry form.${figure}`;
  }
  const figure = agreedCents === null ? "" : ` The ${money(agreedCents)} in the thread was written without it.`;
  return `${RUSH_PREVIEW_LABEL}: +${amount} — requested by the client in email.${figure}`;
}

function resolveSelected(facts: SessionFacts, evidence: RushPreviewEvidence, agreedCents: number | null, ctx: RushPreviewContext): RushPreviewCharge {
  const service = ctx.serviceKey;
  if (agreedCents === null) return charge("add", service, addNote(evidence, null));
  const figure = money(agreedCents);
  const match = figureMatches(agreedCents, ctx);
  const said = evidence.included_in_total;
  const includedNote = `The ${figure} total from the thread already includes the ${money(RUSH_PREVIEW_CENTS)} ${RUSH_PREVIEW_LABEL}.`;
  if (match === "ambiguous") {
    return charge("review", service, `The thread's ${figure} could be the session with ${RUSH_PREVIEW_LABEL} or with the ${money(ctx.travelCents)} travel fee. Confirm the total before filling.`);
  }
  if (said === true) {
    if (match === "package") return charge("review", service, `The thread says ${figure} includes ${RUSH_PREVIEW_LABEL}, but ${figure} is the package price alone. Confirm the total before filling.`);
    return charge("included", service, includedNote);
  }
  if (said === false) {
    if (match === "with_add_on") return charge("review", service, `The thread says ${figure} leaves out ${RUSH_PREVIEW_LABEL}, yet ${figure} is the package plus the add-on. Confirm the total before filling.`);
    return charge("add", service, addNote(evidence, agreedCents));
  }
  if (match === "package") {
    // A bare all-in total the photographer wrote AFTER the request may mean
    // the add-on was waived or forgotten; only a reviewer can say.
    if (facts.total_kind === "agreed_total" && selectedAfter(evidence) === false) {
      return charge("review", service, `The client asked for ${RUSH_PREVIEW_LABEL} before ${figure} was written as the total. Confirm whether the ${money(RUSH_PREVIEW_CENTS)} add-on still applies before filling.`);
    }
    return charge("add", service, addNote(evidence, agreedCents));
  }
  if (match === "with_add_on") return charge("included", service, includedNote);
  if (selectedAfter(evidence) === true) return charge("add", service, addNote(evidence, agreedCents));
  return charge("review", service, `The thread quotes ${figure} and the client asked for ${RUSH_PREVIEW_LABEL}. Confirm whether ${figure} includes the ${money(RUSH_PREVIEW_CENTS)} add-on before filling.`);
}

function resolveRemoved(evidence: RushPreviewEvidence, agreedCents: number | null, ctx: RushPreviewContext): RushPreviewCharge {
  const service = ctx.serviceKey;
  if (agreedCents === null || evidence.included_in_total === false) return charge("none", service, null);
  const match = figureMatches(agreedCents, ctx);
  if (match === "package") return charge("none", service, null);
  if (evidence.included_in_total !== true && selectedAfter(evidence) === false) return charge("none", service, null);
  return charge("review", service, `The client cancelled ${RUSH_PREVIEW_LABEL} after ${money(agreedCents)} was written. Confirm whether that total still includes the ${money(RUSH_PREVIEW_CENTS)} add-on before filling.`);
}

/**
 * One charge from the facts: nothing, the catalog amount on top, already
 * inside the thread's total, or a review reason. The figure the thread
 * wrote (facts.total_fee) is compared with the rate card, never recomputed.
 */
export function resolveRushPreview(facts: SessionFacts, ctx: RushPreviewContext): RushPreviewCharge {
  const evidence = facts.rush_preview ?? NO_RUSH_PREVIEW;
  const service = ctx.serviceKey;
  if (evidence.selection === "none") return charge("none", service, null);
  if (!service || !RUSH_PREVIEW_SERVICES.has(service)) {
    return charge("review", service, `${RUSH_PREVIEW_LABEL} is a couples add-on, but the thread mentions it for a ${service ?? "unpriced"} session. Confirm the total before filling.`);
  }
  if (evidence.selection === "unclear") {
    return charge("review", service, `The thread mentions ${RUSH_PREVIEW_LABEL} but whether it was added is unclear. Confirm the total before filling.`);
  }
  const agreedCents = facts.total_fee === null ? null : Math.round(facts.total_fee * 100);
  return evidence.selection === "removed" ? resolveRemoved(evidence, agreedCents, ctx) : resolveSelected(facts, evidence, agreedCents, ctx);
}
