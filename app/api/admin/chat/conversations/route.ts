// GET  /api/admin/chat/conversations  — list all conversations (newest first)
// POST /api/admin/chat/conversations  — create a new conversation

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const sb = createSupabaseServerClient();
  const { data, error } = await sb
    .from("chat_conversations")
    .select("id, title, archived, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = await req.json().catch(() => ({})) as { title?: string };
  const title = (body.title ?? "New Chat").slice(0, 80);

  const sb = createSupabaseServerClient();
  const { data, error } = await sb
    .from("chat_conversations")
    .insert({ title })
    .select("id, title, archived, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
