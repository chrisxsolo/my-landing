// lib/bookingIntent.ts
// Standardized hand-off between pricing estimators / CTAs and the inquiry form.
// Every entry point (estimators, school pages, pricing CTAs) serializes a
// BookingIntent into the /contact query string; the contact page parses it back
// to prefill the form and show the client a read-only "Your session request"
// summary so they never have to rebuild the quote they just configured.

import { formatCurrency } from "./pricing";

export type BookingIntent = {
  sourcePage?: string;
  sessionType?: string;
  package?: string;
  school?: string;
  date?: string;
  headcount?: number;
  duration?: string;
  location?: string;
  addOns?: string[];
  estimatedTotal?: number;
};

// Query-param keys — one source of truth so serialize/parse never drift.
const PARAM = {
  source: "source",
  sessionType: "sessionType",
  package: "package",
  school: "school",
  date: "date",
  headcount: "headcount",
  duration: "duration",
  location: "location",
  addOn: "addOn", // repeated key — one entry per add-on
  estimatedTotal: "estimatedTotal",
} as const;

// Legacy key kept only for parsing — older links passed `graduates`.
const LEGACY_HEADCOUNT_PARAM = "graduates";

export function buildBookingIntentParams(intent: BookingIntent): URLSearchParams {
  const params = new URLSearchParams();
  if (intent.sourcePage) params.set(PARAM.source, intent.sourcePage);
  if (intent.sessionType) params.set(PARAM.sessionType, intent.sessionType);
  if (intent.package) params.set(PARAM.package, intent.package);
  if (intent.school) params.set(PARAM.school, intent.school);
  if (intent.date) params.set(PARAM.date, intent.date);
  if (typeof intent.headcount === "number") params.set(PARAM.headcount, String(intent.headcount));
  if (intent.duration) params.set(PARAM.duration, intent.duration);
  if (intent.location) params.set(PARAM.location, intent.location);
  for (const addOn of intent.addOns ?? []) params.append(PARAM.addOn, addOn);
  if (typeof intent.estimatedTotal === "number") {
    params.set(PARAM.estimatedTotal, String(intent.estimatedTotal));
  }
  return params;
}

// Accepts anything with the read surface of URLSearchParams (incl. Next's
// ReadonlyURLSearchParams from useSearchParams).
type ReadableParams = Pick<URLSearchParams, "get" | "getAll">;

export function parseBookingIntent(params: ReadableParams): BookingIntent {
  const intent: BookingIntent = {};

  const source = params.get(PARAM.source);
  if (source) intent.sourcePage = source;

  const sessionType = params.get(PARAM.sessionType);
  if (sessionType) intent.sessionType = sessionType;

  const pkg = params.get(PARAM.package);
  if (pkg) intent.package = pkg;

  const school = params.get(PARAM.school);
  if (school) intent.school = school;

  const date = params.get(PARAM.date);
  if (date) intent.date = date;

  const headcountRaw = params.get(PARAM.headcount) ?? params.get(LEGACY_HEADCOUNT_PARAM);
  const headcount = headcountRaw ? Number(headcountRaw) : NaN;
  if (Number.isFinite(headcount) && headcount > 0) intent.headcount = headcount;

  const duration = params.get(PARAM.duration);
  if (duration) intent.duration = duration;

  const location = params.get(PARAM.location);
  if (location) intent.location = location;

  const addOns = params.getAll(PARAM.addOn).filter(Boolean);
  if (addOns.length) intent.addOns = addOns;

  const totalRaw = params.get(PARAM.estimatedTotal);
  const total = totalRaw ? Number(totalRaw) : NaN;
  if (Number.isFinite(total) && total > 0) intent.estimatedTotal = total;

  return intent;
}

// Maps a numeric headcount onto the contact form's <select> option values
// ("1", "2", "3", "4", "5+"). This is the fix for the old graduates→"2 people"
// mismatch that left the controlled select blank.
export function headcountToSelectValue(headcount: number): string {
  if (headcount <= 1) return "1";
  if (headcount >= 5) return "5+";
  return String(headcount);
}

export function hasBookingIntent(intent: BookingIntent): boolean {
  return Boolean(
    intent.sessionType ||
      intent.package ||
      intent.school ||
      intent.location ||
      intent.headcount ||
      intent.duration ||
      intent.addOns?.length ||
      intent.estimatedTotal,
  );
}

// Plain-text block appended to the inquiry message so the configured details
// (add-ons, duration, estimated total) reach the photographer — these are
// otherwise dropped, since the inquiries table has no columns for them.
export function formatBookingIntentSummary(intent: BookingIntent): string {
  const lines: string[] = [];
  if (intent.sessionType) lines.push(`Session type: ${intent.sessionType}`);
  if (intent.package) lines.push(`Package: ${intent.package}`);
  if (intent.school) lines.push(`School / Location: ${intent.school}`);
  if (intent.location) lines.push(`Location: ${intent.location}`);
  if (intent.headcount) lines.push(`Headcount: ${intent.headcount}`);
  if (intent.duration) lines.push(`Session length: ${intent.duration}`);
  if (intent.addOns?.length) lines.push(`Add-ons: ${intent.addOns.join(", ")}`);
  if (intent.estimatedTotal) lines.push(`Estimated total: ${formatCurrency(intent.estimatedTotal)}`);
  if (!lines.length) return "";
  return `— Session request —\n${lines.join("\n")}`;
}
