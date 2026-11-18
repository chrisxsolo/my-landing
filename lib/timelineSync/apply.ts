// ─────────────────────────────────────────────────────────────────────────────
// Database writes for the timeline sync. Every write is checked: a change only
// counts as applied when the database confirms a row was updated, and a failed
// write is counted and logged (ids and field names only), never swallowed.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import { advancePortalSessionForDeposit } from "@/lib/adminPortalSessionUpsert";
import { buildBookedAvailabilityNote, CLIENT_SESSION_TABLE } from "@/lib/clientSessions";
import type { InquiryStamps, SessionPlan, SyncInquiry, SyncSession } from "@/lib/timelineSync/plan";

export const INQUIRIES_TABLE = "inquiries";
const AVAILABILITY_TABLE = "availability";

async function updateById(
  supabase: SupabaseClient,
  table: string,
  id: string | number,
  values: Record<string, unknown>,
): Promise<boolean> {
  const { data, error } = await supabase.from(table).update(values).eq("id", id).select("id");
  if (error || !data?.length) {
    console.error(`[timeline-sync] ${table} update failed`, {
      id, fields: Object.keys(values), reason: error?.message ?? "no row updated",
    });
    return false;
  }
  return true;
}

/** Applies portal-session plans, counting only confirmed writes. */
export async function applySessionPlans(
  supabase: SupabaseClient,
  planned: { session: SyncSession; plan: SessionPlan }[],
): Promise<{ applied: number; failed: number }> {
  let applied = 0;
  let failed = 0;
  for (const { session, plan } of planned) {
    if (!Object.keys(plan.updates).length) continue;
    if (await updateById(supabase, CLIENT_SESSION_TABLE, session.id, plan.updates)) applied++;
    else failed++;
  }
  return { applied, failed };
}

export type PlannedInquiry = {
  inquiry: SyncInquiry;
  stamps: InquiryStamps;
  /** Deposit evidence from this run or already stamped on the inquiry. */
  depositEvidence: boolean;
  galleryEvidence: boolean;
  /** Gmail showed activity for this client in this run. */
  activeThisRun: boolean;
  /** The client's portal sessions, as loaded at the start of the run. */
  clientSessions: SyncSession[];
};

/**
 * A shoot date agreed over email: once the deposit is in, the calendar day is
 * marked booked, and the client's single dateless portal session gets the
 * date. Never touches a client with several sessions — that is ambiguous.
 */
async function applyAgreedDate(supabase: SupabaseClient, planned: PlannedInquiry, date: string): Promise<number> {
  const { inquiry, stamps, depositEvidence, clientSessions } = planned;
  let failed = 0;
  if (depositEvidence) {
    const time = (inquiry.preferred_time ?? stamps.preferred_time ?? null) as string | null;
    const { error } = await supabase.from(AVAILABILITY_TABLE).upsert(
      { date, status: "booked", note: buildBookedAvailabilityNote(inquiry.name ?? inquiry.email, time) },
      { onConflict: "date" },
    );
    if (error) {
      console.error("[timeline-sync] availability upsert failed", { inquiryId: inquiry.id, reason: error.message });
      failed++;
    }
  }
  const [only] = clientSessions;
  if (clientSessions.length === 1 && !only.session_date) {
    if (!await updateById(supabase, CLIENT_SESSION_TABLE, only.id, { session_date: date })) failed++;
  }
  return failed;
}

/**
 * A client who paid a deposit but has no portal session gets one at "booked".
 * Only deposit evidence does this — a sent invoice or signed contract never
 * creates a session.
 */
async function ensureSessionForDeposit(supabase: SupabaseClient, planned: PlannedInquiry) {
  const { inquiry, stamps } = planned;
  try {
    const result = await advancePortalSessionForDeposit(supabase, {
      clientEmail: inquiry.email,
      clientName: inquiry.name,
      sessionType: inquiry.session_type,
      sessionDate: inquiry.session_date ?? (stamps.session_date as string | undefined) ?? null,
      location: inquiry.location,
    });
    return { created: result === "created", failed: 0 };
  } catch (error) {
    console.error("[timeline-sync] portal session create failed", {
      inquiryId: inquiry.id, reason: error instanceof Error ? error.message : "unknown error",
    });
    return { created: false, failed: 1 };
  }
}

export async function applyInquiryPlan(
  supabase: SupabaseClient,
  planned: PlannedInquiry,
): Promise<{ stamped: boolean; sessionCreated: boolean; failed: number }> {
  const { inquiry, depositEvidence, galleryEvidence, activeThisRun, clientSessions } = planned;
  let stamps = planned.stamps;
  let failed = 0;

  // The calendar and portal writes go first, and the inquiry's session_date is
  // only recorded once they succeed. The date being empty is what makes a
  // later run plan them again, so a failed side effect is retried, not lost.
  if (typeof stamps.session_date === "string") {
    const sideEffectFailures = await applyAgreedDate(supabase, planned, stamps.session_date);
    failed += sideEffectFailures;
    if (sideEffectFailures) {
      stamps = Object.fromEntries(Object.entries(stamps).filter(([field]) => field !== "session_date"));
    }
  }

  let stamped = false;
  if (Object.keys(stamps).length) {
    stamped = await updateById(supabase, INQUIRIES_TABLE, inquiry.id, stamps);
    if (!stamped) failed++;
  }

  // Only clients Gmail showed activity for this run — an old paid inquiry with
  // no portal session is not something a sync should suddenly create one for.
  let sessionCreated = false;
  if (activeThisRun && depositEvidence && !galleryEvidence && clientSessions.length === 0) {
    const ensured = await ensureSessionForDeposit(supabase, planned);
    sessionCreated = ensured.created;
    failed += ensured.failed;
  }
  return { stamped, sessionCreated, failed };
}
