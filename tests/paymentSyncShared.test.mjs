import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGmailMonthFilter,
  parsePaymentSyncMonth,
} from "../lib/paymentSyncShared.ts";

test("buildGmailMonthFilter scopes May 2026 Gmail search", () => {
  assert.equal(buildGmailMonthFilter(2026, 5), "after:2026/05/01 before:2026/06/01");
});

test("parsePaymentSyncMonth accepts valid one-based month", () => {
  assert.deepEqual(parsePaymentSyncMonth({ year: 2026, month: 5 }), { year: 2026, month: 5 });
  assert.equal(parsePaymentSyncMonth({ year: 2026, month: 13 }), null);
  assert.equal(parsePaymentSyncMonth({ year: "2026", month: 5 }), null);
});
