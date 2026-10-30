// The contract between /api/extension/invoice-draft and the Pixieset
// extension. Money is integer cents; anything negative, non-finite or
// implausibly large is rejected before it reaches a browser.

import { z } from "zod";

/** $100,000: nothing SoloXSnaps invoices comes near it. */
export const MAX_MONEY_CENTS = 10_000_000;

const cents = z.number().int().min(0).max(MAX_MONEY_CENTS);

export const INVOICE_LOCATION_SOURCES = ["email", "inquiry", "school", "unknown"] as const;
export const INVOICE_DATE_CONFIDENCES = ["confirmed", "tentative", "unknown"] as const;
export const INVOICE_TRAVEL_KINDS = ["verified", "included", "unknown", "none"] as const;

export const invoiceDraftSchema = z.object({
  status: z.enum(["ready", "review"]),
  /** Why the draft must be checked before it is filled. Empty when ready. */
  reviewReasons: z.array(z.string().min(1)),
  /** Things to look at that do not block a fill (an unconfirmed due date). */
  warnings: z.array(z.string().min(1)),
  client: z.object({
    inquiryId: z.number().int().positive(),
    name: z.string().min(1),
    email: z.string().email(),
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
    time: z.string().nullable(),
  }),
  pricing: z.object({
    currency: z.literal("USD"),
    baseCents: cents,
    travel: z.object({
      kind: z.enum(INVOICE_TRAVEL_KINDS),
      amountCents: cents.nullable(),
      place: z.string().nullable(),
    }),
    agreedTotalCents: cents.nullable(),
    totalCents: cents.nullable(),
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
}

export const TOTAL_KINDS = ["agreed_total", "quote", "unclear"] as const;
export type TotalKind = (typeof TOTAL_KINDS)[number];

/** What the Gmail thread (or, failing that, the inquiry form) said. */
export interface SessionFacts {
  date: string | null;
  readable: string | null;
  time: string | null;
  location: string | null;
  session_type: string | null;
  /** Dollars, as written in the thread. */
  total_fee: number | null;
  /** Whether total_fee was called the total / all-in price, a quote, or something unclear. */
  total_kind: TotalKind | null;
  /** Whether the thread said the total includes travel (null = not said). */
  includes_travel: boolean | null;
  confidence: "high" | "medium" | "low";
  source: "email" | "inquiry" | "none";
}

export const NO_FACTS: SessionFacts = {
  date: null, readable: null, time: null, location: null, session_type: null,
  total_fee: null, total_kind: null, includes_travel: null, confidence: "low", source: "none",
};

export const invoiceDraftRequestSchema = z.object({
  inquiry_id: z.coerce.number().int().positive(),
});
