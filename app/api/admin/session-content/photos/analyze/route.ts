import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createAnthropicCaller } from "@/lib/contentEngine/aiClient";
import { analysisRunMarker, runAnalysis } from "@/lib/contentEngine/analyzePhotos";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The admin's Analyze button. Photos run in parallel server-side; one request
// stops taking new photos after CLAIM_WINDOW_MS so the workspace refreshes
// regularly, and the client calls again while anything remains. Every photo
// still in flight must finish by HARD_DEADLINE_MS, well inside maxDuration.
const CLAIM_WINDOW_MS = 50_000;
const HARD_DEADLINE_MS = 240_000;

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });

  let body: { sessionId?: unknown; photoIds?: unknown; attemptedSince?: unknown };
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
  const client = createSupabaseAdminClient();
  const startedAt = Date.now();
  try {
    // The first request of a click marks the run; later requests pass the
    // marker back so photos that already failed in this click aren't retried
    // in a loop. The marker is on the database clock (see analysisRunMarker).
    const attemptedSince = typeof body.attemptedSince === "string"
      && !Number.isNaN(Date.parse(body.attemptedSince))
      ? body.attemptedSince
      : await analysisRunMarker(client, sessionId.toLowerCase());
    const result = await runAnalysis({
      client,
      callModel: createAnthropicCaller(apiKey),
      sessionId: sessionId.toLowerCase(),
      photoIds,
      attemptedSince,
      stopClaimingAt: startedAt + CLAIM_WINDOW_MS,
      hardDeadlineAt: startedAt + HARD_DEADLINE_MS,
    });
    return NextResponse.json({ ...result, runStartedAt: attemptedSince });
  } catch (err) {
    const message = err instanceof Error ? err.message : "analysis failed";
    if (/ai processing is not allowed/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("analyze batch failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
