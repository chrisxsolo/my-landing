// ─────────────────────────────────────────────────────────────────────────────
// Which verified pricing profile produced a saved AI draft.
//
// A fresh draft is checked against a thread-aware quote input. A restored one
// (/api/admin/drafts) is rebuilt from the inquiry row, which cannot see the
// Gmail context that resolved a special profile, so a correct sports-team
// draft used to come back checked against ordinary graduation pricing.
//
// The snapshot records only WHICH profile applied, bound to the exact AI
// baseline it describes by digest. No prices and no prose are stored: current
// figures always come from the profile's own source of truth at restore time,
// and the digest exists only so a snapshot can never be paired with a draft it
// did not describe. The browser never writes it; /api/draft-reply does, in
// the same statement as the draft rows it belongs to.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "node:crypto";
import type { EmailContext } from "./buildEmailContext";
import { SPORTS_TEAM_PORTRAIT_PLAYBOOK } from "./sportsTeamPortraitPricing";

export const DRAFT_PRICING_PROFILE_VERSION = 1 as const;

/** Profiles a snapshot may name. Anything else fails closed on read. */
export type DraftPricingProfile = typeof SPORTS_TEAM_PORTRAIT_PLAYBOOK;

const KNOWN_PROFILES: readonly string[] = [SPORTS_TEAM_PORTRAIT_PLAYBOOK];

export type DraftPricingProfileSnapshot = {
  version: typeof DRAFT_PRICING_PROFILE_VERSION;
  profile: DraftPricingProfile | null;
  /** Digest of the ai_draft row this snapshot was written with. A binding, never a pricing input. */
  aiDraftSha256: string;
};

/**
 * Server-only site_settings key. Deliberately outside DRAFT_KEY_PREFIXES and
 * not sharing their "draft_" prefix, so no prefix-based read or write can
 * ever sweep it up with the browser-editable rows.
 */
export const DRAFT_PRICING_PROFILE_KEY_PREFIX = "ai_pricing_profile";

export function draftPricingProfileKey(inquiryId: number | string): string {
  return `${DRAFT_PRICING_PROFILE_KEY_PREFIX}_${inquiryId}`;
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** The profile a built context resolved to, or null for every ordinary session. */
export function profileOfContext(context: EmailContext): DraftPricingProfile | null {
  return context.client.playbook === SPORTS_TEAM_PORTRAIT_PLAYBOOK ? SPORTS_TEAM_PORTRAIT_PLAYBOOK : null;
}

export function buildDraftPricingProfileSnapshot(profile: DraftPricingProfile | null, aiDraft: string): DraftPricingProfileSnapshot {
  return { version: DRAFT_PRICING_PROFILE_VERSION, profile, aiDraftSha256: sha256Hex(aiDraft) };
}

export function serializeDraftPricingProfileSnapshot(snapshot: DraftPricingProfileSnapshot): string {
  return JSON.stringify(snapshot);
}

export type DraftPricingProfileRead =
  | { status: "absent" }
  | { status: "valid"; profile: DraftPricingProfile | null }
  | { status: "invalid"; reason: string };

/**
 * Reads a stored snapshot against the stored AI baseline.
 *
 * Absent is the normal case for a draft saved before snapshots existed and
 * keeps the generic restored quote. Anything malformed, of another version,
 * naming an unknown profile, or whose digest does not match the baseline is
 * invalid: the caller falls back to no special profile AND tells the admin.
 */
export function readDraftPricingProfileSnapshot(
  raw: string | null | undefined,
  aiDraft: string | null | undefined,
): DraftPricingProfileRead {
  if (raw == null || raw === "") return { status: "absent" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "invalid", reason: "malformed" };
  }
  if (!parsed || typeof parsed !== "object") return { status: "invalid", reason: "malformed" };

  const { version, profile, aiDraftSha256 } = parsed as Record<string, unknown>;
  if (version !== DRAFT_PRICING_PROFILE_VERSION) return { status: "invalid", reason: "unknown_version" };
  if (profile !== null && (typeof profile !== "string" || !KNOWN_PROFILES.includes(profile))) {
    return { status: "invalid", reason: "unknown_profile" };
  }
  if (typeof aiDraftSha256 !== "string" || aiDraft == null || aiDraftSha256 !== sha256Hex(aiDraft)) {
    return { status: "invalid", reason: "digest_mismatch" };
  }
  return { status: "valid", profile: profile as DraftPricingProfile | null };
}
