import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/get-user";
import { isAdminUser } from "@/lib/auth/is-admin";
import { CLIENT_SESSION_TABLE } from "@/lib/clientSessions";
import {
  buildClientSessionContactOptions,
  type ClientSessionContactRow,
} from "@/lib/clientSessionContacts";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type InquiryContactRow = {
  id: number;
  name: string | null;
  email: string | null;
  session_type: string | null;
  session_date: string | null;
  date_in_mind: string | null;
  location: string | null;
  school: string | null;
  created_at: string | null;
};

type SessionContactRow = {
  id: string;
  client_name: string | null;
  client_email: string | null;
  session_type: string | null;
  session_date: string | null;
  location: string | null;
  created_at: string | null;
};

async function requireAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await isAdminUser(user.id))) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { response: null };
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    if (admin.response) return admin.response;

    const supabase = createSupabaseAdminClient();
    const [inquiriesResult, sessionsResult] = await Promise.all([
      supabase
        .from("inquiries")
        .select("id,name,email,session_type,session_date,date_in_mind,location,school,created_at")
        .order("created_at", { ascending: false })
        .limit(200)
        .returns<InquiryContactRow[]>(),
      supabase
        .from(CLIENT_SESSION_TABLE)
        .select("id,client_name,client_email,session_type,session_date,location,created_at")
        .order("created_at", { ascending: false })
        .limit(200)
        .returns<SessionContactRow[]>(),
    ]);

    if (inquiriesResult.error) throw inquiriesResult.error;
    if (sessionsResult.error) throw sessionsResult.error;

    const inquiryRows: ClientSessionContactRow[] = (inquiriesResult.data ?? []).map((row) => ({
      source: "inquiry",
      id: String(row.id),
      name: row.name,
      email: row.email,
      session_type: row.session_type,
      session_date: row.session_date,
      date_in_mind: row.date_in_mind,
      location: row.location,
      school: row.school,
      created_at: row.created_at,
    }));

    const sessionRows: ClientSessionContactRow[] = (sessionsResult.data ?? []).map((row) => ({
      source: "session",
      id: row.id,
      name: row.client_name,
      email: row.client_email,
      session_type: row.session_type,
      session_date: row.session_date,
      location: row.location,
      created_at: row.created_at,
    }));

    return NextResponse.json({
      contacts: buildClientSessionContactOptions([...inquiryRows, ...sessionRows]),
    });
  } catch (err) {
    console.error("[admin/session-contacts]", err);
    return NextResponse.json({ error: "Failed to load client contacts" }, { status: 500 });
  }
}
