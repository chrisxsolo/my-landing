import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeBlockedSenderEmail,
  sanitizeBlockedSenders,
} from "../lib/gmailBlockedSendersShared.ts";

test("normalizeBlockedSenderEmail trims and lowercases sender emails", () => {
  assert.equal(normalizeBlockedSenderEmail("  Hello@Example.com "), "hello@example.com");
  assert.equal(normalizeBlockedSenderEmail(""), null);
  assert.equal(normalizeBlockedSenderEmail(null), null);
});

test("sanitizeBlockedSenders removes duplicates and invalid values", () => {
  assert.deepEqual(
    sanitizeBlockedSenders([
      "Meteoric@Example.com",
      " meteoric@example.com ",
      "client@example.com",
      "",
      null,
      42,
    ]),
    ["client@example.com", "meteoric@example.com"],
  );
});
