// Session creation + facts updates (spec §7.1, §7.2). Creation from a client
// session prefills facts and sets public_display_name to FIRST NAME ONLY.
// Both permissions (marketing + ai_processing) are auto-enabled on every
// creation path, basis/source 'contract' — the contract covers both.
// The partial unique index on client_session_id makes duplicates impossible;
// we surface the existing id.
// Facts updates reject any value outside the canonical taxonomy (spec §8.5).
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeServiceType, isSchoolSlug, isLightingCondition, isVibe, isRelationshipType,
} from "@/lib/contentEngine/taxonomy";
import { sessionTypeToServiceType, firstNameOf } from "@/lib/contentEngine/prefill";

export const AI_PROCESSING_POLICY_VERSION = "2026-06-06"; // matches testimonials consent_version era

// Both permissions are always on for new sessions (contract covers marketing
// use and AI processing) — the workspace never requires a manual enable step.
function permissionDefaults(now: string): Record<string, unknown> {
  return {
    marketing_permission: true,
    marketing_permission_source: "contract",
    marketing_permission_confirmed_at: now,
    ai_processing_allowed: true,
    ai_processing_basis: "contract",
    ai_processing_policy_version: AI_PROCESSING_POLICY_VERSION,
    ai_processing_confirmed_at: now,
  };
}

export class CreateSessionConflictError extends Error {
  readonly existingSessionId: string;
  constructor(existingSessionId: string) {
    super("a photography session already exists for this client session");
    this.name = "CreateSessionConflictError";
    this.existingSessionId = existingSessionId;
  }
}

export interface CreateSessionArgs {
  client: SupabaseClient;
  input: { clientSessionId?: string; serviceType?: string };
}

export async function createPhotographySession(args: CreateSessionArgs): Promise<{ sessionId: string }> {
  const { client, input } = args;

  if (input.clientSessionId) {
    const { data: cs, error } = await client.from("client_sessions")
      .select("id,client_name,session_type,session_date,location").eq("id", input.clientSessionId).maybeSingle();
    if (error || !cs) throw new Error(`client session not found: ${error?.message ?? input.clientSessionId}`);

    const { data, error: insErr } = await client.from("photography_sessions").insert({
      client_session_id: cs.id,
      internal_client_name: cs.client_name,
      public_display_name: firstNameOf(cs.client_name),
      service_type: sessionTypeToServiceType(cs.session_type),
      session_date: cs.session_date ? (cs.session_date as string).slice(0, 10) : null,
      primary_location: cs.location,
      ...permissionDefaults(new Date().toISOString()),
    }).select("id").single();

    if (insErr) {
      if (insErr.code === "23505") {
        const { data: existing } = await client.from("photography_sessions")
          .select("id").eq("client_session_id", cs.id).single();
        throw new CreateSessionConflictError(existing!.id as string);
      }
      throw new Error(`could not create photography session: ${insErr.message}`);
    }
    return { sessionId: data.id as string };
  }

  const serviceType = normalizeServiceType(input.serviceType);
  if (!serviceType) {
    throw new Error(`invalid service type: ${input.serviceType ?? "(missing)"}`);
  }
  const { data, error } = await client.from("photography_sessions")
    .insert({ service_type: serviceType, ...permissionDefaults(new Date().toISOString()) })
    .select("id").single();
  if (error) throw new Error(`could not create photography session: ${error.message}`);
  return { sessionId: data.id as string };
}

// Whitelisted, taxonomy-validated facts patch (spec §7.4 Section 1 + §8.5).
const TEXT_FACTS = [
  "internal_client_name", "public_display_name", "primary_location",
  "degree", "internal_notes", "public_session_summary",
  "outfit_styling", "best_moment",
] as const;

export interface UpdateFactsArgs {
  client: SupabaseClient;
  sessionId: string;
  facts: Record<string, unknown>;
}

export async function updateSessionFacts(args: UpdateFactsArgs): Promise<{ updated: boolean }> {
  const { client, sessionId, facts } = args;
  const patch: Record<string, unknown> = {};

  if ("service_type" in facts) {
    // Tolerant of singular/plural/case variants ("couple" → "couples") so a
    // near-miss can never be stored and later break guide resolution.
    const normalized = normalizeServiceType(facts.service_type);
    if (!normalized) throw new Error(`invalid service type: ${String(facts.service_type)}`);
    patch.service_type = normalized;
  }
  if ("school_slug" in facts) {
    if (facts.school_slug !== null && !isSchoolSlug(facts.school_slug)) {
      throw new Error(`invalid school slug: ${String(facts.school_slug)}`);
    }
    patch.school_slug = facts.school_slug;
  }
  if ("lighting_condition" in facts) {
    if (facts.lighting_condition !== null && !isLightingCondition(facts.lighting_condition)) {
      throw new Error(`invalid lighting condition: ${String(facts.lighting_condition)}`);
    }
    patch.lighting_condition = facts.lighting_condition;
  }
  if ("vibe" in facts) {
    if (facts.vibe !== null && !isVibe(facts.vibe)) {
      throw new Error(`invalid vibe: ${String(facts.vibe)}`);
    }
    patch.vibe = facts.vibe;
  }
  if ("relationship_type" in facts) {
    if (facts.relationship_type !== null && !isRelationshipType(facts.relationship_type)) {
      throw new Error(`invalid relationship type: ${String(facts.relationship_type)}`);
    }
    patch.relationship_type = facts.relationship_type;
  }
  for (const key of TEXT_FACTS) {
    if (key in facts) {
      const v = facts[key];
      patch[key] = v === null ? null : typeof v === "string" ? v.slice(0, 2000) : String(v).slice(0, 2000);
    }
  }
  for (const key of ["session_date", "start_time"]) {
    if (key in facts) patch[key] = facts[key];
  }
  for (const key of ["graduation_year", "outfit_count", "group_size"]) {
    if (key in facts) {
      const v = facts[key];
      if (v !== null && (typeof v !== "number" || !Number.isInteger(v))) {
        throw new Error(`${key} must be an integer or null`);
      }
      patch[key] = v;
    }
  }
  if ("secondary_locations" in facts) {
    if (!Array.isArray(facts.secondary_locations)) throw new Error("secondary_locations must be an array");
    patch.secondary_locations = (facts.secondary_locations as unknown[]).map((s) => String(s).slice(0, 300));
  }
  if (Object.keys(patch).length === 0) return { updated: false };

  const { error } = await client.from("photography_sessions").update(patch).eq("id", sessionId);
  if (error) throw new Error(`facts update failed: ${error.message}`);
  return { updated: true };
}
