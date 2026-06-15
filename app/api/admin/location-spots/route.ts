import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const LOCATION_SPOTS_TABLE = "location_spots";

async function readBody(req: NextRequest): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = await readBody(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(LOCATION_SPOTS_TABLE)
      .insert(body)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ spot: data });
  } catch (error) {
    console.error("[admin/location-spots] POST failed:", error);
    return NextResponse.json({ error: "Failed to create location spot." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = await readBody(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { id, updates } = body as { id?: unknown; updates?: unknown };
  if (id === undefined || id === null) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }
  if (!updates || typeof updates !== "object") {
    return NextResponse.json({ error: "Missing updates." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(LOCATION_SPOTS_TABLE)
      .update(updates)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Location spot not found." }, { status: 404 });
    return NextResponse.json({ spot: data });
  } catch (error) {
    console.error("[admin/location-spots] PATCH failed:", error);
    return NextResponse.json({ error: "Failed to update location spot." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error, count } = await supabase
      .from(LOCATION_SPOTS_TABLE)
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) throw error;
    if (!count) return NextResponse.json({ error: "Location spot not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/location-spots] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete location spot." }, { status: 500 });
  }
}
