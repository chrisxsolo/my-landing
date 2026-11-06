// Standalone blog drafts: GET lists them (with schedules + signed previews),
// POST creates one. Saving a draft never publishes anything.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createDraft, DraftError, listDrafts, toDraftDto } from "@/lib/contentPublishing/blogDrafts";
import { PUBLICATION_SCHEDULES_TABLE } from "@/lib/contentPublishing/constants";
import { SCHEDULE_COLUMNS, type PublicationScheduleDto } from "@/lib/contentPublishing/types";
import { readJson } from "@/lib/contentPublishing/routeHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(err: unknown, fallback: string) {
  if (err instanceof DraftError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(`[blog-drafts] ${fallback}`, err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const client = createSupabaseAdminClient();
    const drafts = await listDrafts(client);
    const ids = drafts.map((d) => d.id);
    const { data } = ids.length
      ? await client.from(PUBLICATION_SCHEDULES_TABLE).select(SCHEDULE_COLUMNS).in("blog_draft_id", ids)
          .in("state", ["queued", "processing", "blocked", "failed"])
      : { data: [] };
    const rows = (data ?? []) as unknown as PublicationScheduleDto[];
    const byDraft = new Map(rows.map((s) => [s.blog_draft_id as string, s]));
    const dtos = await Promise.all(drafts.map((d) => toDraftDto(client, d, byDraft.get(d.id) ?? null)));
    return NextResponse.json({ drafts: dtos });
  } catch (err) {
    return fail(err, "could not load drafts");
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  const source = body.source === "ai_photos" ? "ai_photos" : "manual";
  const { source: _s, ...fields } = body;
  void _s;
  try {
    const client = createSupabaseAdminClient();
    const draft = await createDraft(client, fields, source);
    return NextResponse.json({ draft: await toDraftDto(client, draft, null) }, { status: 201 });
  } catch (err) {
    return fail(err, "could not create the draft");
  }
}
