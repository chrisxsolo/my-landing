import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/get-user";
import {
  buildClientSessionMatchKey,
  CLIENT_SESSION_TABLE,
  escapeIlikePattern,
  type ClientSessionRow,
  toClientSessionDTO,
} from "@/lib/clientSessions";
import {
  buildClientSessionSyncFields,
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
    .ilike("client_email", escapeIlikePattern(email))
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
    .select("id,name,email,session_type,session_date,date_in_mind,location,school,preferred_time,booking_confirmed,created_at")
    .ilike("email", escapeIlikePattern(email))
    .returns<InquirySeedRow[]>();

  if (error) throw error;
  return data ?? [];
}

function matchingInquiry(row: ClientSessionRow, inquiries: InquirySeedRow[]) {
  const target = buildClientSessionMatchKey({
    clientEmail: row.client_email,
    sessionType: row.session_type,
    sessionDate: row.session_date,
  });
  return inquiries.find((inquiry) => {
    const candidate = buildClientSessionMatchKey({
      clientEmail: inquiry.email,
      sessionType: inquiry.session_type,
      sessionDate: inquiry.session_date ?? inquiry.date_in_mind,
    });
    return candidate.sessionDate === target.sessionDate
      && candidate.sessionType === target.sessionType;
  }) ?? null;
}

async function reconcileRows(rows: ClientSessionRow[], inquiries: InquirySeedRow[]) {
  const supabase = createSupabaseAdminClient();
  return Promise.all(rows.map(async (row) => {
    const inquiry = matchingInquiry(row, inquiries);
    if (!inquiry) return row;

    // Fill gaps only — admin edits to a session row must survive dashboard
    // loads, so inquiry-derived values never overwrite populated fields.
    const details = buildClientSessionSyncFields(inquiry);
    const updates: Partial<ClientSessionRow> = {};
    if (!row.client_name && details.client_name) updates.client_name = details.client_name;
    if (!row.session_type && details.session_type) updates.session_type = details.session_type;
    if (!row.location && details.location) updates.location = details.location;
    if (!row.session_date && details.session_date) updates.session_date = details.session_date;
    if (Object.keys(updates).length === 0) return row;

    const { error } = await supabase.from(CLIENT_SESSION_TABLE).update(updates).eq("id", row.id);
    if (error) throw error;
    return { ...row, ...updates };
  }));
}

async function linkEmailMatches(userId: string, email: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .update({ client_user_id: userId, google_linked_at: new Date().toISOString() })
    .is("client_user_id", null)
    .ilike("client_email", escapeIlikePattern(email));

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

    const [byUserId, byEmail, inquiries] = await Promise.all([
      fetchRowsByUserId(user.id),
      email ? fetchRowsByEmail(email) : Promise.resolve([]),
      email ? fetchMatchingInquiries(email) : Promise.resolve([]),
    ]);

    const rowsById = new Map<string, ClientSessionRow>();
    for (const row of [...byUserId, ...byEmail]) rowsById.set(row.id, row);

    if (rowsById.size === 0 && email) {
      const created = await createSessionFromInquiry(user.id, email);
      if (created) rowsById.set(created.id, created);
    }

    const reconciledRows = await reconcileRows([...rowsById.values()], inquiries);
    const sessions = sortSessions(reconciledRows).map(toClientSessionDTO);
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("[client-sessions]", err);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
}
