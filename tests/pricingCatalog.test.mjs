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

test("booking policy remaining-balance language is the single canonical phrasing", () => {
  // The exact string every public page must render when describing the balance.
  assert.equal(BOOKING_POLICY.remainingBalanceDeadline, "on or before the session date");
  assert.equal(BOOKING_POLICY.contractDeadline, "before the session");
});

test("every add-on price across categories is pinned", () => {
  // Graduation add-ons.
  const grad = PRICING_CATALOG.graduation.addOns;
  assert.equal(grad.extraOutfit.price, 75);
  assert.equal(grad.secondLocation.price, 125);
  assert.equal(grad.expedited.price, 150);
  assert.equal(grad.champagne.price, 15);
  assert.equal(grad.extra30Minutes.price, 100);

  // Couples add-ons.
  const couples = PRICING_CATALOG.couples.addOns;
  assert.equal(couples.extraLocation.price, 125);
  assert.equal(couples.extraOutfit.price, 75);
  assert.equal(couples.extra30Minutes.price, 175);
  assert.equal(couples.proofingGallery.price, 75);
  assert.equal(couples.rushPreview.price, 75);
  assert.equal(couples.expedited.price, 150);
  assert.equal(couples.shortFormVideo.displayPrice, "$175+");
  assert.equal(couples.advancedRetouching.displayPrice, "$25 / image");

  // Family add-ons are display-only strings. Expedited MUST be $150 — this is the
  // exact value that drifted to $75 on the live family page (regression lock).
  const family = PRICING_CATALOG.families.addOns;
  assert.equal(family.extraLocation.displayPrice, "$125");
  assert.equal(family.expedited.displayPrice, "$150");
  assert.equal(family.extendedFamily.displayPrice, "$50-$75");
  assert.equal(family.extra30Minutes.displayPrice, "$100 / 30 min");

  // Event add-ons.
  const events = PRICING_CATALOG.events.addOns;
  assert.equal(events.secondShooter.displayPrice, "$100-$150 / hr");
  assert.equal(events.expedited.displayPrice, "$250-$500");
  assert.equal(events.travel.displayPrice, "$0.75-$1.00 / mile (round trip)");
});

test("package prices and minimum image counts are pinned per category", () => {
  // Graduation.
  assert.equal(PRICING_CATALOG.graduation.baseHourlyRate, 350);
  assert.equal(PRICING_CATALOG.graduation.standardMinimumImages, 50);
  assert.equal(PRICING_CATALOG.graduation.groupMinimumImagesPerPerson, 25);
  assert.deepEqual(
    { ...PRICING_CATALOG.graduation.groupRates },
    { 2: 300, 3: 275, 4: 250, 5: 225, 6: 200 },
  );

  // Couples packages: price + minimum images.
  const cp = PRICING_CATALOG.couples.packages;
  assert.deepEqual([cp.mini.price, cp.mini.minimumImages], [350, 25]);
  assert.deepEqual([cp["1hr"].price, cp["1hr"].minimumImages], [450, 40]);
  assert.deepEqual([cp.signature.price, cp.signature.minimumImages], [575, 60]);
  assert.deepEqual([cp.engagement.price, cp.engagement.minimumImages], [650, 70]);
  assert.deepEqual([cp.proposal.price, cp.proposal.minimumImages], [750, 50]);

  // Families packages.
  assert.deepEqual(
    [PRICING_CATALOG.families.packages.standard.price, PRICING_CATALOG.families.packages.standard.minimumImages],
    [350, 10],
  );
  assert.deepEqual(
    [PRICING_CATALOG.families.packages.extended.price, PRICING_CATALOG.families.packages.extended.minimumImages],
    [500, 30],
  );

  // Events.
  assert.equal(PRICING_CATALOG.events.smallEvent.hourlyRate, 500);
  assert.equal(PRICING_CATALOG.events.smallEvent.minimumImages, 30);
  assert.equal(PRICING_CATALOG.events.mediumEvent.hourlyRate, 450);
  assert.equal(PRICING_CATALOG.events.largeEvent.halfDayPrice, 2200);
  assert.equal(PRICING_CATALOG.events.largeEvent.fullDayStartingPrice, 4000);
});

test("graduation travel fees are pinned for every school", () => {
  const fees = PRICING_CATALOG.graduation.travelFees;
  assert.equal(fees["sf-state"], null);
  assert.equal(fees["usf"], null);
  assert.equal(fees["sf-other"], null);
  assert.equal(fees["uc-berkeley"], 35);
  assert.equal(fees["csueb"], 30);
  assert.equal(fees["sjsu"], 75);
  assert.equal(fees["santa-clara"], 70);
  assert.equal(fees["stanford"], 45);
  assert.equal(fees["other"], undefined);
});

test("standard turnaround is 14 days (two weeks)", () => {
  assert.equal(PRICING_CATALOG.standardTurnaroundDays, 14);
  assert.equal(PRICING_CATALOG.standardTurnaroundDays / 7, 2);
});
