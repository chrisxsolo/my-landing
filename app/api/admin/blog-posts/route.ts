// Admin API for blog_posts. Every handler is gated by requireAdmin and uses the
// service-role client, so the public anon key can never read drafts or write here.
// Mirrors the testimonials route idiom. Writes accept only the editable columns
// (lib/blog/postFields), keep the social image on the cover, and refresh the
// public cache themselves so a saved post is live without a second request.

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { revalidatePublicContent } from "@/lib/publicRevalidation";
import { pickEditableFields, rejectedFields, withOgImageFollowingCover, type CoverState } from "@/lib/blog/postFields";

export const dynamic = "force-dynamic";

const TABLE = "blog_posts";

async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function parseId(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

// GET: list professional posts (same query + legacy fallback the admin UI used).
export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const supabase = createSupabaseAdminClient();
    let { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .contains("sites", ["professional"])
      .order("published_at", { ascending: false });
    if (error) {
      const fallback = await supabase
        .from(TABLE)
        .select("*")
        .eq("category", "professional")
        .order("published_at", { ascending: false });
      data = fallback.data;
      error = fallback.error;
    }
    if (error) throw error;
    return NextResponse.json({ posts: data ?? [] });
  } catch (error) {
    console.error("[admin/blog-posts] GET failed:", error);
    return NextResponse.json({ error: "Failed to load posts." }, { status: 500 });
  }
}

// POST: insert a post, return its new id.
export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const body = await readBody(req);
  if (!body || typeof body.title !== "string" || typeof body.body !== "string") {
    return NextResponse.json({ error: "Title and body are required." }, { status: 400 });
  }
  const unknown = rejectedFields(body);
  if (unknown.length > 0) {
    return NextResponse.json({ error: `Unknown fields: ${unknown.join(", ")}` }, { status: 400 });
  }
  // A new post's social image is its cover unless one was given.
  const row = withOgImageFollowingCover({ cover_image_url: null, og_image_url: null }, pickEditableFields(body));
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from(TABLE).insert(row).select("id").single();
    if (error) throw error;
    revalidatePublicContent();
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    console.error("[admin/blog-posts] POST failed:", error);
    const message = error instanceof Error ? error.message : "Failed to save post.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// PATCH: update a post by id. Body = { id, updates }.
export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const body = await readBody(req);
  const id = parseId(body?.id);
  if (!id || !body || typeof body.updates !== "object" || body.updates === null) {
    return NextResponse.json({ error: "id and updates are required." }, { status: 400 });
  }
  const requested = body.updates as Record<string, unknown>;
  const unknown = rejectedFields(requested);
  if (unknown.length > 0) {
    return NextResponse.json({ error: `Unknown fields: ${unknown.join(", ")}` }, { status: 400 });
  }
  try {
    const supabase = createSupabaseAdminClient();
    const { data: current, error: readError } = await supabase
      .from(TABLE).select("id,cover_image_url,og_image_url").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!current) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    const updates = withOgImageFollowingCover(current as CoverState, pickEditableFields(requested));
    const { error } = await supabase.from(TABLE).update(updates).eq("id", id);
    if (error) throw error;
    revalidatePublicContent();
    return NextResponse.json({ ok: true, updates });
  } catch (error) {
    console.error("[admin/blog-posts] PATCH failed:", error);
    const message = error instanceof Error ? error.message : "Failed to update post.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE: remove a post by ?id=.
export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const id = parseId(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "A valid id is required." }, { status: 400 });
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw error;
    revalidatePublicContent();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/blog-posts] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete post." }, { status: 500 });
  }
}
