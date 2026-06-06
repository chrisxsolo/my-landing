import test from "node:test";
import assert from "node:assert/strict";

import {
  parseInquiryId,
  validateInquiryCreate,
  validateInquiryPatch,
} from "../lib/adminInquiryValidation.ts";

test("accepts and normalizes an allowlisted admin inquiry create payload", () => {
  const result = validateInquiryCreate({
    name: "  Test Client ",
    email: " TEST@EXAMPLE.COM ",
    message: "  Asked about a session. ",
    phone: "",
    status: "manual",
    session_date: "2026-06-20",
    booking_confirmed: false,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.data, {
    name: "Test Client",
    email: "test@example.com",
    message: "Asked about a session.",
    phone: null,
    status: "manual",
    session_date: "2026-06-20",
    booking_confirmed: false,
  });
});

test("rejects unknown create fields and invalid email", () => {
  assert.match(validateInquiryCreate({
    name: "Test",
    email: "test@example.com",
    message: "Hello",
    admin: true,
  }).error ?? "", /not allowed/);

  assert.match(validateInquiryCreate({
    name: "Test",
    email: "not-an-email",
    message: "Hello",
  }).error ?? "", /email must be valid/);
});

test("patch only accepts reviewed inquiry fields", () => {
  const valid = validateInquiryPatch({
    id: 42,
    updates: {
      status: "responded",
      reply_sent_at: "2026-06-06T01:00:00.000Z",
    },
  });
  assert.equal(valid.error, undefined);
  assert.deepEqual(valid.data, {
    id: 42,
    updates: {
      status: "responded",
      reply_sent_at: "2026-06-06T01:00:00.000Z",
    },
  });

  assert.match(validateInquiryPatch({
    id: 42,
    updates: { payment_note: "not allowed from browser" },
  }).error ?? "", /not allowed/);
});

test("rejects invalid ids, statuses, dates, and empty updates", () => {
  assert.match(parseInquiryId("0").error ?? "", /valid inquiry id/);
  assert.match(validateInquiryPatch({
    id: 1,
    updates: { status: "owner" },
  }).error ?? "", /status is not allowed/);
  assert.match(validateInquiryPatch({
    id: 1,
    updates: { session_date: "June 20" },
  }).error ?? "", /YYYY-MM-DD/);
  assert.match(validateInquiryPatch({ id: 1, updates: {} }).error ?? "", /At least one/);
});
