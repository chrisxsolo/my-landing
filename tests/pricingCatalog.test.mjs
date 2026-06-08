import test from "node:test";
import assert from "node:assert/strict";

import {
  BOOKING_POLICY,
  PRICING_CATALOG,
  calculatePaymentSchedule,
  getBookingPolicyItems,
  getMinimumImageCountForSessionType,
} from "../lib/pricingCatalog.ts";

test("booking policy uses one 50% non-refundable retainer and balance deadline", () => {
  assert.equal(BOOKING_POLICY.retainerPercent, 50);
  assert.equal(BOOKING_POLICY.retainerRefundability, "non-refundable");
  assert.equal(
    BOOKING_POLICY.remainingBalanceDeadline,
    "on or before the session date",
  );
  assert.deepEqual(calculatePaymentSchedule(351), {
    retainer: 176,
    remainingBalance: 175,
  });
  assert.deepEqual(getBookingPolicyItems(), [
    "50% non-refundable retainer to reserve the session.",
    "Contract completed before the session.",
    "Remaining balance due on or before the session date.",
  ]);
});

test("pricing catalog contains every operational pricing category", () => {
  assert.equal(PRICING_CATALOG.graduation.baseHourlyRate, 350);
  assert.equal(PRICING_CATALOG.graduation.groupRates[6], 200);
  assert.equal(PRICING_CATALOG.graduation.addOns.extraOutfit.price, 75);
  assert.equal(PRICING_CATALOG.graduation.travelFees["uc-berkeley"], 35);
  assert.equal(PRICING_CATALOG.graduation.standardMinimumImages, 50);
  assert.equal(PRICING_CATALOG.graduation.durationRules.groupMinimumMinutes, 90);

  assert.equal(PRICING_CATALOG.couples.packages["1hr"].price, 450);
  assert.equal(PRICING_CATALOG.couples.packages.mini.durationMinutes, 30);
  assert.equal(PRICING_CATALOG.couples.addOns.extraLocation.price, 125);
  assert.equal(PRICING_CATALOG.families.packages.standard.price, 350);
  assert.equal(PRICING_CATALOG.events.smallEvent.hourlyRate, 500);
  assert.equal(PRICING_CATALOG.standardTurnaroundDays, 14);
  assert.equal(getMinimumImageCountForSessionType("graduation"), 50);
  assert.equal(getMinimumImageCountForSessionType("couples mini"), 25);
  assert.equal(getMinimumImageCountForSessionType("extended family"), 30);
});
