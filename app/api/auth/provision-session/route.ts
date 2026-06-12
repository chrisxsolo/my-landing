import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/get-user";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { CLIENT_SESSION_TABLE } from "@/lib/clientSessions";
import {
  buildClientSessionInsertSeed,
  type InquirySeedRow,
} from "@/lib/clientSessionInquirySeed";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const email = user.email.toLowerCase().trim();

  // Check for existing session(s) with this email
  const { data: existing } = await admin
    .from(CLIENT_SESSION_TABLE)
    .select("id, client_user_id")
    .ilike("client_email", email);

  if (existing && existing.length > 0) {
    // Link any unlinked sessions to this user
    const unlinked = existing.filter((s: { id: string; client_user_id: string | null }) => !s.client_user_id);
    if (unlinked.length > 0) {
      await admin
        .from(CLIENT_SESSION_TABLE)
        .update({ client_user_id: user.id })
        .in("id", unlinked.map((s: { id: string }) => s.id));
    }
    return NextResponse.json({ ok: true, linked: unlinked.length });
  }

  // No session found — check inquiries table for matching email
  const { data: inquiry } = await admin
    .from("inquiries")
    .select("id,name,email,session_type,session_date,date_in_mind,location,school,booking_confirmed,preferred_time,created_at")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<InquirySeedRow>();

  const sessionRow = inquiry
    ? buildClientSessionInsertSeed(user.id, inquiry)
    : {
        client_user_id: user.id,
        client_email: email,
        client_name: null,
        current_status: "inquiry_received",
      };
  if (!sessionRow) {
    return NextResponse.json({ error: "Inquiry email is invalid." }, { status: 400 });
  }

  const { error } = await admin.from(CLIENT_SESSION_TABLE).insert(sessionRow);
  if (error) {
    console.error("[provision-session]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, created: true, fromInquiry: !!inquiry });
}
