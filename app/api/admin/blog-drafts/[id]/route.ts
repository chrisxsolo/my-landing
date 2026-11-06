// One draft: GET (with signed previews), PATCH (optimistic by revision; an
// edit cancels an active schedule), DELETE.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { deleteDraft, DraftError, loadDraft, toDraftDto, updateDraft } from "@/lib/contentPublishing/blogDrafts";
import { readJson } from "@/lib/contentPublishing/routeHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function fail(err: unknown, fallback: string) {
  if (err instanceof DraftError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(`[blog-drafts] ${fallback}`, err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

async function draftId(params: Params["params"]): Promise<string | null> {
  const { id } = await params;
  return isUuid(id) ? id.toLowerCase() : null;
}

export async function GET(req: NextRequest, { params }: Params) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const id = await draftId(params);
  if (!id) return NextResponse.json({ error: "draft id must be a uuid" }, { status: 400 });
  try {
    const client = createSupabaseAdminClient();
    const draft = await loadDraft(client, id);
    if (!draft) return NextResponse.json({ error: "draft not found" }, { status: 404 });
    return NextResponse.json({ draft: await toDraftDto(client, draft) });
  } catch (err) {
    return fail(err, "could not load the draft");
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const id = await draftId(params);
  if (!id) return NextResponse.json({ error: "draft id must be a uuid" }, { status: 400 });
  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  const expectedRevision = typeof body.revision === "number" ? body.revision : -1;
  if (expectedRevision < 1) return NextResponse.json({ error: "revision must be a positive integer" }, { status: 400 });
  const { revision: _r, ...fields } = body;
  void _r;
  try {
    const client = createSupabaseAdminClient();
    const result = await updateDraft(client, id, fields, expectedRevision);
    switch (result.outcome) {
      case "saved":
        return NextResponse.json({ outcome: "saved", draft: await toDraftDto(client, result.draft), scheduleCancelled: result.scheduleCancelled });
      case "conflict":
        return NextResponse.json({ outcome: "conflict", server: await toDraftDto(client, result.server) }, { status: 409 });
      case "not_editable": return NextResponse.json({ error: result.message }, { status: 409 });
      case "not_found": return NextResponse.json({ error: "draft not found" }, { status: 404 });
    }
  } catch (err) {
    return fail(err, "could not save the draft");
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const id = await draftId(params);
  if (!id) return NextResponse.json({ error: "draft id must be a uuid" }, { status: 400 });
  try {
    const removed = await deleteDraft(createSupabaseAdminClient(), id);
    return removed ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "draft not found" }, { status: 404 });
  } catch (err) {
    return fail(err, "could not delete the draft");
  }
}
