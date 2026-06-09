import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  parseTestimonialId,
  sanitizeTestimonialSearch,
  TESTIMONIAL_SOURCES,
  TESTIMONIAL_STATUSES,
  validateAdminTestimonialPatch,
} from "@/lib/testimonialValidation";

export const dynamic = "force-dynamic";

const TESTIMONIALS_TABLE = "testimonials";
const TESTIMONIAL_SELECT = [
  "id", "first_name", "last_name", "email", "message", "consent_to_marketing",
  "consent_version", "display_name_preference", "status", "source", "gallery_id",
  "session_type", "featured", "display_order", "admin_notes", "submitted_at",
  "reviewed_at", "published_at", "updated_at",
].join(",");
const STATUS_SET = new Set<string>(TESTIMONIAL_STATUSES);
const SOURCE_SET = new Set<string>(TESTIMONIAL_SOURCES);

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

  const page = Math.max(Number(req.nextUrl.searchParams.get("page")) || 1, 1);
  const pageSize = Math.min(Math.max(Number(req.nextUrl.searchParams.get("pageSize")) || 20, 1), 50);
  const status = req.nextUrl.searchParams.get("status") ?? "";
  const source = req.nextUrl.searchParams.get("source") ?? "";
  const search = sanitizeTestimonialSearch(req.nextUrl.searchParams.get("search"));
  if (status && !STATUS_SET.has(status)) return NextResponse.json({ error: "Invalid status filter." }, { status: 400 });
  if (source && !SOURCE_SET.has(source)) return NextResponse.json({ error: "Invalid source filter." }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from(TESTIMONIALS_TABLE)
      .select(TESTIMONIAL_SELECT, { count: "exact" })
      .order("submitted_at", { ascending: false });
    if (status) query = query.eq("status", status);
    if (source) query = query.eq("source", source);
    if (search) {
      const term = `%${search}%`;
      query = query.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},message.ilike.${term}`);
    }

    const from = (page - 1) * pageSize;
    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    return NextResponse.json({ testimonials: data ?? [], total: count ?? 0, page, pageSize });
  } catch (error) {
    console.error("[admin/testimonials] GET failed:", error);
    return NextResponse.json({ error: "Failed to load testimonials." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const input = validateAdminTestimonialPatch(await readBody(req));
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  const patch = input.data.updates;
  const now = new Date().toISOString();

  try {
    const supabase = createSupabaseAdminClient();
    const { data: current, error: readError } = await supabase
      .from(TESTIMONIALS_TABLE)
      .select("status,published_at")
      .eq("id", input.data.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!current) return NextResponse.json({ error: "Testimonial not found." }, { status: 404 });

    const effectiveStatus = patch.status ?? current.status;
    // A testimonial can only be featured (and shown on the homepage) while approved.
    if (patch.featured === true && effectiveStatus !== "approved") {
      return NextResponse.json({ error: "Only approved testimonials can be featured." }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (patch.status !== undefined) updates.status = patch.status;
    if (patch.admin_notes !== undefined) updates.admin_notes = patch.admin_notes;
    if (patch.featured !== undefined) updates.featured = patch.featured;
    if (patch.display_order !== undefined) updates.display_order = patch.display_order;
    if (patch.session_type !== undefined) updates.session_type = patch.session_type;
    if (patch.published !== undefined) {
      updates.published_at = patch.published ? current.published_at ?? now : null;
    }

    if (patch.status === "approved" || patch.status === "rejected") {
      updates.reviewed_at = now;
    } else if (patch.status === "pending") {
      updates.reviewed_at = null;
    }
    // Leaving the approved state removes a testimonial from the homepage entirely.
    if (patch.status !== undefined && patch.status !== "approved") {
      updates.featured = false;
      updates.published_at = null;
    }

    const { data, error } = await supabase
      .from(TESTIMONIALS_TABLE)
      .update(updates)
      .eq("id", input.data.id)
      .select(TESTIMONIAL_SELECT)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Testimonial not found." }, { status: 404 });
    return NextResponse.json({ testimonial: data });
  } catch (error) {
    console.error("[admin/testimonials] PATCH failed:", error);
    return NextResponse.json({ error: "Failed to update testimonial." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const id = parseTestimonialId(req.nextUrl.searchParams.get("id"));
  if (!id.ok) return NextResponse.json({ error: id.error }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    const { error, count } = await supabase
      .from(TESTIMONIALS_TABLE)
      .delete({ count: "exact" })
      .eq("id", id.data);
    if (error) throw error;
    if (!count) return NextResponse.json({ error: "Testimonial not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/testimonials] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete testimonial." }, { status: 500 });
  }
}
