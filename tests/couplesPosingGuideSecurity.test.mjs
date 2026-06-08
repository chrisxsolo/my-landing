import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const adminRoutePath = new URL("../app/api/admin/couples-posing-guide/route.ts", import.meta.url);
const pagePath = new URL("../app/(professional)/couples-posing-guide/page.tsx", import.meta.url);
const migrationPath = new URL(
  "../supabase/migrations/20260607000000_create_couples_posing_guide.sql",
  import.meta.url,
);
const adminPagePath = new URL("../app/admin/page.tsx", import.meta.url);
const adminEditorPath = new URL("../app/admin/CouplesInspirationEditor.tsx", import.meta.url);
const promptRoutePath = new URL("../app/api/admin/couples-posing-prompts/route.ts", import.meta.url);
const promptManagerPath = new URL("../app/admin/CouplesPromptManager.tsx", import.meta.url);
const promptMigrationPath = new URL(
  "../supabase/migrations/20260608000417_create_couples_posing_prompts.sql",
  import.meta.url,
);

test("admin inspiration API protects every handler with requireAdmin", async () => {
  const source = await readFile(adminRoutePath, "utf8");
  for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
    assert.match(source, new RegExp(`export async function ${method}`));
  }
  assert.ok((source.match(/requireAdmin\(req\)/g) ?? []).length >= 4);
});

test("guide page resolves admin mode on the server and filters images before hydration", async () => {
  const source = await readFile(pagePath, "utf8");
  assert.match(source, /await cookies\(\)/);
  assert.match(source, /filterInspirationImagesForMode/);
  assert.match(source, /displayMode === "photographer"/);
});

test("migration creates a private bucket and keeps table access server-only", async () => {
  const source = await readFile(migrationPath, "utf8");
  assert.match(source, /couples_inspiration_images/);
  assert.match(source, /couples-posing-inspiration/);
  assert.match(source, /public\s*=\s*false/i);
  assert.match(source, /force row level security/i);
  assert.match(source, /grant all on public\.couples_inspiration_images to service_role/i);
  assert.doesNotMatch(source, /grant .*couples_inspiration_images.*anon/i);
});

test("existing admin dashboard exposes the couples guide manager as a real tab", async () => {
  const [pageSource, editorSource] = await Promise.all([
    readFile(adminPagePath, "utf8"),
    readFile(adminEditorPath, "utf8"),
  ]);
  assert.match(pageSource, /couplesGuide/);
  assert.match(pageSource, /Couples Posing Guide/);
  assert.match(pageSource, /<CouplesPosingGuideTab/);
  assert.match(editorSource, /Only publish images you created, licensed, or have permission to display/);
  assert.match(editorSource, /Add external reference/);
  assert.match(editorSource, /multiple/);
});

test("admin prompt API protects every mutation with requireAdmin", async () => {
  const source = await readFile(promptRoutePath, "utf8");
  for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
    assert.match(source, new RegExp(`export async function ${method}`));
  }
  assert.ok((source.match(/requireAdmin\(req\)/g) ?? []).length >= 4);
});

test("prompt migration seeds all 23 prompts and keeps writes server-only", async () => {
  const source = await readFile(promptMigrationPath, "utf8");
  assert.match(source, /create table if not exists public\.couples_posing_prompts/i);
  assert.match(source, /grant all on public\.couples_posing_prompts to service_role/i);
  assert.doesNotMatch(source, /grant .*couples_posing_prompts.*anon/i);
  assert.match(source, /generate_series\(1,\s*23\)|High Arm Swing Walk/);
  assert.match(source, /Piggyback Sway/);
});

test("mobile admin includes a prompt editor and database-backed prompt loading", async () => {
  const [managerSource, pageSource, editorSource] = await Promise.all([
    readFile(promptManagerPath, "utf8"),
    readFile(pagePath, "utf8"),
    readFile(adminEditorPath, "utf8"),
  ]);
  assert.match(managerSource, /Add prompt/);
  assert.match(managerSource, /Directing language/);
  assert.match(managerSource, /api\/admin\/couples-posing-prompts/);
  assert.match(pageSource, /listCouplesPosingPrompts/);
  assert.match(editorSource, /prompts:/);
  assert.doesNotMatch(editorSource, /COUPLES_POSING_PROMPTS\.map/);
});
