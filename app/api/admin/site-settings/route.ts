// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/site-settings   (admin-only, service-role)
//
//   GET    → { settings: { <editableKey>: value } }   non-secret allowlist only
//   PUT    → body { key, value }  upsert one editable setting (value may be null)
//   DELETE → body { key }         clear one editable setting
//
// Replaces the admin panel's direct browser `supabase.from('site_settings')`
// access. The allowlist + secret-shape filter guarantee gmail_tokens (and any
// other secret) can never be read or written through this endpoint.
// ─────────────────────────────────────────────────────────────────────────────

import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  EDITABLE_SETTING_KEYS,
  isEditableSettingKey,
  isValidSettingValue,
  filterReadableSettings,
} from "@/lib/siteSettingsShared";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("key,value")
      .in("key", [...EDITABLE_SETTING_KEYS]);
    if (error) throw error;

    // filterReadableSettings re-applies the allowlist + secret scrub server-side.
    return NextResponse.json({ settings: filterReadableSettings(data) });
  } catch (err) {
    console.error("[admin/site-settings] GET failed:", err);
    return NextResponse.json({ error: "Failed to load settings." }, { status: 500 });
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

  const { key, value } = (body ?? {}) as { key?: unknown; value?: unknown };
  if (!isEditableSettingKey(key)) {
    return NextResponse.json({ error: "Unknown or non-editable setting key." }, { status: 400 });
  }
  if (!isValidSettingValue(value)) {
    return NextResponse.json({ error: "Invalid setting value." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;
    return NextResponse.json({ ok: true, key, value });
  } catch (err) {
    console.error("[admin/site-settings] PUT failed:", err);
    return NextResponse.json({ error: "Failed to save setting." }, { status: 500 });
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

  const { key } = (body ?? {}) as { key?: unknown };
  if (!isEditableSettingKey(key)) {
    return NextResponse.json({ error: "Unknown or non-editable setting key." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("site_settings").delete().eq("key", key);
    if (error) throw error;
    return NextResponse.json({ ok: true, key });
  } catch (err) {
    console.error("[admin/site-settings] DELETE failed:", err);
    return NextResponse.json({ error: "Failed to delete setting." }, { status: 500 });
  }
}
