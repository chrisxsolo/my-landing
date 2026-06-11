import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { updatePermissions } from "@/lib/contentEngine/permissions";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "session id must be a uuid" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await updatePermissions({
      client: createSupabaseAdminClient(),
      sessionId: id.toLowerCase(),
      changes: {
        marketingPermission: typeof body.marketingPermission === "boolean" ? body.marketingPermission : undefined,
        marketingPermissionSource: typeof body.marketingPermissionSource === "string" ? body.marketingPermissionSource : undefined,
        aiProcessingAllowed: typeof body.aiProcessingAllowed === "boolean" ? body.aiProcessingAllowed : undefined,
        aiProcessingBasis: typeof body.aiProcessingBasis === "string" ? body.aiProcessingBasis : undefined,
      },
      acknowledgePublished: body.acknowledgePublished === true,
    });
    if (result.outcome === "requires_acknowledgement") return NextResponse.json(result, { status: 409 });
    if (result.outcome === "not_found") return NextResponse.json({ error: "session not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "permission update failed";
    return NextResponse.json({ error: message }, { status: /must be one of/i.test(message) ? 422 : 500 });
  }
}
