// One resolution of a booking for both Pixieset documents. The contract
// preview (/api/extension/detect-date) and the invoice draft
// (/api/extension/invoice-draft) call this and nothing else, so the session
// type, date, time, place, headcount and total they show come from the same
// facts through the same rules, not from two readings that can drift apart.

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildInvoiceDraft, validateInvoiceDraft } from "../invoiceDraft/build";
import { parseSessionTime } from "../invoiceDraft/sessionTime";
import { resolveSunset } from "../invoiceDraft/sunset";
import type { InvoiceDraft, InvoiceInquiry, SessionFacts } from "../invoiceDraft/types";
import { bookingWindow } from "./emailThread";
import { sessionFactsForInquiry } from "./sessionFacts";

export const INQUIRIES_TABLE = "inquiries";
export const BOOKING_INQUIRY_COLUMNS = "id, name, email, school, location, people, session_type, message, date_in_mind, created_at";

export type BookingResolution =
  | { ok: true; facts: SessionFacts; draft: InvoiceDraft }
  | { ok: false; error: string };

/**
 * When the same client next submitted the form, if they did. A later booking
 * closes this one's stretch of mail. A failed lookup only leaves the window
 * open at the far end; it never blocks the draft.
 */
async function nextInquiryAt(supabase: SupabaseClient, inquiry: InvoiceInquiry): Promise<string | null> {
  if (!inquiry.created_at || !inquiry.email) return null;
  try {
    const { data, error } = await supabase
      .from(INQUIRIES_TABLE)
      .select("created_at")
      .eq("email", inquiry.email)
      .gt("created_at", inquiry.created_at)
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) throw error;
    return (data?.[0] as { created_at?: string } | undefined)?.created_at ?? null;
  } catch (err) {
    console.error("Extension booking resolution: next-inquiry lookup failed", err instanceof Error ? err.name : "error");
    return null;
  }
}

/**
 * The booking's facts and the draft built from them. Throws only when the
 * thread could not be read at all (the caller answers 502); a draft that
 * fails its own contract is returned as an error, never sent to a browser.
 */
export async function resolveBooking(supabase: SupabaseClient, inquiry: InvoiceInquiry): Promise<BookingResolution> {
  const window = bookingWindow(inquiry.created_at, await nextInquiryAt(supabase, inquiry));
  const facts = await sessionFactsForInquiry(inquiry, { window });

  // Sunset is looked up only when the thread's time needs it, and only by
  // date: nothing about the client leaves this server. A failed lookup never
  // fails the draft; the time is left unresolved for the reviewer instead.
  const timeKind = parseSessionTime(facts.time).kind;
  const needsSunset = timeKind === "golden_hour" || timeKind === "clock";
  const sunset = needsSunset ? await resolveSunset(facts.date) : null;

  const checked = validateInvoiceDraft(buildInvoiceDraft(inquiry, facts, { sunset }));
  return checked.ok ? { ok: true, facts, draft: checked.draft } : { ok: false, error: checked.error };
}
