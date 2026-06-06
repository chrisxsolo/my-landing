// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/drafts   (admin-only, service-role)
//
// Per-inquiry cross-device draft sync, previously stored via the browser anon
// client in site_settings keys draft_<id> / ai_draft_<id> / original_ai_draft_<id>.
// Kept separate from /api/admin/site-settings so that endpoint's allowlist stays
// strictly the non-secret public image/cover keys.
//
//   GET    ?inquiryId=42                  → { draft, ai_draft, original_ai_draft }
//   PUT    { inquiryId, draft?, ai_draft?, original_ai_draft? } → upsert provided
//   DELETE { inquiryId, kinds? }          → delete (default: draft + ai_draft)
// ─────────────────────────────────────────────────────────────────────────────

import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  DRAFT_KEY_PREFIXES,
  type DraftKind,
  draftKey,
  isValidInquiryId,
} from "@/lib/siteSettingsShared";

export const dynamic = "force-dynamic";

const MAX_DRAFT_LEN = 100_000;

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const inquiryId = req.nextUrl.searchParams.get("inquiryId");
  if (!isValidInquiryId(inquiryId)) {
    return NextResponse.json({ error: "Valid inquiryId required." }, { status: 400 });
  }

  try {
    const keys = DRAFT_KEY_PREFIXES.map((k) => draftKey(k, inquiryId!));
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.from("site_settings").select("key,value").in("key", keys);
    if (error) throw error;

    const byKey = new Map((data ?? []).map((r) => [r.key, r.value]));
    return NextResponse.json({
      draft: byKey.get(draftKey("draft", inquiryId!)) ?? null,
      ai_draft: byKey.get(draftKey("ai_draft", inquiryId!)) ?? null,
      original_ai_draft: byKey.get(draftKey("original_ai_draft", inquiryId!)) ?? null,
    });
  } catch (err) {
    console.error("[admin/drafts] GET failed:", err);
    return NextResponse.json({ error: "Failed to load drafts." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { inquiryId } = (body ?? {}) as { inquiryId?: unknown };
  if (!isValidInquiryId(inquiryId)) {
    return NextResponse.json({ error: "Valid inquiryId required." }, { status: 400 });
  }

  const provided = body as Partial<Record<DraftKind, unknown>>;
  const now = new Date().toISOString();
  const rows: { key: string; value: string; updated_at: string }[] = [];
  for (const kind of DRAFT_KEY_PREFIXES) {
    const v = provided[kind];
    if (v === undefined) continue;
    if (typeof v !== "string" || v.length > MAX_DRAFT_LEN) {
      return NextResponse.json({ error: `Invalid ${kind} value.` }, { status: 400 });
    }
    rows.push({ key: draftKey(kind, inquiryId as number | string), value: v, updated_at: now });
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "No draft fields provided." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/drafts] PUT failed:", err);
    return NextResponse.json({ error: "Failed to save draft." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { inquiryId, kinds } = (body ?? {}) as { inquiryId?: unknown; kinds?: unknown };
  if (!isValidInquiryId(inquiryId)) {
    return NextResponse.json({ error: "Valid inquiryId required." }, { status: 400 });
  }

  const requested: DraftKind[] = Array.isArray(kinds)
    ? (kinds.filter((k) => (DRAFT_KEY_PREFIXES as readonly string[]).includes(k)) as DraftKind[])
    : ["draft", "ai_draft"];
  if (requested.length === 0) {
    return NextResponse.json({ error: "No valid draft kinds to delete." }, { status: 400 });
  }

  try {
    const keys = requested.map((k) => draftKey(k, inquiryId as number | string));
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("site_settings").delete().in("key", keys);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/drafts] DELETE failed:", err);
    return NextResponse.json({ error: "Failed to delete drafts." }, { status: 500 });
  }
}
