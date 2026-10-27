// GET /api/admin/review-queue?session=<uuid> — the review findings that are
// not one photo's missing tags: excluded photos still placed by hand,
// sessions whose location or school is unresolved, proposed places in
// review. The admin merges them with the tagging audit's photo items
// (lib/photoTagging/reviewQueue.ts). Read-only; every action an item offers
// goes to an existing admin endpoint.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { loadAudit } from "@/lib/photoTagging/library";
import { loadReviewFindings } from "@/lib/reviewQueue/findings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const session = req.nextUrl.searchParams.get("session");
  if (session && !isUuid(session)) return NextResponse.json({ error: "session must be a uuid" }, { status: 400 });
  const client = createSupabaseAdminClient();
  try {
    const audit = await loadAudit(client, session?.toLowerCase());
    const findings = await loadReviewFindings(client, audit.entries, session?.toLowerCase());
    return NextResponse.json({ ...findings, errors: [...audit.errors, ...findings.errors] });
  } catch (err) {
    console.error("[review-queue] could not load the findings", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "could not load the review findings" }, { status: 500 });
  }
}
