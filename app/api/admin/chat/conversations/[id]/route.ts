// GET   /api/admin/chat/conversations/[id]  — fetch messages for a conversation
// PATCH /api/admin/chat/conversations/[id]  — archive (or unarchive) a conversation

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const { id } = await params;
  const sb = createSupabaseServerClient();

  const { data, error } = await sb
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { archived?: boolean; title?: string };

  const updates: Record<string, unknown> = {};
  if (typeof body.archived === "boolean") updates.archived = body.archived;
  if (typeof body.title === "string") updates.title = body.title.slice(0, 80);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const sb = createSupabaseServerClient();
  const { data, error } = await sb
    .from("chat_conversations")
    .update(updates)
    .eq("id", id)
    .select("id, title, archived, created_at")
    .single();

  if (error) {
    // PGRST116 = zero rows from .single() — the conversation doesn't exist
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
