import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { DEFAULT_ENGINE_MODEL } from "@/lib/contentEngine/aiClient";
import { PROMPT_VERSION } from "@/lib/contentEngine/prompts";
import { buildSessionFactsSnapshot } from "@/lib/contentEngine/payloads";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { GENERATABLE_CONTENT_TYPES } from "@/lib/contentEngine/taxonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: { sessionId?: unknown; selectedTypes?: unknown; archiveCurrent?: unknown; copyItems?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.toLowerCase() : "";
  if (!isUuid(sessionId)) return NextResponse.json({ error: "sessionId must be a uuid" }, { status: 400 });
  const selectedTypes = Array.isArray(body.selectedTypes)
    ? body.selectedTypes.filter((t): t is string => typeof t === "string")
    : [];
  const invalid = selectedTypes.filter((t) => !(GENERATABLE_CONTENT_TYPES as string[]).includes(t));
  if (selectedTypes.length === 0 || invalid.length > 0) {
    return NextResponse.json(
      { error: `selectedTypes must be a non-empty subset of ${GENERATABLE_CONTENT_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: session, error: sErr } = await admin
    .from("photography_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (sErr) {
    console.error("session lookup failed for package request", sErr);
    return NextResponse.json({ error: "could not look up photography session" }, { status: 500 });
  }
  if (!session) return NextResponse.json({ error: "photography session not found" }, { status: 404 });

  let snapshot;
  try {
    snapshot = buildSessionFactsSnapshot(session);
  } catch {
    return NextResponse.json(
      { error: "session facts are incomplete (service_type missing or invalid)" }, { status: 422 },
    );
  }

  const { data: packageId, error } = await admin.rpc("create_content_package", {
    p_session_id: sessionId,
    p_model_name: DEFAULT_ENGINE_MODEL,
    p_prompt_version: PROMPT_VERSION,
    p_selected_types: selectedTypes,
    p_session_facts: snapshot,
    p_generation_settings: {},
    p_archive_current: body.archiveCurrent === true,
    p_copy_items: Array.isArray(body.copyItems) ? body.copyItems : [],
  });
  if (error) {
    const status = /active package/i.test(error.message) ? 409
      : /ai processing/i.test(error.message) ? 403 : 422;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ packageId });
}
