// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/nav-config   (admin-only, service-role)
//
//   GET → { config: NavConfig }   saved nav config, or the default when unset
//   PUT → body { config }         normalize + upsert the whole nav as one JSON
//                                 row in site_settings under `nav_config`
//
// The nav lives outside the generic /api/admin/site-settings allowlist because
// it is a large JSON blob with its own shape; parseNavConfig sanitizes every
// label/href before it is stored or rendered.
// ─────────────────────────────────────────────────────────────────────────────

import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";
import { NAV_CONFIG_SETTING_KEY, DEFAULT_NAV_CONFIG, parseNavConfig } from "@/lib/navConfig";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", NAV_CONFIG_SETTING_KEY)
      .maybeSingle();
    if (error) throw error;

    const config = data?.value ? parseNavConfig(data.value) : DEFAULT_NAV_CONFIG;
    return NextResponse.json({ config });
  } catch (err) {
    console.error("[admin/nav-config] GET failed:", err);
    return NextResponse.json({ error: "Failed to load navigation." }, { status: 500 });
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

  const { config } = (body ?? {}) as { config?: unknown };
  // Normalize untrusted input — strips bad labels/hrefs and falls back to the
  // default if the payload is unusable, so we never persist a broken nav.
  const normalized = parseNavConfig(config);

  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from("site_settings")
      .upsert(
        { key: NAV_CONFIG_SETTING_KEY, value: JSON.stringify(normalized), updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw error;
    return NextResponse.json({ ok: true, config: normalized });
  } catch (err) {
    console.error("[admin/nav-config] PUT failed:", err);
    return NextResponse.json({ error: "Failed to save navigation." }, { status: 500 });
  }
}
