import { NextRequest, NextResponse } from "next/server";
import { revalidatePublicContent } from "@/lib/publicRevalidation";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { updatePermissions } from "@/lib/contentEngine/permissions";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { summarizePlacements } from "@/lib/photoExclusion/kinds";
import { listLivePlacements } from "@/lib/photoExclusion/placements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every explicit placement the session's public photos are still live in; a lookup failure is reported, never hidden. */
async function livePlacementsOf(sessionId: string) {
  try {
    const client = createSupabaseAdminClient();
    const { data, error } = await client.from("session_photos").select("id,public_derivative_url")
      .eq("photography_session_id", sessionId).not("public_derivative_url", "is", null);
    if (error) throw new Error(error.message);
    const photos = (data ?? []).map((r) => ({ id: String(r.id), url: (r.public_derivative_url as string | null) ?? null }));
    const livePlacements = [...(await listLivePlacements(client, photos)).values()].flat();
    return { livePlacements, livePlacementSummary: summarizePlacements(livePlacements) };
  } catch (err) {
    console.error("[permissions] revoked, but could not list live placements", err);
    return { livePlacements: null, livePlacementsError: err instanceof Error ? err.message : "lookup failed" };
  }
}

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
    revalidatePublicContent(); // marketing permission gates reuse on school / guide pages
    if (body.marketingPermission !== false) return NextResponse.json(result);
    // A revoke stops automatic reuse at once; explicit placements stay until a
    // person takes them down (takedown.ts). List them so nothing is missed.
    return NextResponse.json({ ...result, ...(await livePlacementsOf(id.toLowerCase())) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "permission update failed";
    return NextResponse.json({ error: message }, { status: /must be one of/i.test(message) ? 422 : 500 });
  }
}
