// ─────────────────────────────────────────────────────────────────────────────
// Admin availability CRUD  →  /api/admin/availability
//
// All availability writes (and the full, unsanitized read incl. private notes)
// go through this server route. It is gated by requireAdmin (httpOnly
// admin_session cookie) and uses the service-role client, which bypasses RLS.
//
// This exists so the public anon key NO LONGER needs read/write access to the
// `availability` base table — the public reads the sanitized `availability_public`
// view instead (notes are nulled for booked/hold dates there).
//
//   GET    → list all dates (full rows, incl. notes)
//   PUT    → upsert a date's status (+ optional note) on conflict(date)
//   PATCH  → update a single date's note
//   DELETE → remove a date
// ─────────────────────────────────────────────────────────────────────────────

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const TABLE = "availability";
const STATUSES = ["available", "booked", "hold"] as const;
type Status = (typeof STATUSES)[number];

function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, date, status, note")
    .order("date", { ascending: true });

  if (error) {
    console.error("Admin availability GET error:", error);
    return NextResponse.json({ error: "Failed to load availability." }, { status: 500 });
  }
  return NextResponse.json({ dates: data ?? [] });
}

export async function PUT(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = await req.json().catch(() => null);
  if (!body || !isIsoDate(body.date) || !isStatus(body.status)) {
    return NextResponse.json({ error: "Expected { date: YYYY-MM-DD, status }." }, { status: 400 });
  }

  // Only include `note` in the payload when explicitly provided, so toggling a
  // status never clobbers an existing note.
  const payload: { date: string; status: Status; note?: string | null } = {
    date: body.date,
    status: body.status,
  };
  if (typeof body.note === "string" || body.note === null) payload.note = body.note;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: "date" })
    .select("id, date, status, note")
    .single();

  if (error) {
    console.error("Admin availability PUT error:", error);
    return NextResponse.json({ error: "Failed to save date." }, { status: 500 });
  }
  return NextResponse.json({ date: data });
}

export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = await req.json().catch(() => null);
  if (!body || !isIsoDate(body.date) || typeof body.note !== "string") {
    return NextResponse.json({ error: "Expected { date: YYYY-MM-DD, note: string }." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ note: body.note })
    .eq("date", body.date)
    .select("id, date, status, note")
    .single();

  if (error) {
    console.error("Admin availability PATCH error:", error);
    return NextResponse.json({ error: "Failed to save note." }, { status: 500 });
  }
  return NextResponse.json({ date: data });
}

export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = await req.json().catch(() => null);
  if (!body || !isIsoDate(body.date)) {
    return NextResponse.json({ error: "Expected { date: YYYY-MM-DD }." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from(TABLE).delete().eq("date", body.date);

  if (error) {
    console.error("Admin availability DELETE error:", error);
    return NextResponse.json({ error: "Failed to clear date." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
