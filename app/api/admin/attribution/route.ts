// Admin-only full-funnel attribution. Loads inquiries, payments, visitor
// sessions, and the funnel event stream, then returns the computed report.
// All joins/aggregation happen server-side (content_events can grow large).
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { buildAttributionReport } from "@/lib/attribution/build";
import type {
  FunnelEventLite, InquiryLite, PaymentLite, VisitorSessionRow,
} from "@/lib/attribution/types";

export const dynamic = "force-dynamic";

const INQUIRY_SELECT =
  "id,created_at,anonymous_session_id,session_type,school,location,message,email,payment_status";
const PAYMENT_SELECT = "inquiry_id,amount_cents,status,payment_type,paid_at";
const SESSION_SELECT =
  "anonymous_session_id,landing_page,first_referrer,latest_referrer," +
  "utm_source,utm_medium,utm_campaign,utm_content,first_seen_at";
const EVENT_SELECT = "anonymous_session_id,event_type,viewed_at";
const FUNNEL_EVENT_TYPES = ["page_view", "estimator_complete", "inquiry_submit"];

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const supabase = createSupabaseServerClient();
    const [inq, pay, sess, evt] = await Promise.all([
      supabase.from("inquiries").select(INQUIRY_SELECT).limit(2000),
      supabase.from("payments").select(PAYMENT_SELECT).eq("status", "active").limit(5000),
      supabase.from("visitor_sessions").select(SESSION_SELECT).limit(10000),
      supabase.from("content_events").select(EVENT_SELECT)
        .in("event_type", FUNNEL_EVENT_TYPES).limit(20000),
    ]);

    const firstError = inq.error || pay.error || sess.error || evt.error;
    if (firstError) throw firstError;

    const report = buildAttributionReport({
      inquiries: (inq.data ?? []) as unknown as InquiryLite[],
      payments: (pay.data ?? []) as unknown as PaymentLite[],
      sessions: (sess.data ?? []) as unknown as VisitorSessionRow[],
      events: (evt.data ?? []) as unknown as FunnelEventLite[],
    });

    return NextResponse.json({ report });
  } catch (err) {
    console.error("[admin/attribution] GET failed:", err);
    return NextResponse.json({ error: "Failed to load attribution." }, { status: 500 });
  }
}
