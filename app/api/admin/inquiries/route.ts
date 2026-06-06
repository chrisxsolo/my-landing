import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { INQUIRY_SELECT } from "@/lib/adminInquiries";
import {
  parseInquiryId,
  validateInquiryCreate,
  validateInquiryPatch,
} from "@/lib/adminInquiryValidation";

export const dynamic = "force-dynamic";

const INQUIRIES_TABLE = "inquiries";

function invalid(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

async function readBody(req: NextRequest): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const supabase = createSupabaseServerClient();
    const idParam = req.nextUrl.searchParams.get("id");
    if (idParam !== null) {
      const id = parseInquiryId(idParam);
      if (!id.ok) return invalid(id.error);
      const { data, error } = await supabase
        .from(INQUIRIES_TABLE)
        .select(INQUIRY_SELECT)
        .eq("id", id.data)
        .maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
      return NextResponse.json({ inquiry: data });
    }

    const { data, error } = await supabase
      .from(INQUIRIES_TABLE)
      .select(INQUIRY_SELECT)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw error;
    return NextResponse.json({ inquiries: data ?? [] });
  } catch (error) {
    console.error("[admin/inquiries] GET failed:", error);
    return NextResponse.json({ error: "Failed to load inquiries." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const input = validateInquiryCreate(await readBody(req));
  if (!input.ok) return invalid(input.error);

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from(INQUIRIES_TABLE)
      .insert(input.data)
      .select(INQUIRY_SELECT)
      .single();
    if (error) throw error;
    return NextResponse.json({ inquiry: data }, { status: 201 });
  } catch (error) {
    console.error("[admin/inquiries] POST failed:", error);
    return NextResponse.json({ error: "Failed to create inquiry." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const input = validateInquiryPatch(await readBody(req));
  if (!input.ok) return invalid(input.error);

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from(INQUIRIES_TABLE)
      .update(input.data.updates)
      .eq("id", input.data.id)
      .select(INQUIRY_SELECT)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
    return NextResponse.json({ inquiry: data });
  } catch (error) {
    console.error("[admin/inquiries] PATCH failed:", error);
    return NextResponse.json({ error: "Failed to update inquiry." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const id = parseInquiryId(req.nextUrl.searchParams.get("id"));
  if (!id.ok) return invalid(id.error);

  try {
    const supabase = createSupabaseServerClient();
    const { error, count } = await supabase
      .from(INQUIRIES_TABLE)
      .delete({ count: "exact" })
      .eq("id", id.data);
    if (error) throw error;
    if (!count) return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/inquiries] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete inquiry." }, { status: 500 });
  }
}
