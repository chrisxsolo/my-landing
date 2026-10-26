// photo_tag_reviews: the photographer's review decisions and cached AI vision
// suggestions, one row per photo key. Server-only, service role.
// Rows only ever ADD context to the live audit — deleting every row returns
// each photo to its computed status, so nothing here can publish a photo.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  NOT_APPLICABLE_FIELDS, PHOTO_TAG_REVIEWS_TABLE,
  type NotApplicableField, type TagSuggestion,
} from "@/lib/photoTagging/types";

export interface PhotoReview {
  key: string;
  notApplicable: NotApplicableField[];
  dismissed: string[];
  ai: TagSuggestion[];
  aiInputHash: string | null;
  aiAnalyzedAt: string | null;
}

const FIELDS = new Set<string>(["category", "school", "location", "spot"]);

function isSuggestion(value: unknown): value is TagSuggestion {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return typeof s.id === "string" && typeof s.value === "string" && typeof s.label === "string"
    && typeof s.field === "string" && FIELDS.has(s.field) && s.confidence === "medium"
    && s.origin === "vision" && typeof s.reason === "string";
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

function toReview(row: Record<string, unknown>): PhotoReview {
  return {
    key: String(row.photo_key),
    notApplicable: strings(row.not_applicable)
      .filter((f): f is NotApplicableField => (NOT_APPLICABLE_FIELDS as readonly string[]).includes(f)),
    dismissed: strings(row.dismissed),
    ai: Array.isArray(row.ai_suggestions) ? row.ai_suggestions.filter(isSuggestion) : [],
    aiInputHash: typeof row.ai_input_hash === "string" ? row.ai_input_hash : null,
    aiAnalyzedAt: typeof row.ai_analyzed_at === "string" ? row.ai_analyzed_at : null,
  };
}

export async function loadReviews(client: SupabaseClient, keys?: readonly string[]): Promise<Map<string, PhotoReview>> {
  let query = client.from(PHOTO_TAG_REVIEWS_TABLE)
    .select("photo_key,not_applicable,dismissed,ai_suggestions,ai_input_hash,ai_analyzed_at");
  if (keys) query = query.in("photo_key", [...keys]);
  const { data, error } = await query;
  if (error) throw new Error(`${PHOTO_TAG_REVIEWS_TABLE}: ${error.message}`);
  return new Map((data ?? []).map((row) => {
    const review = toReview(row as Record<string, unknown>);
    return [review.key, review];
  }));
}

type ReviewPatch = Partial<{
  not_applicable: string[]; dismissed: string[];
  ai_suggestions: TagSuggestion[]; ai_input_hash: string | null; ai_model: string | null; ai_analyzed_at: string;
}>;

async function upsert(client: SupabaseClient, rows: ({ photo_key: string } & ReviewPatch)[]): Promise<void> {
  if (rows.length === 0) return;
  const now = new Date().toISOString();
  const { error } = await client.from(PHOTO_TAG_REVIEWS_TABLE)
    .upsert(rows.map((r) => ({ ...r, updated_at: now })), { onConflict: "photo_key" });
  if (error) throw new Error(`could not save tag review: ${error.message}`);
}

/** Marks (or unmarks) a field as not applicable on each photo. Idempotent. */
export async function setNotApplicable(
  client: SupabaseClient, keys: readonly string[], field: NotApplicableField, on: boolean,
): Promise<void> {
  const existing = await loadReviews(client, keys);
  await upsert(client, keys.map((key) => {
    const current = existing.get(key)?.notApplicable ?? [];
    const next = on ? [...new Set([...current, field])] : current.filter((f) => f !== field);
    return { photo_key: key, not_applicable: next };
  }));
}

/** Records that the photographer rejected a suggestion so it is never offered again. */
export async function dismissSuggestion(client: SupabaseClient, key: string, suggestionId: string): Promise<void> {
  const current = (await loadReviews(client, [key])).get(key)?.dismissed ?? [];
  await upsert(client, [{ photo_key: key, dismissed: [...new Set([...current, suggestionId.slice(0, 200)])] }]);
}

export async function saveVisionSuggestions(
  client: SupabaseClient, key: string, suggestions: TagSuggestion[], inputHash: string, model: string,
): Promise<void> {
  await upsert(client, [{
    photo_key: key, ai_suggestions: suggestions, ai_input_hash: inputHash,
    ai_model: model, ai_analyzed_at: new Date().toISOString(),
  }]);
}
