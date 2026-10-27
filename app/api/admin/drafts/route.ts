// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/drafts   (admin-only, service-role)
//
// Per-inquiry cross-device draft sync, previously stored via the browser anon
// client in site_settings keys draft_<id> / ai_draft_<id> / original_ai_draft_<id>.
// Kept separate from /api/admin/site-settings so that endpoint's allowlist stays
// strictly the non-secret public image/cover keys.
//
//   GET    ?inquiryId=42                  → { draft, ai_draft, original_ai_draft, quote }
//   PUT    { inquiryId, draft?, ai_draft?, original_ai_draft? } → upsert provided
//   DELETE { inquiryId, kinds? }          → delete (default: draft + ai_draft)
//
// `quote` is the rate card's inputs for this inquiry (lib/ai/inquiryQuote),
// computed from the inquiry row with no model call. A restored draft used to
// come back without one, so the pricing check never ran on it: a stored draft
// quoting the old $70 SJSU travel fee restored silently.
// ─────────────────────────────────────────────────────────────────────────────

import { type NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";
import { buildQuoteInputForInquiry, type QuoteSubject } from "@/lib/ai/inquiryQuote";
import type { QuoteInput } from "@/lib/ai/quotePricing";
import {
  DRAFT_KEY_PREFIXES,
  type DraftKind,
  draftKey,
  isValidInquiryId,
} from "@/lib/siteSettingsShared";

export const dynamic = "force-dynamic";

const MAX_DRAFT_LEN = 100_000;
const INQUIRIES_TABLE = "inquiries";
const QUOTE_COLUMNS = "session_type, message, school, location, people";

type RestoredQuote = { input: QuoteInput; stalePrices: number[] };

/**
 * The pricing inputs for the inquiry, or null when the row cannot be read.
 * Without the Gmail thread there are no earlier quoted prices to call stale;
 * the draft's own figures are still checked against the rate card.
 */
async function fetchInquiryQuote(supabase: SupabaseClient, inquiryId: string): Promise<RestoredQuote | null> {
  try {
    const { data, error } = await supabase
      .from(INQUIRIES_TABLE).select(QUOTE_COLUMNS).eq("id", inquiryId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as { session_type?: string | null; message?: string | null; school?: string | null; location?: string | null; people?: string | number | null };
    const subject: QuoteSubject = {
      sessionType: row.session_type, message: row.message, school: row.school, location: row.location, people: row.people,
    };
    const { input, stalePrices } = buildQuoteInputForInquiry(subject);
    return { input, stalePrices };
  } catch (err) {
    console.error("[admin/drafts] quote inputs unavailable:", err);
    return null;
  }
}

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
    const [{ data, error }, quote] = await Promise.all([
      supabase.from("site_settings").select("key,value").in("key", keys),
      fetchInquiryQuote(supabase, inquiryId!),
    ]);
    if (error) throw error;

    const byKey = new Map((data ?? []).map((r) => [r.key, r.value]));
    return NextResponse.json({
      draft: byKey.get(draftKey("draft", inquiryId!)) ?? null,
      ai_draft: byKey.get(draftKey("ai_draft", inquiryId!)) ?? null,
      original_ai_draft: byKey.get(draftKey("original_ai_draft", inquiryId!)) ?? null,
      quote,
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
