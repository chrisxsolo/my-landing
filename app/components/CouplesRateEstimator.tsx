"use client"

import { useState, useMemo, useRef } from "react"
import Link from "next/link"
import {
  COUPLES_PACKAGES,
  COUPLES_LOCATIONS,
  calculateCouplesEstimate,
  formatCurrency,
  type CouplesPackageKey,
  type CouplesLocationValue,
} from "@/lib/pricing"
import { BOOKING_POLICY, PRICING_CATALOG } from "@/lib/pricingCatalog"
import { buildBookingIntentParams } from "@/lib/bookingIntent"
import { trackEvent } from "@/lib/analytics/visitor"
import styles from "@/app/components/RateEstimator.module.css"

const couplesPricing = PRICING_CATALOG.couples

// Styles live in RateEstimator.module.css — shared with GraduationRateEstimator
// and matched to the pricing detail-page design system (Pricing.module.css).

export default function CouplesRateEstimator() {
  const [packageKey, setPackageKey]     = useState<CouplesPackageKey>("1hr")
  const [location, setLocation]         = useState<CouplesLocationValue>("sf")
  const [extraLocation, setExtraLoc]    = useState(false)
  const [extraOutfit, setExtraOutfit]   = useState(false)
  const [extra30Min, setExtra30Min]     = useState(false)
  const [proofingGallery, setProofing]  = useState(false)
  const [rushPreview, setRushPreview]   = useState(false)
  const [expedited, setExpedited]       = useState(false)

  const estimate = useMemo(
    () => calculateCouplesEstimate({ packageKey, location, extraLocation, extraOutfit, extra30Min, proofingGallery, rushPreview, expedited }),
    [packageKey, location, extraLocation, extraOutfit, extra30Min, proofingGallery, rushPreview, expedited]
  )

  const pkgLabel  = COUPLES_PACKAGES[packageKey].label
  const locLabel  = COUPLES_LOCATIONS.find(l => l.value === location)?.label ?? location
  const selectedAddOns = [
    extraLocation   && couplesPricing.addOns.extraLocation.shortLabel,
    extraOutfit     && couplesPricing.addOns.extraOutfit.shortLabel,
    extra30Min      && couplesPricing.addOns.extra30Minutes.shortLabel,
    proofingGallery && couplesPricing.addOns.proofingGallery.shortLabel,
    rushPreview     && couplesPricing.addOns.rushPreview.shortLabel,
    expedited       && couplesPricing.addOns.expedited.shortLabel,
  ].filter(Boolean) as string[]
  const contactParams = buildBookingIntentParams({
    sourcePage: "couples-estimator",
    sessionType: "Couples Session",
    package: pkgLabel,
    location: locLabel,
    addOns: selectedAddOns,
    estimatedTotal: estimate.subtotal,
    travelPending: estimate.travelMethod === "tbd",
  })

  // Funnel events: estimator_start once on first interaction; estimator_complete
  // on click-through to inquire, carrying the configured quote.
  const startedRef = useRef(false)
  const markStarted = () => {
    if (startedRef.current) return
    startedRef.current = true
    trackEvent({ event: "estimator_start", meta: { sessionType: "Couples Session" } })
  }
  const markComplete = () => {
    trackEvent({
      event: "estimator_complete",
      meta: {
        sessionType: "Couples Session",
        package: pkgLabel,
        addOnCount: selectedAddOns.length,
        estimatedTotalCents: Math.round(estimate.subtotal * 100),
      },
    })
  }

  const travelDisplay =
    estimate.travelMethod === "none" ? "Included" :
    estimate.travelMethod === "tbd"  ? "Confirmed after location review" :
    formatCurrency(estimate.travelFee as number)

  return (
    <section className={styles.estimator}>

      {/* ── INTRO ─────────────────────────────────────────────────────────── */}
      <div className={styles.estimatorHeader}>
        <p className={styles.estimatorKicker}>Session estimator</p>
        <h2 className={styles.estimatorHeading}>
          Want a quick estimate before reaching out?
        </h2>
        <p className={styles.estimatorCopy}>
          Pick your session type, location, and any add-ons to get a rough idea of what your couples session will cost.
          No commitment — just clarity before you inquire.
        </p>
      </div>

      {/* ── CARD WRAPPER ─────────────────────────────────────────────────── */}
      <div className={styles.estimatorCard}>

        {/* ── INPUTS ──────────────────────────────────────────────────────── */}
        <div className={styles.estimatorInputs}>

          <div>
            <label htmlFor="couples-estimate-package" className={styles.estimatorLabel}>Session Type</label>
            <select
              id="couples-estimate-package"
              className={styles.estimatorSelect}
              value={packageKey}
              onChange={e => { markStarted(); setPackageKey(e.target.value as CouplesPackageKey) }}
            >
              {(Object.entries(COUPLES_PACKAGES) as [CouplesPackageKey, { label: string; price: number }][]).map(
                ([key, pkg]) => (
                  <option key={key} value={key}>
                    {pkg.label} — {key === "proposal" ? "starting at " : ""}{formatCurrency(pkg.price)}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label htmlFor="couples-estimate-location" className={styles.estimatorLabel}>Location / Area</label>
            <select
              id="couples-estimate-location"
              className={styles.estimatorSelect}
              value={location}
              onChange={e => { markStarted(); setLocation(e.target.value as CouplesLocationValue) }}
            >
              {COUPLES_LOCATIONS.map(loc => (
                <option key={loc.value} value={loc.value}>{loc.label}</option>
              ))}
            </select>
          </div>

        </div>

        {/* ── ADD-ONS ─────────────────────────────────────────────────────── */}
        <div className={styles.estimatorAddons}>
          <p className={styles.estimatorLabel} id="couples-estimate-addons">Add-ons</p>
          <div className={styles.estimatorToggleRow} role="group" aria-labelledby="couples-estimate-addons">
            <button type="button" aria-pressed={extraLocation} className={styles.estimatorToggle} data-on={extraLocation}  onClick={() => { markStarted(); setExtraLoc(v => !v) }}>
              {extraLocation ? "✓ " : ""}{couplesPricing.addOns.extraLocation.shortLabel} +{formatCurrency(couplesPricing.addOns.extraLocation.price)}
            </button>
            <button type="button" aria-pressed={extraOutfit} className={styles.estimatorToggle} data-on={extraOutfit}    onClick={() => { markStarted(); setExtraOutfit(v => !v) }}>
              {extraOutfit ? "✓ " : ""}{couplesPricing.addOns.extraOutfit.shortLabel} +{formatCurrency(couplesPricing.addOns.extraOutfit.price)}
            </button>
            <button type="button" aria-pressed={extra30Min} className={styles.estimatorToggle} data-on={extra30Min}     onClick={() => { markStarted(); setExtra30Min(v => !v) }}>
              {extra30Min ? "✓ " : ""}{couplesPricing.addOns.extra30Minutes.shortLabel} +{formatCurrency(couplesPricing.addOns.extra30Minutes.price)}
            </button>
            <button type="button" aria-pressed={proofingGallery} className={styles.estimatorToggle} data-on={proofingGallery} onClick={() => { markStarted(); setProofing(v => !v) }}>
              {proofingGallery ? "✓ " : ""}{couplesPricing.addOns.proofingGallery.shortLabel} +{formatCurrency(couplesPricing.addOns.proofingGallery.price)}
            </button>
            <button type="button" aria-pressed={rushPreview} className={styles.estimatorToggle} data-on={rushPreview}    onClick={() => { markStarted(); setRushPreview(v => !v) }}>
              {rushPreview ? "✓ " : ""}{couplesPricing.addOns.rushPreview.shortLabel} +{formatCurrency(couplesPricing.addOns.rushPreview.price)}
            </button>
            <button type="button" aria-pressed={expedited} className={styles.estimatorToggle} data-on={expedited}      onClick={() => { markStarted(); setExpedited(v => !v) }}>
              {expedited ? "✓ " : ""}{couplesPricing.addOns.expedited.shortLabel} +{formatCurrency(couplesPricing.addOns.expedited.price)}
            </button>
          </div>
        </div>

        {/* ── ESTIMATE RESULT ─────────────────────────────────────────────── */}
        <div className={styles.estimatorResult}>

          {/* Deposit-first hero number */}
          <div>
            <p className={styles.estimatorLabel}>Reserve your date with</p>
            <div className={styles.estimatorDeposit}>
              <span className={styles.estimatorDepositAmount}>
                {formatCurrency(estimate.deposit)}
              </span>
              <span className={styles.estimatorDepositUnit}>{BOOKING_POLICY.retainerRefundability} retainer</span>
            </div>
            <p className={styles.estimatorDepositMeta}>
              {formatCurrency(estimate.remainingBalance)} remaining balance due {BOOKING_POLICY.remainingBalanceDeadline}
            </p>
          </div>

          {/* Divider */}
          <div className={styles.estimatorDivider} />

          {/* Breakdown */}
          <p className={styles.estimatorLabel}>Estimate Breakdown</p>
          <BreakdownRow label="Session Fee" value={formatCurrency(estimate.sessionBase)} />
          <BreakdownRow label="Travel Fee"  value={travelDisplay} />
          {estimate.addons > 0 && <BreakdownRow label="Add-ons" value={formatCurrency(estimate.addons)} />}

          {/* Total line */}
          <div className={styles.estimatorTotalRow}>
            <span className={styles.estimatorTotalLabel}>
              {estimate.travelMethod === "tbd" ? "Estimated Total (before travel)" : "Estimated Total"}
            </span>
            <span className={styles.estimatorTotalValue}>{formatCurrency(estimate.subtotal)}</span>
          </div>
        </div>

        {/* ── CTAs ──────────────────────────────────────────────────────────── */}
        <div className={styles.estimatorCtas}>
          <Link href={`/contact?${contactParams.toString()}`} className={styles.estimatorCtaPrimary} onClick={markComplete}>
            Inquire About This Estimate
          </Link>
          <Link href="/availability" className={styles.estimatorCtaSecondary}>
            Check Availability
          </Link>
        </div>
      </div>
    </section>
  )
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.estimatorRow}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
