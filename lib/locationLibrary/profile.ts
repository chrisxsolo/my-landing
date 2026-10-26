// Runs the AI profile for one library location and writes ONLY unlocked
// fields. An empty model answer leaves the field as it was (for review). A
// failure is recorded on the row (ai_error) so the admin can retry.
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_ENGINE_MODEL, type ModelCaller } from "@/lib/contentEngine/aiClient";
import { buildLocationProfilePrompt, parseLocationProfile, type LocationProfile } from "@/lib/locationLibrary/profilePrompt";
import { loadLibraryLocations, type LibraryLocation, type LinkedSession } from "@/lib/locationLibrary/load";
import { AI_FIELDS, LOCATIONS_TABLE, type AiField } from "@/lib/locationLibrary/taxonomy";

const PROFILE_TIMEOUT_MS = 60_000;
const PROFILE_MAX_TOKENS = 1_200;

export interface ProfileResult {
  locationId: number;
  status: "updated" | "skipped" | "failed";
  updatedFields: AiField[];
  message: string;
}

function lockedContext(loc: LibraryLocation): Record<string, string> {
  const row = loc.row as unknown as Record<string, unknown>;
  return Object.fromEntries(
    AI_FIELDS.filter((f) => loc.row.locked_fields.includes(f) && f !== "environments")
      .map((f) => [f, String(row[f] ?? "")]),
  );
}

/** Unlocked, non-empty answers only — never blanks a field and never touches a lock. */
export function profileUpdates(loc: LibraryLocation, profile: LocationProfile): Partial<Record<AiField, unknown>> {
  const updates: Partial<Record<AiField, unknown>> = {};
  for (const field of AI_FIELDS) {
    if (loc.row.locked_fields.includes(field)) continue;
    const value = profile[field];
    const empty = Array.isArray(value) ? value.length === 0 : !value;
    if (!empty) updates[field] = value;
  }
  return updates;
}

function evidenceFor(loc: LibraryLocation, sessions: Map<string, LinkedSession>) {
  const linked = loc.links.filter((l) => !l.excluded).map((l) => sessions.get(l.sessionId)).filter((s): s is LinkedSession => !!s);
  return {
    sessions: linked.map((s) => ({
      kinds: s.kinds, lightingCondition: s.lightingCondition, startTime: s.startTime, vibe: s.vibe,
    })),
    photos: loc.photos
      .filter((p) => p.state === "public" || p.state === "not_public")
      .sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0))
      .map((p) => ({ title: p.title, description: p.description, tags: p.tags })),
  };
}

async function recordError(client: SupabaseClient, id: number, message: string) {
  const { error } = await client.from(LOCATIONS_TABLE).update({ ai_error: message.slice(0, 500) }).eq("id", id);
  if (error) console.error(`[location-library] could not record AI error for ${id}`, error.message);
}

export async function generateLocationProfile(
  client: SupabaseClient, callModel: ModelCaller, locationId: number,
): Promise<ProfileResult> {
  const base = { locationId, updatedFields: [] as AiField[] };
  const { locations, sessions } = await loadLibraryLocations(client, { ids: [locationId] });
  const loc = locations[0];
  if (!loc) return { ...base, status: "failed", message: "location not found" };
  if (!loc.place) {
    return { ...base, status: "skipped", message: "Link this location to a verified place before generating." };
  }
  if (AI_FIELDS.every((f) => loc.row.locked_fields.includes(f))) {
    return { ...base, status: "skipped", message: "Every AI field is locked — set a field back to Auto first." };
  }
  try {
    const prompt = buildLocationProfilePrompt({ place: loc.place, ...evidenceFor(loc, sessions), lockedContext: lockedContext(loc) });
    const response = await callModel({
      model: DEFAULT_ENGINE_MODEL, system: prompt.system, maxTokens: PROFILE_MAX_TOKENS,
      messages: [{ role: "user", content: prompt.userText }], timeoutMs: PROFILE_TIMEOUT_MS, maxRetries: 1,
    });
    const updates = profileUpdates(loc, parseLocationProfile(response.text));
    const { error } = await client.from(LOCATIONS_TABLE)
      .update({ ...updates, ai_generated_at: new Date().toISOString(), ai_error: null }).eq("id", locationId);
    if (error) throw new Error(`could not save the profile: ${error.message}`);
    const updatedFields = Object.keys(updates) as AiField[];
    const left = AI_FIELDS.filter((f) => !loc.row.locked_fields.includes(f) && !updatedFields.includes(f));
    return {
      locationId, status: "updated", updatedFields,
      message: left.length ? `Left for review (not enough evidence): ${left.join(", ")}` : "Profile updated.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI profile failed";
    console.error(`[location-library] profile failed for ${locationId}`, err);
    await recordError(client, locationId, message);
    return { ...base, status: "failed", message };
  }
}
