// Revision history for one blog post (blog_post_revisions, filled by the
// trigger from migration 20261027000010). GET lists the saved states newest
// first; POST restores one, which the trigger records as a new revision, so the
// restore itself can be undone from the same list.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { revalidatePublicContent } from "@/lib/publicRevalidation";
import { listRevisions, restoreRevision, RevisionError } from "@/lib/blog/postRevisions";

export const dynamic = "force-dynamic";

function parseId(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function errorResponse(err: unknown, fallback: string) {
  if (err instanceof RevisionError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(`[admin/blog-posts/revisions] ${fallback}`, err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const postId = parseId(req.nextUrl.searchParams.get("id"));
  if (!postId) return NextResponse.json({ error: "A valid post id is required." }, { status: 400 });
  try {
    return NextResponse.json({ revisions: await listRevisions(createSupabaseAdminClient(), postId) });
  } catch (err) {
    return errorResponse(err, "Failed to load revisions.");
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  let body: { postId?: unknown; revisionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const postId = parseId(body.postId);
  const revisionId = parseId(body.revisionId);
  if (!postId || !revisionId) return NextResponse.json({ error: "postId and revisionId are required." }, { status: 400 });
  try {
    const result = await restoreRevision(createSupabaseAdminClient(), postId, revisionId);
    revalidatePublicContent();
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "Failed to restore the revision.");
  }
}
