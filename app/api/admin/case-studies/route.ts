import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const CASE_STUDIES_TABLE = "portfolio_case_studies";

async function readBody(req: NextRequest): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function parseId(raw: unknown): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const payload = await readBody(req);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(CASE_STUDIES_TABLE)
      .insert(payload)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ caseStudy: data });
  } catch (error) {
    console.error("[admin/case-studies] POST failed:", error);
    return NextResponse.json({ error: "Failed to create case study." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = await readBody(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { id: rawId, updates } = body as { id?: unknown; updates?: unknown };
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "Invalid case study id." }, { status: 400 });
  if (!updates || typeof updates !== "object") {
    return NextResponse.json({ error: "Invalid updates." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(CASE_STUDIES_TABLE)
      .update(updates)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Case study not found." }, { status: 404 });
    return NextResponse.json({ caseStudy: data });
  } catch (error) {
    console.error("[admin/case-studies] PATCH failed:", error);
    return NextResponse.json({ error: "Failed to update case study." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const id = parseId(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Invalid case study id." }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    const { error, count } = await supabase
      .from(CASE_STUDIES_TABLE)
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) throw error;
    if (!count) return NextResponse.json({ error: "Case study not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/case-studies] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete case study." }, { status: 500 });
  }
}
