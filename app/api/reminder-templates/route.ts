// GET  /api/reminder-templates        → { templates: Record<id, { subject, instructions }> }
// POST /api/reminder-templates        → save one or more templates
// Body: { templates: { id, subject, instructions }[] }

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

const REMINDER_IDS = ["48hr", "day-before", "morning-of", "thank-you", "gallery-delivery"] as const;
type ReminderId = typeof REMINDER_IDS[number];

function subjectKey(id: string) { return `reminder_subject_${id}`; }
function instrKey(id: string)   { return `reminder_instructions_${id}`; }

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const supabase = createSupabaseServerClient();
  const keys = REMINDER_IDS.flatMap(id => [subjectKey(id), instrKey(id)]);
  const { data } = await supabase.from("site_settings").select("key,value").in("key", keys);

  const map = Object.fromEntries((data ?? []).map(r => [r.key, r.value]));
  const templates = Object.fromEntries(
    REMINDER_IDS.map(id => [
      id,
      {
        subject:      map[subjectKey(id)] ?? null,
        instructions: map[instrKey(id)]   ?? null,
      },
    ])
  );
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: { templates: { id: string; subject?: string; instructions?: string }[] } | null;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!Array.isArray(body?.templates)) {
    return NextResponse.json({ error: "templates array required" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const rows: { key: string; value: string; updated_at: string }[] = [];
  const now = new Date().toISOString();

  for (const t of body.templates) {
    if (!REMINDER_IDS.includes(t.id as ReminderId)) continue;
    if (t.subject      !== undefined) rows.push({ key: subjectKey(t.id), value: t.subject,      updated_at: now });
    if (t.instructions !== undefined) rows.push({ key: instrKey(t.id),   value: t.instructions, updated_at: now });
  }

  if (!rows.length) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });

  const { error } = await supabase
    .from("site_settings")
    .upsert(rows, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, saved: rows.length });
}
