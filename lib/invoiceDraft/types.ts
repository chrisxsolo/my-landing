// The contract between /api/extension/invoice-draft and the Pixieset
// extension. Money is integer cents; anything negative, non-finite or
// implausibly large is rejected before it reaches a browser.

import { z } from "zod";

/** $100,000: nothing SoloXSnaps invoices comes near it. */
export const MAX_MONEY_CENTS = 10_000_000;

const cents = z.number().int().min(0).max(MAX_MONEY_CENTS);

export const INVOICE_LOCATION_SOURCES = ["email", "inquiry", "school", "unknown"] as const;
export const INVOICE_DATE_CONFIDENCES = ["confirmed", "tentative", "unknown"] as const;
/**
 * Where the session date stands. "proposed" is a date one side asked for and
 * the other has not accepted; "inquiry" is the form's date with nothing in
 * the thread. Only "confirmed" may set a due date.
 */
export const INVOICE_DATE_STATUSES = ["confirmed", "proposed", "conflicting", "inquiry", "unknown"] as const;
export const INVOICE_TRAVEL_KINDS = ["verified", "included", "unknown", "none"] as const;
/** Where the package on the session line came from; "default" is the 60-minute Graduation Session. */
export const INVOICE_PACKAGE_SOURCES = ["email", "inquiry", "default", "catalog", "unresolved"] as const;
/** "calculated" is a golden-hour range worked out from sunset: never "confirmed in email". */
export const INVOICE_TIME_STATUSES = ["confirmed", "proposed", "calculated", "unresolved", "none"] as const;

const isoInstant = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** The session time with its provenance. `requested` keeps the thread's own words. */
export const invoiceTimeDetailSchema = z.object({
  status: z.enum(INVOICE_TIME_STATUSES),
  requested: z.string().nullable(),
  /** Local wall-clock start and end, "HH:MM" in `timeZone`. */
  start: clock.nullable(),
  end: clock.nullable(),
  /** True when the end is the start plus the package length, not something the thread said. */
  endDerived: z.boolean(),
  startUtc: isoInstant.nullable(),
  endUtc: isoInstant.nullable(),
  timeZone: z.string().nullable(),
  zoneAbbreviation: z.string().nullable(),
  sourceLabel: z.string(),
  sunset: z.object({
    local: z.string().min(1),
    utc: isoInstant,
    source: z.string().min(1),
    locality: z.string().min(1),
  }).nullable(),
  /** Why no precise time is offered; set only when status is "unresolved". */
  unresolvedReason: z.string().nullable(),
});
export type InvoiceTimeDetail = z.infer<typeof invoiceTimeDetailSchema>;

