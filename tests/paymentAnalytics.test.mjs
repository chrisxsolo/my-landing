import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMonthPeriod,
  filterPaymentsByPeriod,
  filterRevenuePayments,
} from "../lib/paymentAnalytics.ts";

const payments = [
  { status: "active", paid_at: "2026-05-01T00:00:00.000-07:00", session_date: null },
  { status: "active", paid_at: "2026-05-31T23:59:59.000-07:00", session_date: null },
  { status: "active", paid_at: "2026-04-30T23:59:59.000-07:00", session_date: null },
  { status: "active", paid_at: "2026-06-01T00:00:00.000-07:00", session_date: null },
  { status: "refunded", paid_at: "2026-05-12T12:00:00.000-07:00", session_date: null },
];

test("month period keeps May 2026 transactions separate from other months", () => {
  const may = buildMonthPeriod(2026, 4);
  const rows = filterPaymentsByPeriod(payments, may);

  assert.equal(may.label, "May 2026");
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => row.paid_at),
    [
      "2026-05-01T00:00:00.000-07:00",
      "2026-05-31T23:59:59.000-07:00",
    ],
  );
});

test("confirmed revenue excludes auto-assumed final payments", () => {
  const rows = filterRevenuePayments([
    {
      status: "active",
      source: "auto",
      note: "Auto-recorded: session already passed, balance assumed paid",
      paid_at: "2026-05-10T12:00:00.000-07:00",
      session_date: "2026-05-10",
    },
    {
      status: "active",
      source: "pass1",
      note: "Pixieset: $200 · Invoice 1001",
      amount: "$200.00",
      amount_cents: 20000,
      paid_at: "2026-05-11T12:00:00.000-07:00",
      session_date: null,
    },
    {
      status: "active",
      source: "auto",
      note: "Final payment recorded manually",
      amount: "$175.00",
      amount_cents: 17500,
      paid_at: "2026-05-12T12:00:00.000-07:00",
      session_date: null,
    },
    {
      status: "active",
      source: "pass2",
      note: "Client said they paid, but amount was not found",
      amount: "",
      amount_cents: 0,
      paid_at: "2026-05-13T12:00:00.000-07:00",
      session_date: null,
    },
  ]);

  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.note), [
    "Pixieset: $200 · Invoice 1001",
    "Final payment recorded manually",
  ]);
});
