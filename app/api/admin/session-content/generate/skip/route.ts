import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { skipFailedType } from "@/lib/contentEngine/skipType";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { GENERATABLE_CONTENT_TYPES } from "@/lib/contentEngine/taxonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

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
    return NextResponse.json({ error: "unknown content type" }, { status: 400 });
  }

  try {
    const result = await skipFailedType({ client: createSupabaseAdminClient(), packageId, contentType });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "skip failed";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
