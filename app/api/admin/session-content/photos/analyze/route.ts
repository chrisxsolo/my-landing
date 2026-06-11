import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createAnthropicCaller } from "@/lib/contentEngine/aiClient";
import { runAnalysisBatch } from "@/lib/contentEngine/analyzePhotos";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });

  let body: { sessionId?: unknown; photoIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!isUuid(sessionId)) return NextResponse.json({ error: "sessionId must be a uuid" }, { status: 400 });
  const photoIds = Array.isArray(body.photoIds)
    ? body.photoIds.filter((p): p is string => typeof p === "string" && isUuid(p))
    : null;

  try {
    const result = await runAnalysisBatch({
      client: createSupabaseAdminClient(),
      callModel: createAnthropicCaller(apiKey),
      sessionId: sessionId.toLowerCase(),
      photoIds,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "analysis failed";
    if (/ai processing is not allowed/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("analyze batch failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
