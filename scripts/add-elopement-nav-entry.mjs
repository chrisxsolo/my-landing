// Adds "Elopement rates" to the Rates group of the SAVED navigation.
//
// The nav lives as one JSON blob in site_settings under `nav_config`
// (lib/navConfig.ts). A row already exists, so DEFAULT_NAV_CONFIG is never
// read in production and editing it alone changes nothing on the live site.
//
// Run it only AFTER /pricing/elopements is deployed — the link 404s otherwise.
//
//   node scripts/add-elopement-nav-entry.mjs           # prints the change
//   node scripts/add-elopement-nav-entry.mjs --apply   # writes it
//
// Idempotent: re-running after a successful apply is a no-op. The previous
// value is printed before any write, so it can be restored by hand.

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const SETTING_KEY = "nav_config";
const GROUP_ID = "rates";
const ENTRY = { id: "elopement-rates", label: "Elopement rates", href: "/pricing/elopements" };
/** Keeps the dropdown alphabetical the way the saved nav already is. */
const INSERT_AFTER = "couples-rates";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data, error } = await supabase
  .from("site_settings")
  .select("value")
  .eq("key", SETTING_KEY)
  .maybeSingle();

if (error) {
  console.error("Failed to read nav_config:", error.message);
  process.exit(1);
}
if (!data?.value) {
  console.log("No nav_config row is saved, so the site renders DEFAULT_NAV_CONFIG, which already has the entry. Nothing to do.");
  process.exit(0);
}

const config_ = JSON.parse(data.value);
const rates = config_.primary?.find((item) => item.id === GROUP_ID);
if (!rates || !Array.isArray(rates.children)) {
  console.error(`No "${GROUP_ID}" group with children in the saved nav. Add the entry in the admin nav editor instead.`);
  process.exit(1);
}
if (rates.children.some((child) => child.id === ENTRY.id || child.href === ENTRY.href)) {
  console.log("Elopement rates is already in the saved nav. Nothing to do.");
  process.exit(0);
}

const at = rates.children.findIndex((child) => child.id === INSERT_AFTER);
rates.children.splice(at === -1 ? rates.children.length : at + 1, 0, ENTRY);

console.log("── previous value (keep this to roll back) ──");
console.log(data.value);
console.log("\n── Rates dropdown after the change ──");
console.log(rates.children.map((child) => `  ${child.label} → ${child.href}`).join("\n"));

if (!apply) {
  console.log("\nDry run. Re-run with --apply to write it.");
  process.exit(0);
}

const { error: writeError } = await supabase
  .from("site_settings")
  .upsert(
    { key: SETTING_KEY, value: JSON.stringify(config_), updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
if (writeError) {
  console.error("Failed to write nav_config:", writeError.message);
  process.exit(1);
}
console.log("\nSaved. The nav is cached by the public-content layer, so POST /api/admin/revalidate (or wait an hour) to show it.");
