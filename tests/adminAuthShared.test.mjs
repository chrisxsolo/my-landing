import test from "node:test";
import assert from "node:assert/strict";

import { isValidAdminSession } from "../lib/adminAuthShared.ts";

test("authorized only when cookie exactly matches the configured secret", () => {
  assert.equal(isValidAdminSession("s3cret", "s3cret"), true);
});

test("unauthenticated (no cookie) is denied → 401 path", () => {
  assert.equal(isValidAdminSession(undefined, "s3cret"), false);
  assert.equal(isValidAdminSession(null, "s3cret"), false);
  assert.equal(isValidAdminSession("", "s3cret"), false);
});

test("incorrect cookie is denied → 401 path", () => {
  assert.equal(isValidAdminSession("wrong", "s3cret"), false);
});

test("missing/empty server secret denies everything (fail closed)", () => {
  assert.equal(isValidAdminSession("anything", undefined), false);
  assert.equal(isValidAdminSession("anything", null), false);
  assert.equal(isValidAdminSession("anything", ""), false);
  assert.equal(isValidAdminSession("", ""), false);
});