export const invoiceDraftSchema = z.object({
  status: z.enum(["ready", "review"]),
  /** Why the draft must be checked before it is filled. Empty when ready. */
  reviewReasons: z.array(z.string().min(1)),
  /** Things to look at that do not block a fill (an unconfirmed due date). */
  warnings: z.array(z.string().min(1)),
  client: z.object({
    inquiryId: z.number().int().positive(),
    // A blank name or an unusable address is a review reason (build.ts
    // clientProblems), never a failed response: the reviewer has to see it.
    name: z.string(),
    email: z.string(),
  }),
  session: z.object({
    serviceKey: z.string().min(1),
    itemName: z.string().min(1),
    description: z.string(),
    quantity: z.literal(1),
    people: z.number().int().min(1),
    school: z.string().nullable(),
    location: z.string().nullable(),
    locationSource: z.enum(INVOICE_LOCATION_SOURCES),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    dateConfidence: z.enum(INVOICE_DATE_CONFIDENCES),
    dateStatus: z.enum(INVOICE_DATE_STATUSES),
    /** The resolved time as shown ("6:30–7:30 pm"); null while unresolved. Never a bare "golden hour". */
    time: z.string().nullable(),
    timeDetail: invoiceTimeDetailSchema,
    /** The booked length in minutes; null when the rate card or the thread leaves it open. */
    durationMinutes: z.number().int().positive().nullable(),
    packageSource: z.enum(INVOICE_PACKAGE_SOURCES),
    /** "Default: 60-minute Graduation Session" and the like; shown beside the price, never filled. */
    packageNote: z.string().nullable(),
  }),
  pricing: z.object({
    currency: z.literal("USD"),
    /**
     * Everything on the session line that is not travel: the package plus
     * any add-on the thread settled (a $750 proposal with Rush preview is
     * 82500). The description names the add-on; there is no separate line.
     */
    baseCents: cents,
    travel: z.object({
      kind: z.enum(INVOICE_TRAVEL_KINDS),
      amountCents: cents.nullable(),
      place: z.string().nullable(),
    }),
    agreedTotalCents: cents.nullable(),
    totalCents: cents.nullable(),
    /**
     * False when the price itself is unsettled (no rate-card price, an
     * undecided package, a thread figure that disagrees with the rate card).
     * The panel then leaves the price empty: baseCents is a reference
     * figure for the reviewer, never something to fill.
     */
    baseConfirmed: z.boolean(),
  }),
  note: z.string(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
}).superRefine((draft, ctx) => {
  const { pricing } = draft;
  if (draft.status === "ready") {
    if (draft.reviewReasons.length) ctx.addIssue({ code: "custom", message: "a ready draft has no review reasons" });
    if (pricing.travel.kind === "unknown") ctx.addIssue({ code: "custom", message: "a ready draft has resolved travel" });
    if (pricing.totalCents === null) ctx.addIssue({ code: "custom", message: "a ready draft has a total" });
  }
  const { time, timeDetail } = draft.session;
  if (timeDetail.status === "unresolved" && (time !== null || !timeDetail.unresolvedReason)) {
    ctx.addIssue({ code: "custom", message: "an unresolved time is null and says why" });
  }
  if (timeDetail.status === "unresolved" && draft.status === "ready") {
    ctx.addIssue({ code: "custom", message: "a ready draft has no unresolved time" });
  }
  if (timeDetail.status === "calculated" && !(time && timeDetail.sunset && timeDetail.start && timeDetail.end)) {
    ctx.addIssue({ code: "custom", message: "a calculated time carries its range and its sunset" });
  }
  if (draft.status === "review" && !draft.reviewReasons.length) {
    ctx.addIssue({ code: "custom", message: "a review draft says why" });
  }
  if (pricing.travel.kind === "verified" && !(pricing.travel.amountCents && pricing.travel.amountCents > 0)) {
    ctx.addIssue({ code: "custom", message: "verified travel has a positive amount" });
  }
  if (pricing.travel.kind === "unknown" && pricing.travel.amountCents !== null) {
    ctx.addIssue({ code: "custom", message: "unknown travel never carries an amount" });
  }
  if (pricing.totalCents !== null && pricing.totalCents !== pricing.baseCents + (pricing.travel.amountCents ?? 0)) {
    ctx.addIssue({ code: "custom", message: "total equals base plus travel" });
  }
  if (pricing.totalCents !== null && !pricing.baseConfirmed) {
    ctx.addIssue({ code: "custom", message: "a total is only given for a confirmed base" });
  }
  if (draft.dueDate !== null && draft.session.dateStatus !== "confirmed") {
    ctx.addIssue({ code: "custom", message: "a due date needs a confirmed session date" });
  }
});

export type InvoiceDraft = z.infer<typeof invoiceDraftSchema>;
export type InvoiceTravel = InvoiceDraft["pricing"]["travel"];

/** The inquiry columns the draft is built from. */
export interface InvoiceInquiry {
  id: number;
  name: string;
  email: string;
  school: string | null;
  location: string | null;
  people: string | number | null;
  session_type: string | null;
  message: string | null;
  date_in_mind: string | null;
  /** When the form was submitted; the reference for a yearless date and the start of the booking's thread. */
  created_at?: string | null;
}

export const TOTAL_KINDS = ["agreed_total", "quote", "unclear"] as const;
export type TotalKind = (typeof TOTAL_KINDS)[number];

export const RUSH_PREVIEW_SELECTIONS = ["selected", "removed", "unclear", "none"] as const;
export type RushPreviewSelection = (typeof RUSH_PREVIEW_SELECTIONS)[number];

/**
 * What the inquiry form and the thread say about the Rush preview add-on.
 * Message numbers index the labelled transcript the model read (1-based),
 * so a selection can be placed before or after the figure in total_fee.
 */
export interface RushPreviewEvidence {
  /** The client's standing choice: "removed" is a cancellation after a selection. */
  selection: RushPreviewSelection;
  /** Where the standing choice came from; null when nothing was selected. */
  source: "inquiry" | "email" | null;
  /** The client's decisive message, when the choice came from email. */
  source_message: number | null;
  /** Whether the thread said total_fee includes the add-on (null = not said). */
  included_in_total: boolean | null;
  /** The message that wrote total_fee, when known. */
  total_fee_message: number | null;
}

export const NO_RUSH_PREVIEW: RushPreviewEvidence = {
  selection: "none", source: null, source_message: null, included_in_total: null, total_fee_message: null,
};

export const PACKAGE_SELECTIONS = ["selected", "conflicting", "unclear", "none"] as const;
export type PackageSelection = (typeof PACKAGE_SELECTIONS)[number];

/**
 * The package or length the thread settled for this booking. A price list
 * naming several packages, a declined package and a bare dollar amount are
 * all "none"; only "none" lets the invoice fall back to a default.
 */
export interface PackageEvidence {
  status: PackageSelection;
  /** The agreed length in minutes; set only when status is "selected". */
  minutes: number | null;
  /** The message that settled it, when known (1-based, like rush_preview). */
  source_message: number | null;
}

export const NO_PACKAGE: PackageEvidence = { status: "none", minutes: null, source_message: null };

export const TIME_STATUSES = ["confirmed", "proposed", "conflicting"] as const;
export type TimeStatus = (typeof TIME_STATUSES)[number];

/**
 * Where one fact stands in the thread, judged on its own evidence:
 * "confirmed" was settled, "proposed" was asked for or offered and not yet
 * accepted, "conflicting" still has more than one candidate on the table.
 * A tentative date never makes a settled fee tentative, or the reverse.
 */
export const FACT_STATUSES = TIME_STATUSES;
export type FactStatus = TimeStatus;

/**
 * How much of the booking's thread the facts rest on. "partial" means some
 * messages could not be fetched; "unparsed" means the thread was read but the
 * model's answer was unusable, so the facts are the inquiry form's.
 */
export type EmailStatus = "read" | "partial" | "unparsed" | "none" | "unavailable";

/** Counts only: nothing here identifies a message or quotes one. */
export interface EmailCoverage {
  /** Messages in the transcript the model read. */
  messages: number;
  /** Messages Gmail listed that could not be fetched. */
  failed: number;
  /** Older messages left out because the transcript is bounded. */
  omitted: number;
  /** Messages whose body was cut at the length limit. */
  truncated: number;
}

/** What the Gmail thread (or, failing that, the inquiry form) said. */
export interface SessionFacts {
  date: string | null;
  readable: string | null;
  /** Whether `date` was agreed, only asked for, or still contested (null = no date from the thread). */
  date_status: FactStatus | null;
  /** A clock time or range, or the client's own phrase ("golden hour"). */
  time: string | null;
  /** Whether `time` was agreed, only proposed, or still contested (null = not said). */
  time_status: TimeStatus | null;
  /** The package or length the thread settled, separate from any dollar amount. */
  package: PackageEvidence;
  location: string | null;
  session_type: string | null;
  /** Dollars, as written in the thread. */
  total_fee: number | null;
  /** Whether total_fee was called the total / all-in price, a quote, or something unclear. */
  total_kind: TotalKind | null;
  /** Whether total_fee was settled as the price, only quoted or asked about, or contested (null = no figure). */
  total_status: FactStatus | null;
  /** Whether the thread said the total includes travel (null = not said). */
  includes_travel: boolean | null;
  /** How many people are being photographed, when the emails say (null = not said). */
  people: number | null;
  /** What the photographer committed to deliver, in a few words (null = not said). */
  deliverables: string | null;
  /**
   * Whether the booking is in scope for the eight-person sports senior
   * offer. Decided in code from the client's own words
   * (lib/ai/sportsTeamPortraitPricing.ts), never by the model.
   */
  sports_team_offer: boolean;
  /** The Rush preview add-on, from the form and the thread together. */
  rush_preview: RushPreviewEvidence;
  /**
   * The model's overall impression. Shown by older extension builds only:
   * no decision reads it, because one tentative field must not discount
   * another that was settled. See date_status, time_status, total_status.
   */
  confidence: "high" | "medium" | "low";
  source: "email" | "inquiry" | "none";
  /** Whether the Gmail thread was read: "unavailable" means Gmail is not connected. */
  email_status: EmailStatus;
  email_coverage: EmailCoverage | null;
  /** Fingerprint of the evidence these facts came from; changes when a message arrives. */
  revision: string | null;
}

export const NO_FACTS: SessionFacts = {
  date: null, readable: null, date_status: null, time: null, time_status: null, package: NO_PACKAGE, location: null, session_type: null,
  total_fee: null, total_kind: null, total_status: null, includes_travel: null, people: null, deliverables: null,
  sports_team_offer: false, rush_preview: NO_RUSH_PREVIEW,
  confidence: "low", source: "none", email_status: "none", email_coverage: null, revision: null,
};

export const invoiceDraftRequestSchema = z.object({
  inquiry_id: z.coerce.number().int().positive(),
});
