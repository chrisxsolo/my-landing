import test from "node:test";
import assert from "node:assert/strict";

import {
  EDITABLE_SETTING_KEYS,
  isEditableSettingKey,
  isSecretSettingKey,
  looksLikeSecretValue,
  filterReadableSettings,
  isValidSettingValue,
  isValidInquiryId,
  isDraftKey,
  draftKey,
} from "../lib/siteSettingsShared.ts";

test("allowlist accepts only known editable image keys", () => {
  assert.equal(isEditableSettingKey("home_cover_grads"), true);
  assert.equal(isEditableSettingKey("pricing_couples_standard_image"), true);
  // unknown keys rejected
  assert.equal(isEditableSettingKey("gmail_tokens"), false);
  assert.equal(isEditableSettingKey("draft_42"), false);
  assert.equal(isEditableSettingKey("reminder_subject_48hr"), false);
  assert.equal(isEditableSettingKey("random_key"), false);
  assert.equal(isEditableSettingKey(42), false);
  assert.equal(isEditableSettingKey(null), false);
});

test("gmail_tokens is never an editable key and reads as a secret key", () => {
  assert.equal(EDITABLE_SETTING_KEYS.includes("gmail_tokens"), false);
  assert.equal(isSecretSettingKey("gmail_tokens"), true);
  assert.equal(isSecretSettingKey("gmail_refresh_token"), true);
  assert.equal(isSecretSettingKey("api_key"), true);
  assert.equal(isSecretSettingKey("client_secret"), true);
  assert.equal(isSecretSettingKey("home_cover_grads"), false);
});

test("token-shaped values are detected", () => {
  assert.equal(looksLikeSecretValue('{"access_token":"abc","refresh_token":"x"}'), true);
  assert.equal(looksLikeSecretValue("ya29.A0ARrdaM-longtokenvalue"), true);
  assert.equal(looksLikeSecretValue("1//0gLongRefreshTokenValue"), true);
  assert.equal(looksLikeSecretValue("eyJhbGci.eyJzdWIi.SflKxwRJ"), true); // JWT
  assert.equal(looksLikeSecretValue("sk-ABCDEF0123456789ABCDEF"), true);
  assert.equal(
    looksLikeSecretValue("https://x.supabase.co/storage/v1/object/public/grad-photos/a.jpg"),
    false,
  );
  assert.equal(looksLikeSecretValue(null), false);
  assert.equal(looksLikeSecretValue(""), false);
});

test("filterReadableSettings returns only allowlisted, non-secret values", () => {
  const rows = [
    { key: "home_cover_grads", value: "https://cdn/x.jpg" },
    { key: "gmail_tokens", value: '{"access_token":"a","refresh_token":"r"}' },
    { key: "reminder_subject_48hr", value: "Reminder" },
    // even if a secret-shaped value lands under an allowlisted key, scrub it:
    { key: "home_cover_families", value: "ya29.leakedtoken" },
    { key: "pricing_grad_group_image", value: "https://cdn/g.jpg" },
  ];
  const out = filterReadableSettings(rows);
  assert.deepEqual(out, {
    home_cover_grads: "https://cdn/x.jpg",
    pricing_grad_group_image: "https://cdn/g.jpg",
  });
  // gmail_tokens must never be present
  assert.equal("gmail_tokens" in out, false);
  // token-shaped value under an allowlisted key is dropped
  assert.equal("home_cover_families" in out, false);
});

test("filterReadableSettings handles null/empty input", () => {
  assert.deepEqual(filterReadableSettings(null), {});
  assert.deepEqual(filterReadableSettings(undefined), {});
  assert.deepEqual(filterReadableSettings([]), {});
});

test("setting value validation: null clears, strings ok, secrets/oversize rejected", () => {
  assert.equal(isValidSettingValue(null), true);
  assert.equal(isValidSettingValue("https://cdn/x.jpg"), true);
  assert.equal(isValidSettingValue('{"refresh_token":"x"}'), false); // secret-shaped
  assert.equal(isValidSettingValue("x".repeat(5000)), false);        // too long
  assert.equal(isValidSettingValue(42), false);
  assert.equal(isValidSettingValue({}), false);
});

test("inquiry id + draft key validation", () => {
  assert.equal(isValidInquiryId(42), true);
  assert.equal(isValidInquiryId("42"), true);
  assert.equal(isValidInquiryId(0), false);
  assert.equal(isValidInquiryId(-1), false);
  assert.equal(isValidInquiryId("4a2"), false);
  assert.equal(isValidInquiryId("'; drop table"), false);
  assert.equal(draftKey("ai_draft", 42), "ai_draft_42");
  assert.equal(isDraftKey("draft_42"), true);
  assert.equal(isDraftKey("ai_draft_42"), true);
  assert.equal(isDraftKey("original_ai_draft_42"), true);
  assert.equal(isDraftKey("home_cover_grads"), false);
  assert.equal(isDraftKey("draft_"), false);
});
