import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createAnthropicCaller } from "@/lib/contentEngine/aiClient";
import { generateContentType, GenerationConflictError } from "@/lib/contentEngine/generateContent";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { GENERATABLE_CONTENT_TYPES } from "@/lib/contentEngine/taxonomy";
import { GENERATION_DEADLINE_MS } from "@/lib/contentEngine/generationBudget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Long AI work, like the worker and analysis routes (Fluid compute allows it on
// this plan). Next.js reads segment config statically, so this is the literal;
// generationBudget.GENERATE_ROUTE_MAX_DURATION_SECONDS pins the same number
// and tests/unit/generateRoute.test.ts keeps them equal. Model work must end
// by GENERATION_DEADLINE_MS, leaving time to record the result before the
// function is killed — a 60s cap here once left a guide step `processing`.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });

  let body: { packageId?: unknown; contentType?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const packageId = typeof body.packageId === "string" ? body.packageId.toLowerCase() : "";
  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  if (!isUuid(packageId)) return NextResponse.json({ error: "packageId must be a uuid" }, { status: 400 });
  if (!(GENERATABLE_CONTENT_TYPES as string[]).includes(contentType)) {
    return NextResponse.json(
      { error: `contentType must be one of ${GENERATABLE_CONTENT_TYPES.join(", ")}` }, { status: 400 },
    );
  }

  const startedAt = Date.now();
  try {
    const result = await generateContentType({
      client: createSupabaseAdminClient(),
      callModel: createAnthropicCaller(apiKey),
      packageId, contentType,
      deadlineAt: startedAt + GENERATION_DEADLINE_MS,
    });
    if (result.outcome === "failed") {
      console.warn(
        `generate ${contentType} for package ${packageId}: ${result.failure?.kind ?? "failed"} ` +
        `in ${Date.now() - startedAt}ms`,
      );
    }
    return NextResponse.json(result, { status: result.outcome === "failed" ? 422 : 200 });
  } catch (err) {
    if (err instanceof GenerationConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : "generation failed";
    if (/ai processing is not allowed/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("generate type failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
