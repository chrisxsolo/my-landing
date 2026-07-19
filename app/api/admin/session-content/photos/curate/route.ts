import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createAnthropicCaller } from "@/lib/contentEngine/aiClient";
import { curateTopPicks } from "@/lib/contentEngine/curatePhotos";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { TOP_PICK_COUNT } from "@/lib/contentEngine/curationConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });

  let body: { sessionId?: unknown; count?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!isUuid(sessionId)) return NextResponse.json({ error: "sessionId must be a uuid" }, { status: 400 });
  const count =
    typeof body.count === "number" && Number.isInteger(body.count) && body.count >= 1 && body.count <= 100
      ? body.count
      : TOP_PICK_COUNT;

  try {
    const result = await curateTopPicks({
      client: createSupabaseAdminClient(),
      callModel: createAnthropicCaller(apiKey),
      sessionId: sessionId.toLowerCase(),
      count,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "curation failed";
    if (/ai processing is not allowed/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("photo curation failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
