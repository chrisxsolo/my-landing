"use client"

import { useState, useMemo, useRef } from "react"
import Link from "next/link"
import {
  GROUP_MAX_PEOPLE,
  SCHOOLS,
  calculateGraduationEstimate,
  formatCurrency,
  isSessionLengthAllowed,
  requiresManualGroupQuote,
  type SchoolValue,
  type SessionLengthKey,
} from "@/lib/pricing"
import { BOOKING_POLICY, PRICING_CATALOG } from "@/lib/pricingCatalog"
import { buildBookingIntentParams } from "@/lib/bookingIntent"
import { trackEvent } from "@/lib/analytics/visitor"
import styles from "@/app/components/RateEstimator.module.css"

const graduationPricing = PRICING_CATALOG.graduation
const GROUP_MINIMUM = graduationPricing.durationRules.groupMinimumSize
const MINI_MINUTES = graduationPricing.packages.mini.durationMinutes
// Every headcount the rate card prices (1 to 8), then one more option that
// is a custom quote: nine or more are never priced by the 6-8 rate.
const MANUAL_QUOTE_HEADCOUNT = GROUP_MAX_PEOPLE + 1
const HEADCOUNT_OPTIONS = [...Array.from({ length: GROUP_MAX_PEOPLE }, (_, i) => i + 1), MANUAL_QUOTE_HEADCOUNT]
const SESSION_LENGTH_OPTIONS: { value: SessionLengthKey; label: string }[] = [
  { value: "30min", label: `${MINI_MINUTES} minutes` },
  { value: "1hr", label: "1 hour" },
  { value: "1.5hr", label: "90 minutes" },
  { value: "2hr", label: "2 hours" },
]
const SESSION_LABELS = Object.fromEntries(
  SESSION_LENGTH_OPTIONS.map(({ value, label }) => [value, label]),
) as Record<SessionLengthKey, string>
const SESSION_TYPE = "Graduation Portrait"

// Styles live in RateEstimator.module.css — shared with CouplesRateEstimator
// and matched to the pricing detail-page design system (Pricing.module.css).

