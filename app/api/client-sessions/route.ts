import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/get-user";
import {
  CLIENT_SESSION_TABLE,
  type ClientSessionRow,
  toClientSessionDTO,
} from "@/lib/clientSessions";
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

async function linkEmailMatches(userId: string, email: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .update({ client_user_id: userId })
    .is("client_user_id", null)
    .ilike("client_email", email);

  if (error) console.error("[client-sessions] email link failed", error);
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email = user.email?.trim().toLowerCase() ?? "";
    if (email) await linkEmailMatches(user.id, email);

    const [byUserId, byEmail] = await Promise.all([
      fetchRowsByUserId(user.id),
      email ? fetchRowsByEmail(email) : Promise.resolve([]),
    ]);

    const rowsById = new Map<string, ClientSessionRow>();
    for (const row of [...byUserId, ...byEmail]) rowsById.set(row.id, row);

    const sessions = sortSessions([...rowsById.values()]).map(toClientSessionDTO);
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("[client-sessions]", err);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
}
