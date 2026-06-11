import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "photo id must be a uuid" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if ("excluded" in body) {
    if (typeof body.excluded !== "boolean") return NextResponse.json({ error: "excluded must be boolean" }, { status: 422 });
    patch.excluded = body.excluded;
  }
  if ("sort_order" in body) {
    if (typeof body.sort_order !== "number" || !Number.isInteger(body.sort_order) || body.sort_order < 0) {
      return NextResponse.json({ error: "sort_order must be a non-negative integer" }, { status: 422 });
    }
    patch.sort_order = body.sort_order;
  }
  for (const key of ["alt_text", "title", "description"] as const) {
    if (key in body) {
      if (body[key] !== null && typeof body[key] !== "string") {
        return NextResponse.json({ error: `${key} must be a string or null` }, { status: 422 });
      }
      patch[key] = body[key] === null ? null : (body[key] as string).slice(0, 1000);
    }
  }
  if ("tags" in body) {
    if (!Array.isArray(body.tags)) return NextResponse.json({ error: "tags must be an array" }, { status: 422 });
    patch.tags = (body.tags as unknown[]).map((t) => String(t).slice(0, 60)).slice(0, 15);
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "no editable fields provided" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("session_photos")
    .update(patch).eq("id", id.toLowerCase()).select("id").maybeSingle();
  if (error) {
    console.error("photo patch failed", error);
    return NextResponse.json({ error: "could not update photo" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "photo not found" }, { status: 404 });
  return NextResponse.json({ updated: true });
}
