// POST: publish an UNSCHEDULED draft right now (a scheduled draft is published
// early through its schedule's publish-now action, which shares the claim).
// Body: { revision } — the revision the admin is looking at.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { revalidateOnePath } from "@/lib/contentPublishing/refresh";
import { loadDraft } from "@/lib/contentPublishing/blogDrafts";
import { activeScheduleFor } from "@/lib/contentPublishing/scheduleService";
import { publishBlogDraft } from "@/lib/contentPublishing/publishBlogDraft";
import { readJson } from "@/lib/contentPublishing/routeHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "draft id must be a uuid" }, { status: 400 });
  const body = (await readJson(req)) ?? {};
  const client = createSupabaseAdminClient();
  try {
    const draft = await loadDraft(client, id.toLowerCase());
    if (!draft) return NextResponse.json({ error: "draft not found" }, { status: 404 });
    if (typeof body.revision === "number" && body.revision !== draft.revision) {
      return NextResponse.json({ error: "the draft changed since you last loaded it — reload and review it again" }, { status: 409 });
    }
    const schedule = await activeScheduleFor(client, { kind: "blog_draft", id: draft.id });
    if (schedule) {
      return NextResponse.json({ error: "this draft is scheduled — use Publish now on its schedule", schedule }, { status: 409 });
    }
    const outcome = await publishBlogDraft({
      client, draftId: draft.id,
      revalidate: revalidateOnePath,
    });
    if (outcome.status === "blocked") return NextResponse.json({ error: outcome.reason }, { status: 409 });
    if (outcome.status === "failed") return NextResponse.json({ error: outcome.error }, { status: 422 });
    return NextResponse.json(outcome);
  } catch (err) {
    console.error("[blog-drafts] publish failed", err);
    return NextResponse.json({ error: "publish failed" }, { status: 500 });
  }
}
