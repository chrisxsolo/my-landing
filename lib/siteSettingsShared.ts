// ─────────────────────────────────────────────────────────────────────────────
// lib/siteSettingsShared.ts
//
// Pure helpers shared by the /api/admin/site-settings and /api/admin/drafts
// route handlers. No DB / Next imports → unit-testable in isolation.
//
// site_settings is a "junk drawer": public image/cover keys, reminder templates,
// per-inquiry draft sync, AND (historically) secret OAuth tokens. These helpers
// enforce a strict allowlist for the generic settings endpoint and guarantee
// secret-shaped values can never be returned to the browser.
// ─────────────────────────────────────────────────────────────────────────────

// Non-secret, browser-editable settings keys (homepage covers + pricing photos).
// Anything not in this set is rejected by the generic settings endpoint.
export const EDITABLE_SETTING_KEYS = [
  "home_cover_grads",
  "home_cover_families",
  "home_cover_contact",
  "home_editorial_large",
  "home_editorial_small",
  "pricing_grad_standard_image",
  "pricing_grad_group_image",
  "pricing_card_families_image",
  "pricing_family_session_image",
  "pricing_family_extended_image",
  "pricing_couples_standard_image",
  "pricing_couples_engagement_image",
  "pricing_couples_proposal_image",
  "pricing_event_primary_image",
  "pricing_event_secondary_image",
] as const;

export type EditableSettingKey = (typeof EDITABLE_SETTING_KEYS)[number];

const EDITABLE_SET = new Set<string>(EDITABLE_SETTING_KEYS);

export function isEditableSettingKey(key: unknown): key is EditableSettingKey {
  return typeof key === "string" && EDITABLE_SET.has(key);
}

// Key-name patterns that indicate a secret — never editable or returnable via
// the generic endpoint, regardless of the allowlist.
const SECRET_KEY_PATTERN = /(token|secret|password|passwd|api[_-]?key|credential|client_secret|refresh|private[_-]?key)/i;

export function isSecretSettingKey(key: unknown): boolean {
  return typeof key === "string" && SECRET_KEY_PATTERN.test(key);
}

// Value-shape detector: catches OAuth/credential blobs even if they ever land
// under a non-secret key. Used to scrub responses (defense-in-depth).
export function looksLikeSecretValue(value: unknown): boolean {
  if (typeof value !== "string" || value.length === 0) return false;
  const v = value;
  if (/("?(access_token|refresh_token|client_secret|id_token|private_key)"?\s*[:=])/i.test(v)) return true;
  if (/\bya29\.[A-Za-z0-9_\-]+/.test(v)) return true;       // Google access token
  if (/^1\/\/[A-Za-z0-9_\-]+/.test(v)) return true;          // Google refresh token
  if (/\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/.test(v)) return true; // JWT
  if (/\bsk-[A-Za-z0-9]{16,}/.test(v)) return true;          // common API-key prefix
  return false;
}

export type SettingRow = { key: string; value: string | null };

// Returns only allowlisted, non-secret-shaped settings as a map. Anything that
// is not explicitly editable, or whose value looks like a secret, is dropped.
export function filterReadableSettings(rows: SettingRow[] | null | undefined): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const row of rows ?? []) {
    if (!isEditableSettingKey(row.key)) continue;
    if (isSecretSettingKey(row.key)) continue;
    if (looksLikeSecretValue(row.value)) continue;
    out[row.key] = row.value;
  }
  return out;
}

// Validate an incoming value for an editable image-URL setting. null clears it.
const MAX_SETTING_VALUE_LEN = 2048;

export function isValidSettingValue(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  if (value.length > MAX_SETTING_VALUE_LEN) return false;
  if (looksLikeSecretValue(value)) return false; // never let a secret be written under an image key
  return true;
}

// ── Per-inquiry draft sync keys (conversation page) ──────────────────────────
// e.g. draft_42, ai_draft_42, original_ai_draft_42. inquiryId is a bigint id.
export const DRAFT_KEY_PREFIXES = ["draft", "ai_draft", "original_ai_draft"] as const;
export type DraftKind = (typeof DRAFT_KEY_PREFIXES)[number];

export function isValidInquiryId(id: unknown): boolean {
  if (typeof id === "number") return Number.isInteger(id) && id > 0;
  if (typeof id === "string") return /^[0-9]+$/.test(id);
  return false;
}

export function draftKey(kind: DraftKind, inquiryId: number | string): string {
  return `${kind}_${inquiryId}`;
}

export function isDraftKey(key: unknown): boolean {
  return typeof key === "string" && /^(original_ai_draft|ai_draft|draft)_[0-9]+$/.test(key);
}
