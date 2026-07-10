// ─────────────────────────────────────────────────────────────────────────────
// One-off: repair inquiries.school using lib/schoolDetection.ts
// ─────────────────────────────────────────────────────────────────────────────
// Browser autofill has been dropping junk like "CA" into the free-text school
// field, and reply subjects fell back to a generic "Graduation Inquiry" even
// when the location/message clearly named the school. Ingestion now normalizes
// new inquiries (app/api/contact/route.ts); this script repairs existing rows:
//   • a recognized school is rewritten to its canonical name ("sjsu" →
//     "San Jose State University")
//   • a junk value ("CA") is replaced by a detection from location/message
//   • unknown-but-plausible values are left as typed
// Only graduation inquiries are touched. Reply subjects are never persisted —
// they are rebuilt from this data by buildInquiryReplySubject — so no stored
// subject (and no manual edit) can be overwritten by this script.
//
// USAGE (env from .env.local is auto-loaded; needs Node 22.18+ for TS imports):
//   node scripts/backfill-inquiry-schools.mjs --dry-run   # preview, no writes
//   node scripts/backfill-inquiry-schools.mjs             # apply
//
// Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ─────────────────────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { resolveInquirySchoolField } from "../lib/schoolDetection.ts";

const DRY_RUN = process.argv.includes("--dry-run");

// ── tiny .env.local loader (only fills vars not already set) ──────────────────
function loadDotEnv() {
  const file = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

loadDotEnv();
const supabase = createClient(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
);

const { data: rows, error } = await supabase
  .from("inquiries")
  .select("id, name, email, school, location, message, session_type, date_in_mind")
  .ilike("session_type", "%grad%")
  .order("id");
if (error) {
  console.error("Failed to load inquiries:", error.message);
  process.exit(1);
}

let changed = 0;
for (const row of rows ?? []) {
  const resolved = resolveInquirySchoolField(row);
  if ((resolved ?? null) === (row.school ?? null)) continue;
  changed++;
  console.log(`#${row.id} ${row.name} <${row.email}>: ${JSON.stringify(row.school)} → ${JSON.stringify(resolved)}`);
  if (DRY_RUN) continue;
  const { error: updateError } = await supabase
    .from("inquiries")
    .update({ school: resolved })
    .eq("id", row.id);
  if (updateError) console.error(`  ✗ update failed for #${row.id}: ${updateError.message}`);
}

console.log(`\n${rows?.length ?? 0} graduation inquiries scanned, ${changed} school value${changed === 1 ? "" : "s"} ${DRY_RUN ? "would change (dry run — nothing written)" : "updated"}.`);
