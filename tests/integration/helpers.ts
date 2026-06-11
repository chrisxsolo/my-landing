import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.test" });

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";

const url = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY ?? "";
const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? "";

if (!serviceKey || !anonKey) {
  throw new Error("Set SUPABASE_TEST_SERVICE_KEY / SUPABASE_TEST_ANON_KEY (see .env.test.example)");
}

export const service: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
export const anon: SupabaseClient = createClient(url, anonKey, {
  auth: { persistSession: false },
});

export function resetDb() {
  execSync("./scripts/content-engine/reset-test-db.sh", { stdio: "inherit" });
}

type SessionOverrides = Partial<{
  marketing_permission: boolean;
  ai_processing_allowed: boolean;
  service_type: string;
  school_slug: string | null;
  public_display_name: string | null;
  client_session_id: string | null;
}>;

export async function createTestSession(overrides: SessionOverrides = {}) {
  const { data, error } = await service
    .from("photography_sessions")
    .insert({
      service_type: "grads",
      public_display_name: "Mia",
      marketing_permission: true,
      marketing_permission_source: "contract",
      marketing_permission_confirmed_at: new Date().toISOString(),
      ai_processing_allowed: true,
      ai_processing_basis: "contract",
      ai_processing_confirmed_at: new Date().toISOString(),
      ...overrides,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function createTestPhoto(sessionId: string, opts: { derivative?: boolean; alt?: string } = {}) {
  const hash = createHash("sha256").update(randomUUID()).digest("hex");
  const { data, error } = await service
    .from("session_photos")
    .insert({
      photography_session_id: sessionId,
      storage_path: `originals/${sessionId}/${randomUUID()}.jpg`,
      content_hash: hash,
      alt_text: opts.alt ?? "Bay Area grad portrait by soloxsnaps",
      analysis_status: "completed",
      ...(opts.derivative === false
        ? {}
        : {
            public_derivative_url: `http://127.0.0.1:54321/storage/v1/object/public/grad-photos/engine/${sessionId}/${hash}.jpg`,
            public_derivative_storage_path: `engine/${sessionId}/${hash}.jpg`,
            public_derivative_content_hash: hash,
            public_derivative_created_at: new Date().toISOString(),
          }),
    })
    .select("id, content_hash, public_derivative_url")
    .single();
  if (error) throw error;
  return data as { id: string; content_hash: string; public_derivative_url: string | null };
}

export async function createPackage(
  sessionId: string,
  selectedTypes: string[] = ["journal_post"],
  facts: Record<string, unknown> = { service_type: "grads" },
  archiveCurrent = false, // pass true when a test creates several packages on one session
) {
  const { data, error } = await service.rpc("create_content_package", {
    p_session_id: sessionId,
    p_model_name: "claude-sonnet-4-6",
    p_prompt_version: "v1",
    p_selected_types: selectedTypes,
    p_session_facts: facts,
    p_generation_settings: {},
    p_archive_current: archiveCurrent,
    p_copy_items: [],
  });
  if (error) throw error;
  return data as string; // package uuid
}

export async function createItem(
  packageId: string,
  contentType: string,
  payload: Record<string, unknown>,
  status: "draft" | "approved" = "approved",
) {
  const { data, error } = await service
    .from("session_content_items")
    .insert({
      package_id: packageId,
      content_type: contentType,
      status,
      payload,
      idempotency_key: `${packageId}:${contentType}:${randomUUID()}`,
      ...(status === "approved" ? { approved_at: new Date().toISOString(), approved_by: "test" } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function publish(itemId: string) {
  return service.rpc("publish_session_content_item", { p_item_id: itemId });
}

// The public derivatives bucket exists in production but not in the local
// stack (the baseline dump is schema-only). Tests create it on demand.
export async function ensurePublicBucket(name: string) {
  const { error } = await service.storage.createBucket(name, { public: true });
  if (error && !/already exists/i.test(error.message)) throw error;
}