export default function GraduationRateEstimator() {
  const [school, setSchool]            = useState<SchoolValue>("uc-berkeley")
  const [people, setPeople]            = useState(1)
  // The visitor's own pick. The estimate raises it when the headcount rules
  // it out (the mini is for one graduate; groups of 3+ book 90 minutes), and
  // the pick comes back if the group shrinks again. The 1-hour package is
  // the default individual option.
  const [requestedLength, setSessionLen] = useState<SessionLengthKey>("1hr")
  const [extraOutfit, setExtraOutfit]  = useState(false)
  const [secondLocation, setSecondLoc] = useState(false)
  const [expedited, setExpedited]      = useState(false)
  const [champagne, setChampagne]      = useState(false)

  const manualQuote = requiresManualGroupQuote(people)
  const estimate = useMemo(
    () => manualQuote
      ? null
      : calculateGraduationEstimate({ school, people, sessionLength: requestedLength, extraOutfit, secondLocation, expedited, champagne }),
    [manualQuote, school, people, requestedLength, extraOutfit, secondLocation, expedited, champagne]
  )
  const sessionLength = estimate?.sessionLength ?? requestedLength
  const lengthRaised = sessionLength !== requestedLength

  const schoolLabel = SCHOOLS.find(s => s.value === school)?.label ?? school
  const selectedAddOns = [
    extraOutfit    && graduationPricing.addOns.extraOutfit.shortLabel,
    secondLocation && graduationPricing.addOns.secondLocation.shortLabel,
    expedited      && graduationPricing.addOns.expedited.shortLabel,
    champagne      && graduationPricing.addOns.champagne.shortLabel,
  ].filter(Boolean) as string[]
  // The exact duration, headcount, add-ons and total travel to /contact; a
  // custom-quote group carries its headcount and no total.
  const contactParams = buildBookingIntentParams({
    sourcePage: "grad-estimator",
    sessionType: SESSION_TYPE,
    school: schoolLabel,
    headcount: people,
    duration: estimate ? SESSION_LABELS[sessionLength] : undefined,
    addOns: selectedAddOns,
    estimatedTotal: estimate?.subtotal,
    travelPending: estimate?.travelMethod === "tbd",
  })

  // Funnel events: estimator_start fires once on first interaction;
  // estimator_complete fires when the visitor clicks through to inquire,
  // carrying the configured quote so completion→inquiry can be measured.
  const startedRef = useRef(false)
  const markStarted = () => {
    if (startedRef.current) return
    startedRef.current = true
    trackEvent({ event: "estimator_start", meta: { sessionType: SESSION_TYPE } })
  }
  const markComplete = () => {
    trackEvent({
      event: "estimator_complete",
      meta: estimate
        ? {
          sessionType: SESSION_TYPE,
          school: schoolLabel,
          headcount: people,
          duration: SESSION_LABELS[sessionLength],
          addOnCount: selectedAddOns.length,
          estimatedTotalCents: Math.round(estimate.subtotal * 100),
        }
        : { sessionType: SESSION_TYPE, school: schoolLabel, headcount: people, addOnCount: selectedAddOns.length, manualQuote: true },
    })
  }

  const travelDisplay = !estimate ? "" :
    estimate.travelMethod === "none" ? "Included" :
    estimate.travelMethod === "tbd"  ? "Confirmed after location review" :
    formatCurrency(estimate.travelFee as number)

  const lengthHint = manualQuote
    ? null
    : lengthRaised
      ? `Set to ${SESSION_LABELS[sessionLength]}: ${people >= GROUP_MINIMUM
        ? `groups of ${GROUP_MINIMUM}+ book at least ${graduationPricing.durationRules.groupMinimumMinutes} minutes.`
        : `the ${MINI_MINUTES}-minute mini is for one graduate.`}`
      : people >= GROUP_MINIMUM
        ? `Groups of ${GROUP_MINIMUM}+ book at least ${graduationPricing.durationRules.groupMinimumMinutes} minutes.`
        : people > 1
          ? `The ${MINI_MINUTES}-minute mini is for one graduate.`
          : null

  return (
    <section className={styles.estimator}>

      {/* ── INTRO ─────────────────────────────────────────────────────────── */}
      <div className={styles.estimatorHeader}>
        <p className={styles.estimatorKicker}>Session estimator</p>
        <h2 className={styles.estimatorHeading}>
          Want a quick estimate before reaching out?
        </h2>
        <p className={styles.estimatorCopy}>
          Select your school, group size, session length, and any add-ons below to get a rough idea of what your session will cost.
          No commitment — just clarity before you inquire.
        </p>
      </div>

      {/* ── CARD WRAPPER ─────────────────────────────────────────────────── */}
      <div className={styles.estimatorCard}>

        {/* ── INPUTS ──────────────────────────────────────────────────────── */}
        <div className={styles.estimatorInputs}>

          <div>
            <label htmlFor="grad-estimate-school" className={styles.estimatorLabel}>School / Location</label>
            <select
              id="grad-estimate-school"
              className={styles.estimatorSelect}
              value={school}
              onChange={e => { markStarted(); setSchool(e.target.value as SchoolValue) }}
            >
              {SCHOOLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="grad-estimate-people" className={styles.estimatorLabel}>Number of Graduates</label>
            <select
              id="grad-estimate-people"
              className={styles.estimatorSelect}
              value={people}
              onChange={e => { markStarted(); setPeople(Number(e.target.value)) }}
            >
              {HEADCOUNT_OPTIONS.map(n => (
                <option key={n} value={n}>{n === MANUAL_QUOTE_HEADCOUNT ? `${n} or more (custom quote)` : String(n)}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="grad-estimate-length" className={styles.estimatorLabel}>Session Length</label>
            <select
              id="grad-estimate-length"
              className={styles.estimatorSelect}
              value={sessionLength}
              disabled={manualQuote}
              aria-describedby={lengthHint ? "grad-estimate-length-hint" : undefined}
              onChange={e => { markStarted(); setSessionLen(e.target.value as SessionLengthKey) }}
            >
              {SESSION_LENGTH_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value} disabled={!isSessionLengthAllowed(people, value)}>
                  {label}
                </option>
              ))}
            </select>
            {lengthHint && (
              <p id="grad-estimate-length-hint" className={styles.estimatorHint} aria-live="polite">
                {lengthHint}
              </p>
            )}
          </div>
        </div>

        {/* ── ADD-ONS ─────────────────────────────────────────────────────── */}
        <div className={styles.estimatorAddons}>
          <p className={styles.estimatorLabel} id="grad-estimate-addons">Add-ons</p>
          <div className={styles.estimatorToggleRow} role="group" aria-labelledby="grad-estimate-addons">
            <button type="button" aria-pressed={extraOutfit} className={styles.estimatorToggle} data-on={extraOutfit}    onClick={() => { markStarted(); setExtraOutfit(v => !v) }}>
              {extraOutfit ? "✓ " : ""}{graduationPricing.addOns.extraOutfit.shortLabel} +{formatCurrency(graduationPricing.addOns.extraOutfit.price)}
            </button>
            <button type="button" aria-pressed={secondLocation} className={styles.estimatorToggle} data-on={secondLocation} onClick={() => { markStarted(); setSecondLoc(v => !v) }}>
              {secondLocation ? "✓ " : ""}{graduationPricing.addOns.secondLocation.shortLabel} +{formatCurrency(graduationPricing.addOns.secondLocation.price)}
            </button>
            <button type="button" aria-pressed={expedited} className={styles.estimatorToggle} data-on={expedited}      onClick={() => { markStarted(); setExpedited(v => !v) }}>
              {expedited ? "✓ " : ""}{graduationPricing.addOns.expedited.shortLabel} +{formatCurrency(graduationPricing.addOns.expedited.price)}
            </button>
            <button type="button" aria-pressed={champagne} className={styles.estimatorToggle} data-on={champagne}      onClick={() => { markStarted(); setChampagne(v => !v) }}>
              {champagne ? "✓ " : ""}{graduationPricing.addOns.champagne.shortLabel} +{formatCurrency(graduationPricing.addOns.champagne.price)}
            </button>
          </div>
        </div>

        {/* ── ESTIMATE RESULT ─────────────────────────────────────────────── */}
        <div className={styles.estimatorResult}>
          {estimate ? (
            <>
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
              <BreakdownRow label={estimate.sessionLabel} value={formatCurrency(estimate.sessionBase)} />
              <BreakdownRow label="Travel Fee"   value={travelDisplay} />
              {estimate.addons > 0 && <BreakdownRow label="Add-ons" value={formatCurrency(estimate.addons)} />}

              {/* Total line */}
              <div className={styles.estimatorTotalRow}>
                <span className={styles.estimatorTotalLabel}>
                  {estimate.travelMethod === "tbd" ? "Estimated Total (before travel)" : "Estimated Total"}
                </span>
                <span className={styles.estimatorTotalValue}>{formatCurrency(estimate.subtotal)}</span>
              </div>
            </>
          ) : (
            /* Nine or more graduates: no automatic total, the 6-8 rate does not stretch */
            <div className={styles.estimatorGroupNote} role="status">
              Groups of {MANUAL_QUOTE_HEADCOUNT}{" "}or more are quoted individually rather than priced here. Send the headcount, campus, and date and I&rsquo;ll put a quote together.
            </div>
          )}
        </div>

        {/* ── CTAs ──────────────────────────────────────────────────────────── */}
        <div className={styles.estimatorCtas}>
          <Link href={`/contact?${contactParams.toString()}`} className={styles.estimatorCtaPrimary} onClick={markComplete}>
            {estimate ? "Inquire About This Estimate" : "Request a Custom Quote"}
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
