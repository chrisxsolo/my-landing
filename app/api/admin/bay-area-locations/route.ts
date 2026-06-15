import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const BAY_AREA_LOCATIONS_TABLE = "bay_area_locations";

async function readBody(req: NextRequest): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseId(value: unknown): number | null {
  const id = typeof value === "string" ? Number(value) : value;
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) return null;
  return id;
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = await readBody(req);
  if (!isRecord(body)) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(BAY_AREA_LOCATIONS_TABLE)
      .insert(body)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ location: data });
  } catch (error) {
    console.error("[admin/bay-area-locations] POST failed:", error);
    return NextResponse.json({ error: "Failed to create location." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = await readBody(req);
  if (!isRecord(body)) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const id = parseId(body.id);
  if (id === null) return NextResponse.json({ error: "A valid id is required." }, { status: 400 });

  const updates = isRecord(body.updates) ? body.updates : null;
  if (!updates) return NextResponse.json({ error: "Updates are required." }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(BAY_AREA_LOCATIONS_TABLE)
      .update(updates)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Location not found." }, { status: 404 });
    return NextResponse.json({ location: data });
  } catch (error) {
    console.error("[admin/bay-area-locations] PATCH failed:", error);
    return NextResponse.json({ error: "Failed to update location." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const id = parseId(req.nextUrl.searchParams.get("id"));
  if (id === null) return NextResponse.json({ error: "A valid id is required." }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    const { error, count } = await supabase
      .from(BAY_AREA_LOCATIONS_TABLE)
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) throw error;
    if (!count) return NextResponse.json({ error: "Location not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/bay-area-locations] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete location." }, { status: 500 });
  }
}
