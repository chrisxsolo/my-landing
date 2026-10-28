import { NextRequest, NextResponse } from "next/server";
import { revalidatePublicContent } from "@/lib/publicRevalidation";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { assembleSessionStates } from "@/lib/contentEngine/sessionState";
import { updateSessionFacts } from "@/lib/contentEngine/createSession";
import { NO_INHERITANCE_CHANGES, syncSessionLocationInheritanceSummary } from "@/lib/photoTagging/inheritLocationSync";
import { syncSessionInBackground } from "@/lib/locationLibrary/autoSync";
import { syncCampusSpotPhotosInBackground } from "@/lib/campusSpotFill/autoSync";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "session id must be a uuid" }, { status: 400 });
  const sessionId = id.toLowerCase();

  const admin = createSupabaseAdminClient();
  const { data: session, error } = await admin.from("photography_sessions")
    .select("*").eq("id", sessionId).maybeSingle();
  if (error) {
    console.error("session fetch failed", error);
    return NextResponse.json({ error: "could not load session" }, { status: 500 });
  }
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });

  const [{ data: activePackage }, states] = await Promise.all([
    admin.from("session_content_packages")
      .select("*").eq("photography_session_id", sessionId).is("archived_at", null).maybeSingle(),
    assembleSessionStates(admin, [sessionId]),
  ]);
  const { data: items } = activePackage
    ? await admin.from("session_content_items").select("*").eq("package_id", activePackage.id)
        .order("created_at")
    : { data: [] };
  // publication history spans ALL packages of this session (spec §7.4 Section 5)
  const { data: pkgIds } = await admin.from("session_content_packages")
    .select("id").eq("photography_session_id", sessionId);
  const { data: published } = (pkgIds ?? []).length
    ? await admin.from("session_content_items")
        .select("id,content_type,published_target_type,published_target_id,published_at,published_ref,payload")
        .in("package_id", (pkgIds ?? []).map((p) => p.id))
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
    : { data: [] };

  return NextResponse.json({
    session,
    activePackage: activePackage ?? null,
    items: items ?? [],
    published: published ?? [],
    ...states.get(sessionId),
  });
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

  const admin = createSupabaseAdminClient();
  const sessionId = id.toLowerCase();
  try {
    const result = await updateSessionFacts({ client: admin, sessionId, facts: body });
    // A session with exactly one location gives it to its photos; when the
    // location facts change, only session-inherited photo locations follow.
    // Awaited so the saved facts and the photo locations arrive together, and
    // a sync failure is reported with the save instead of lost.
    const locationSync = "primary_location" in body || "secondary_locations" in body
      ? await syncSessionLocationInheritanceSummary(admin, sessionId, { reason: "session facts saved" })
      : NO_INHERITANCE_CHANGES;
    // School / location / service decide which public pages show the photos.
    revalidatePublicContent();
    // The location fields decide which library places the session belongs to.
    syncSessionInBackground(sessionId);
    syncCampusSpotPhotosInBackground();
    return NextResponse.json({ ...result, locationSync });
  } catch (err) {
    const message = err instanceof Error ? err.message : "facts update failed";
    return NextResponse.json({ error: message }, { status: /invalid|must be/i.test(message) ? 422 : 500 });
  }
}
