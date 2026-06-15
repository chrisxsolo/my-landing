import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const LINKS_TABLE = "links";

async function readBody(req: NextRequest): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = (await readBody(req)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!isNonEmptyString(body.label)) {
    return NextResponse.json({ error: "Label is required." }, { status: 400 });
  }
  if (!isNonEmptyString(body.url)) {
    return NextResponse.json({ error: "URL is required." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(LINKS_TABLE)
      .insert(body)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ link: data });
  } catch (error) {
    console.error("[admin/links] POST failed:", error);
    return NextResponse.json({ error: "Failed to create link." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = (await readBody(req)) as { id?: unknown; updates?: unknown } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.id !== "number" || !Number.isFinite(body.id)) {
    return NextResponse.json({ error: "A numeric id is required." }, { status: 400 });
  }
  if (!body.updates || typeof body.updates !== "object") {
    return NextResponse.json({ error: "Updates are required." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(LINKS_TABLE)
      .update(body.updates as Record<string, unknown>)
      .eq("id", body.id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Link not found." }, { status: 404 });
    return NextResponse.json({ link: data });
  } catch (error) {
    console.error("[admin/links] PATCH failed:", error);
    return NextResponse.json({ error: "Failed to update link." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "A valid id is required." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error, count } = await supabase
      .from(LINKS_TABLE)
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) throw error;
    if (!count) return NextResponse.json({ error: "Link not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/links] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete link." }, { status: 500 });
  }
}
