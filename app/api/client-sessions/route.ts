import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/get-user";
import {
  CLIENT_SESSION_TABLE,
  type ClientSessionRow,
  toClientSessionDTO,
} from "@/lib/clientSessions";
import {
  buildClientSessionInsertSeed,
  INQUIRIES_TABLE,
  normalizeClientEmail,
  pickNewestInquiry,
  type InquirySeedRow,
} from "@/lib/clientSessionInquirySeed";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function sortSessions(rows: ClientSessionRow[]) {
  return rows.sort((a, b) => {
    const aTime = a.session_date ? new Date(a.session_date).getTime() : 0;
    const bTime = b.session_date ? new Date(b.session_date).getTime() : 0;
    return bTime - aTime;
  });
}

async function fetchRowsByEmail(email: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .select("*")
    .ilike("client_email", email)
    .returns<ClientSessionRow[]>();

  if (error) throw error;
  return data ?? [];
}

async function fetchRowsByUserId(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .select("*")
    .eq("client_user_id", userId)
    .returns<ClientSessionRow[]>();

  if (error) throw error;
  return data ?? [];
}

async function fetchMatchingInquiries(email: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(INQUIRIES_TABLE)
    .select("id,name,email,session_type,session_date,date_in_mind,location,school,created_at")
    .ilike("email", email)
    .returns<InquirySeedRow[]>();

  if (error) throw error;
  return data ?? [];
}

async function linkEmailMatches(userId: string, email: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .update({ client_user_id: userId })
    .is("client_user_id", null)
    .ilike("client_email", email);

  if (error) console.error("[client-sessions] email link failed", error);
}

async function createSessionFromInquiry(userId: string, email: string) {
  const [rowsByUserId, rowsByEmail] = await Promise.all([
    fetchRowsByUserId(userId),
    fetchRowsByEmail(email),
  ]);

  if (rowsByUserId.length > 0 || rowsByEmail.length > 0) {
    return null;
  }

  const inquiries = await fetchMatchingInquiries(email);
  const inquiry = pickNewestInquiry(inquiries);
  if (!inquiry) return null;

  const seed = buildClientSessionInsertSeed(userId, inquiry);
  if (!seed) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .insert(seed)
    .select("*")
    .single<ClientSessionRow>();

  if (error) throw error;
  return data;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email = normalizeClientEmail(user.email);
    if (email) await linkEmailMatches(user.id, email);

    const [byUserId, byEmail] = await Promise.all([
      fetchRowsByUserId(user.id),
      email ? fetchRowsByEmail(email) : Promise.resolve([]),
    ]);

    const rowsById = new Map<string, ClientSessionRow>();
    for (const row of [...byUserId, ...byEmail]) rowsById.set(row.id, row);

    if (rowsById.size === 0 && email) {
      const created = await createSessionFromInquiry(user.id, email);
      if (created) rowsById.set(created.id, created);
    }

    const sessions = sortSessions([...rowsById.values()]).map(toClientSessionDTO);
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("[client-sessions]", err);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
}
