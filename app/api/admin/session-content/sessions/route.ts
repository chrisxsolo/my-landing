import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { assembleSessionStates } from "@/lib/contentEngine/sessionState";
import {
  createPhotographySession, CreateSessionConflictError,
} from "@/lib/contentEngine/createSession";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const admin = createSupabaseAdminClient();
  const { data: sessions, error } = await admin.from("photography_sessions")
    .select("id,public_display_name,internal_client_name,service_type,school_slug,session_date,marketing_permission,ai_processing_allowed,created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("session list failed", error);
    return NextResponse.json({ error: "could not list sessions" }, { status: 500 });
  }

  const states = await assembleSessionStates(admin, (sessions ?? []).map((s) => s.id as string));
  return NextResponse.json({
    sessions: (sessions ?? []).map((s) => ({ ...s, ...states.get(s.id as string) })),
  });
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: { clientSessionId?: unknown; serviceType?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const clientSessionId = typeof body.clientSessionId === "string" ? body.clientSessionId.toLowerCase() : undefined;
  if (clientSessionId && !isUuid(clientSessionId)) {
    return NextResponse.json({ error: "clientSessionId must be a uuid" }, { status: 400 });
  }

  try {
    const created = await createPhotographySession({
      client: createSupabaseAdminClient(),
      input: {
        clientSessionId,
        serviceType: typeof body.serviceType === "string" ? body.serviceType : undefined,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof CreateSessionConflictError) {
      return NextResponse.json(
        { error: err.message, existingSessionId: err.existingSessionId }, { status: 409 },
      );
    }
    const message = err instanceof Error ? err.message : "create failed";
    return NextResponse.json({ error: message }, { status: /invalid|not found/i.test(message) ? 400 : 500 });
  }
}
