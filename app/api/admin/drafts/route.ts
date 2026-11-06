// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/drafts   (admin-only, service-role)
//
// Per-inquiry cross-device draft sync, previously stored via the browser anon
// client in site_settings keys draft_<id> / ai_draft_<id> / original_ai_draft_<id>.
// Kept separate from /api/admin/site-settings so that endpoint's allowlist stays
// strictly the non-secret public image/cover keys.
//
//   GET    ?inquiryId=42                  → { draft, ai_draft, original_ai_draft, quote, warnings }
//   PUT    { inquiryId, draft?, ai_draft?, original_ai_draft? } → upsert provided
//   DELETE { inquiryId, kinds? }          → delete (default: draft + ai_draft)
//
// `quote` is the rate card's inputs for this inquiry (lib/ai/inquiryQuote),
// computed from the inquiry row with no model call. A restored draft used to
// come back without one, so the pricing check never ran on it: a stored draft
// quoting the old $70 SJSU travel fee restored silently.
//
// The row alone cannot see the Gmail context that resolves a special pricing
// profile, so /api/draft-reply stores a server-owned profile snapshot beside
// the draft (lib/ai/draftPricingProfileSnapshot). GET honours it only when it
// still matches the stored AI baseline; PUT never accepts one from the
// browser; DELETE clears it with the cycle.
// ─────────────────────────────────────────────────────────────────────────────

import { type NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";
import { buildQuoteInputForInquiry, type QuoteSubject } from "@/lib/ai/inquiryQuote";
import type { QuoteInput } from "@/lib/ai/quotePricing";
import type { ContextWarning } from "@/lib/ai/buildEmailContext";
import { draftPricingProfileKey, readDraftPricingProfileSnapshot, type DraftPricingProfile } from "@/lib/ai/draftPricingProfileSnapshot";
import { resolvedSportsTeamPortraitOffer, SPORTS_TEAM_PORTRAIT_PLAYBOOK } from "@/lib/ai/sportsTeamPortraitPricing";
import {
  DRAFT_KEY_PREFIXES,
  SITE_SETTINGS_TABLE,
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
 *
 * A verified profile rebuilds the special quote from the profile's current
 * source plus the row's own location and travel fields. Nothing numeric is
 * ever read back from storage.
 */
async function fetchInquiryQuote(
  supabase: SupabaseClient, inquiryId: string, profile: DraftPricingProfile | null,
): Promise<RestoredQuote | null> {
  try {
    const { data, error } = await supabase
      .from(INQUIRIES_TABLE).select(QUOTE_COLUMNS).eq("id", inquiryId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as { session_type?: string | null; message?: string | null; school?: string | null; location?: string | null; people?: string | number | null };
    const subject: QuoteSubject = {
      sessionType: row.session_type, message: row.message, school: row.school, location: row.location, people: row.people,
    };
    const special = profile === SPORTS_TEAM_PORTRAIT_PLAYBOOK ? resolvedSportsTeamPortraitOffer() : null;
    const { input, stalePrices } = buildQuoteInputForInquiry(subject, { profile: special });
    return { input, stalePrices };
  } catch (err) {
    console.error("[admin/drafts] quote inputs unavailable:", err);
    return null;
  }
}

const RESTORE_INVALID: ContextWarning = {
  code: "pricing_profile_restore_invalid",
  severity: "high",
  message: "The saved draft's pricing profile did not match the saved AI draft, so the restored pricing check uses the ordinary rate card. Check the prices before sending, or regenerate.",
};

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const inquiryId = req.nextUrl.searchParams.get("inquiryId");
  if (!isValidInquiryId(inquiryId)) {
    return NextResponse.json({ error: "Valid inquiryId required." }, { status: 400 });
  }

  try {
    const profileKey = draftPricingProfileKey(inquiryId!);
    const keys = [...DRAFT_KEY_PREFIXES.map((k) => draftKey(k, inquiryId!)), profileKey];
    const supabase = createSupabaseServerClient();
    // Draft rows and the snapshot in one query: the digest check below needs
    // the ai_draft the snapshot was written with, read at the same moment.
    const { data, error } = await supabase.from(SITE_SETTINGS_TABLE).select("key,value").in("key", keys);
    if (error) throw error;

    const byKey = new Map((data ?? []).map((r) => [r.key, r.value]));
    const aiDraft = (byKey.get(draftKey("ai_draft", inquiryId!)) as string | undefined) ?? null;
    const snapshot = readDraftPricingProfileSnapshot(byKey.get(profileKey) as string | undefined, aiDraft);
    const profile = snapshot.status === "valid" ? snapshot.profile : null;
    const warnings: ContextWarning[] = snapshot.status === "invalid" ? [RESTORE_INVALID] : [];
    if (snapshot.status === "invalid") console.error(`[admin/drafts] pricing profile snapshot rejected (${snapshot.reason}) for inquiry ${inquiryId}`);

    const quote = await fetchInquiryQuote(supabase, inquiryId!, profile);
    return NextResponse.json({
      draft: byKey.get(draftKey("draft", inquiryId!)) ?? null,
      ai_draft: aiDraft,
      original_ai_draft: byKey.get(draftKey("original_ai_draft", inquiryId!)) ?? null,
      quote,
      warnings,
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
    // Only DRAFT_KEY_PREFIXES rows reach this upsert. The pricing-profile
    // snapshot is not one of them, so no browser payload can create, replace
    // or clear it; /api/draft-reply is its only writer.
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from(SITE_SETTINGS_TABLE).upsert(rows, { onConflict: "key" });
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
    // The snapshot describes the draft cycle, so it goes whenever the cycle's
    // text rows go, even when the browser names only those kinds. Clearing the
    // first-draft baseline alone leaves the live draft and its snapshot intact.
    const clearsCycle = requested.some((k) => k === "draft" || k === "ai_draft");
    const keys = [
      ...requested.map((k) => draftKey(k, inquiryId as number | string)),
      ...(clearsCycle ? [draftPricingProfileKey(inquiryId as number | string)] : []),
    ];
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from(SITE_SETTINGS_TABLE).delete().in("key", keys);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/drafts] DELETE failed:", err);
    return NextResponse.json({ error: "Failed to delete drafts." }, { status: 500 });
  }
}
