"use client"

import { useState, useMemo, useRef } from "react"
import Link from "next/link"
import {
  SCHOOLS,
  calculateGraduationEstimate,
  formatCurrency,
  type SchoolValue,
  type SessionLengthKey,
} from "@/lib/pricing"
import { BOOKING_POLICY, PRICING_CATALOG } from "@/lib/pricingCatalog"
import { buildBookingIntentParams } from "@/lib/bookingIntent"
import { trackEvent } from "@/lib/analytics/visitor"
import styles from "@/app/components/RateEstimator.module.css"

const graduationPricing = PRICING_CATALOG.graduation

// Styles live in RateEstimator.module.css — shared with CouplesRateEstimator
// and matched to the pricing detail-page design system (Pricing.module.css).

export default function GraduationRateEstimator() {
  const [school, setSchool]            = useState<SchoolValue>("uc-berkeley")
  const [people, setPeople]            = useState(1)
  const [sessionLength, setSessionLen] = useState<SessionLengthKey>("1hr")
  const [extraOutfit, setExtraOutfit]  = useState(false)
  const [secondLocation, setSecondLoc] = useState(false)
  const [expedited, setExpedited]      = useState(false)
  const [champagne, setChampagne]      = useState(false)

  const estimate = useMemo(
    () => calculateGraduationEstimate({ school, people, sessionLength, extraOutfit, secondLocation, expedited, champagne }),
    [school, people, sessionLength, extraOutfit, secondLocation, expedited, champagne]
  )

  const schoolLabel = SCHOOLS.find(s => s.value === school)?.label ?? school
  const sessionLabelMap: Record<SessionLengthKey, string> = {
    "1hr": "1 hour", "1.5hr": "90 minutes", "2hr": "2 hours",
  }
  const selectedAddOns = [
    extraOutfit    && graduationPricing.addOns.extraOutfit.shortLabel,
    secondLocation && graduationPricing.addOns.secondLocation.shortLabel,
    expedited      && graduationPricing.addOns.expedited.shortLabel,
    champagne      && graduationPricing.addOns.champagne.shortLabel,
  ].filter(Boolean) as string[]
  const contactParams = buildBookingIntentParams({
    sourcePage: "grad-estimator",
    sessionType: "Graduation Portrait",
    school: schoolLabel,
    headcount: people,
    duration: sessionLabelMap[sessionLength],
    addOns: selectedAddOns,
    estimatedTotal: estimate.subtotal,
  })

  // Funnel events: estimator_start fires once on first interaction;
  // estimator_complete fires when the visitor clicks through to inquire,
  // carrying the configured quote so completion→inquiry can be measured.
  const startedRef = useRef(false)
  const markStarted = () => {
    if (startedRef.current) return
    startedRef.current = true
    trackEvent({ event: "estimator_start", meta: { sessionType: "Graduation Portrait" } })
  }
  const markComplete = () => {
    trackEvent({
      event: "estimator_complete",
      meta: {
        sessionType: "Graduation Portrait",
        school: schoolLabel,
        headcount: people,
        duration: sessionLabelMap[sessionLength],
        addOnCount: selectedAddOns.length,
        estimatedTotalCents: Math.round(estimate.subtotal * 100),
      },
    })
  }

  const travelDisplay =
    estimate.travelMethod === "none" ? "Included" :
    estimate.travelMethod === "tbd"  ? "TBD" :
    formatCurrency(estimate.travelFee as number)

  const showTravelNote = estimate.travelMethod === "tbd" || estimate.travelMethod === "flat"

  return (
    <section className={styles.estimator}>

      {/* ── INTRO ─────────────────────────────────────────────────────────── */}
      <div className={styles.estimatorHeader}>
        <p className={styles.estimatorKicker}>Session estimator</p>
        <h2 className={styles.estimatorHeading}>
          Want a quick estimate before reaching out?
        </h2>
        <p className={styles.estimatorCopy}>
          Select your school, group size, and any add-ons below to get a rough idea of what your session will cost.
          No commitment — just clarity before you inquire.
        </p>
      </div>

      {/* ── CARD WRAPPER ─────────────────────────────────────────────────── */}
      <div className={styles.estimatorCard}>

        {/* ── INPUTS ──────────────────────────────────────────────────────── */}
        <div className={styles.estimatorInputs}>

          <div>
            <label className={styles.estimatorLabel}>School / Location</label>
            <select
              className={styles.estimatorSelect}
              value={school}
              onChange={e => { markStarted(); setSchool(e.target.value as SchoolValue) }}
            >
              {SCHOOLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <label className={styles.estimatorLabel}>Number of Graduates</label>
            <select
              className={styles.estimatorSelect}
              value={people}
              onChange={e => { markStarted(); setPeople(Number(e.target.value)) }}
            >
              {[1, 2, 3, 4, 5].map(n => (
                <option key={n} value={n}>{n === 5 ? "5 or more" : String(n)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={styles.estimatorLabel}>Session Length</label>
            <select
              className={styles.estimatorSelect}
              value={sessionLength}
              onChange={e => { markStarted(); setSessionLen(e.target.value as SessionLengthKey) }}
            >
              <option value="1hr">1 hour</option>
              <option value="1.5hr">90 minutes</option>
              <option value="2hr">2 hours</option>
            </select>
            {people >= 3 && sessionLength === "1hr" && (
              <p className={styles.estimatorHint}>
                Groups of 3+ usually need at least 90 min.
              </p>
            )}
          </div>
        </div>

        {/* ── ADD-ONS ─────────────────────────────────────────────────────── */}
        <div className={styles.estimatorAddons}>
          <label className={styles.estimatorLabel}>Add-ons</label>
          <div className={styles.estimatorToggleRow}>
            <button className={styles.estimatorToggle} data-on={extraOutfit}    onClick={() => { markStarted(); setExtraOutfit(v => !v) }}>
              {extraOutfit ? "✓ " : ""}{graduationPricing.addOns.extraOutfit.shortLabel} +{formatCurrency(graduationPricing.addOns.extraOutfit.price)}
            </button>
            <button className={styles.estimatorToggle} data-on={secondLocation} onClick={() => { markStarted(); setSecondLoc(v => !v) }}>
              {secondLocation ? "✓ " : ""}{graduationPricing.addOns.secondLocation.shortLabel} +{formatCurrency(graduationPricing.addOns.secondLocation.price)}
            </button>
            <button className={styles.estimatorToggle} data-on={expedited}      onClick={() => { markStarted(); setExpedited(v => !v) }}>
              {expedited ? "✓ " : ""}{graduationPricing.addOns.expedited.shortLabel} +{formatCurrency(graduationPricing.addOns.expedited.price)}
            </button>
            <button className={styles.estimatorToggle} data-on={champagne}      onClick={() => { markStarted(); setChampagne(v => !v) }}>
              {champagne ? "✓ " : ""}{graduationPricing.addOns.champagne.shortLabel} +{formatCurrency(graduationPricing.addOns.champagne.price)}
            </button>
          </div>
        </div>

        {/* ── ESTIMATE RESULT ─────────────────────────────────────────────── */}
        <div className={styles.estimatorResult}>

          {/* Group note banner */}
          {estimate.groupNote && (
            <div className={styles.estimatorGroupNote}>
              {estimate.groupNote}
            </div>
          )}

          {/* Deposit-first hero number — primary conversion anchor */}
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
          <BreakdownRow label="Session Fee"  value={formatCurrency(estimate.sessionBase)} />
          <BreakdownRow label="Travel Fee"   value={travelDisplay} />
          {estimate.addons > 0 && <BreakdownRow label="Add-ons" value={formatCurrency(estimate.addons)} />}

          {/* Total line */}
          <div className={styles.estimatorTotalRow}>
            <span className={styles.estimatorTotalLabel}>Estimated Total</span>
            <span className={styles.estimatorTotalValue}>{formatCurrency(estimate.subtotal)}</span>
          </div>
        </div>

        {/* Travel fee note */}
        {showTravelNote && (
          <p className={styles.estimatorNote}>
            {estimate.travelMethod === "tbd"
              ? "Travel fee may apply and will be confirmed after your exact location is reviewed."
              : "Travel fees are included where applicable. Final pricing may vary slightly depending on exact location."}
          </p>
        )}

        {/* Disclaimer */}
        <p className={styles.estimatorNote}>
          Rough estimate only — final quote confirmed after date, time, and location are set.
          Invoice and contract sent once everything is confirmed.
        </p>

        {/* ── CTAs ──────────────────────────────────────────────────────────── */}
        <div className={styles.estimatorCtas}>
          <Link href={`/contact?${contactParams.toString()}`} className={styles.estimatorCtaPrimary} onClick={markComplete}>
            Inquire About This Estimate
          </Link>
          <Link
            href="https://www.soloxsnaps.com/availability"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.estimatorCtaSecondary}
          >
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
