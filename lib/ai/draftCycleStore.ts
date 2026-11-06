// ─────────────────────────────────────────────────────────────────────────────
// Persisting one AI draft cycle, server-side.
//
// The browser used to PUT draft_<id> and ai_draft_<id> after every generation.
// The pricing profile that produced the draft is resolved on the server from
// thread context the row-only restore cannot see, so it must be stored WITH
// the draft it describes, by the same statement: a text row saved without its
// profile, or a profile saved without its text, is exactly the inconsistency
// a reload would then trust.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import { draftKey, SITE_SETTINGS_TABLE } from "@/lib/siteSettingsShared";
import {
  buildDraftPricingProfileSnapshot,
  draftPricingProfileKey,
  serializeDraftPricingProfileSnapshot,
  type DraftPricingProfile,
} from "./draftPricingProfileSnapshot";

export type PersistDraftCycleInput = {
  inquiryId: number;
  /** The draft as returned to the admin: compose text and AI baseline alike. */
  draft: string;
  profile: DraftPricingProfile | null;
  /**
   * Whether this result may start a cycle. Only a fresh generation can; a
   * regeneration or an edit never overwrites the cycle's first AI draft,
   * which "Learn from reply" keeps for the regeneration metric.
   */
  startsCycle: boolean;
};

type SettingRow = { key: string; value: string; updated_at: string };

/**
 * Writes draft, ai_draft and the profile snapshot in one upsert, plus the
 * cycle's original AI draft when none is stored yet. Throws on failure so the
 * route can report it instead of returning a draft the browser would then
 * persist without its profile.
 */
export async function persistDraftCycle(supabase: SupabaseClient, input: PersistDraftCycleInput): Promise<void> {
  const { inquiryId, draft, profile } = input;
  const now = new Date().toISOString();
  const rows: SettingRow[] = [
    { key: draftKey("draft", inquiryId), value: draft, updated_at: now },
    { key: draftKey("ai_draft", inquiryId), value: draft, updated_at: now },
    {
      key: draftPricingProfileKey(inquiryId),
      value: serializeDraftPricingProfileSnapshot(buildDraftPricingProfileSnapshot(profile, draft)),
      updated_at: now,
    },
  ];

  if (input.startsCycle) {
    const originalKey = draftKey("original_ai_draft", inquiryId);
    const { data, error } = await supabase.from(SITE_SETTINGS_TABLE).select("key").in("key", [originalKey]);
    if (error) throw error;
    if (!(data ?? []).length) rows.push({ key: originalKey, value: draft, updated_at: now });
  }

  const { error } = await supabase.from(SITE_SETTINGS_TABLE).upsert(rows, { onConflict: "key" });
  if (error) throw error;
}
