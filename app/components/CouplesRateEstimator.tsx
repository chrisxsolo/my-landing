"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { C } from "@/lib/colors"
import {
  COUPLES_PACKAGES,
  COUPLES_LOCATIONS,
  calculateCouplesEstimate,
  formatCurrency,
  type CouplesPackageKey,
  type CouplesLocationValue,
} from "@/lib/pricing"

// ── SHARED STYLE HELPERS ──────────────────────────────────────────────────────

const toggleStyle = (on: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 18px",
  borderRadius: 999,
  border: `1.5px solid ${on ? C.p1 : C.warmEdge}`,
  background: on ? C.p1_08 : "transparent",
  color: on ? C.p1 : "#4b5a55",
  fontSize: 14,
  fontWeight: on ? 600 : 400,
  cursor: "pointer",
  transition: "all 0.15s ease",
  userSelect: "none",
})

const SELECT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: `1.5px solid ${C.warmEdge}`,
  background: "#fff",
  fontSize: 15,
  color: "#101412",
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 14px center",
  paddingRight: 36,
}

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#4b5a55",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  marginBottom: 8,
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────

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
  const contactParams = new URLSearchParams({
    package: pkgLabel,
    location: locLabel,
    ...(extraLocation  && { extraLocation: "yes" }),
    ...(extraOutfit    && { extraOutfit: "yes" }),
    ...(extra30Min     && { extra30Min: "yes" }),
    ...(proofingGallery && { proofingGallery: "yes" }),
    ...(rushPreview    && { rushPreview: "yes" }),
    ...(expedited      && { expedited: "yes" }),
    estimatedTotal: String(estimate.subtotal),
  })

  const travelDisplay =
    estimate.travelMethod === "none" ? "Included" :
    estimate.travelMethod === "tbd"  ? "TBD" :
    formatCurrency(estimate.travelFee as number)

  const showTravelNote = estimate.travelMethod === "tbd" || estimate.travelMethod === "flat"

  return (
    <section style={{ maxWidth: 860, margin: "0 auto" }}>

      {/* ── INTRO ─────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.p1, marginBottom: 10 }}>
          Session Estimator
        </p>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: "#101412", margin: "0 0 12px", lineHeight: 1.3 }}>
          Want a quick estimate before reaching out?
        </h2>
        <p style={{ fontSize: 15, color: "#4b5a55", maxWidth: 500, margin: "0 auto", lineHeight: 1.65 }}>
          Pick your session type, location, and any add-ons to get a rough idea of what your couples session will cost.
          No commitment — just clarity before you inquire.
        </p>
      </div>

      {/* ── CARD WRAPPER ─────────────────────────────────────────────────── */}
      <div style={{
        background: C.surfaceSoft,
        borderRadius: 20,
        padding: "40px 36px 36px",
        border: `1px solid ${C.warmEdge}`,
      }}>

        {/* ── INPUTS ──────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 20, marginBottom: 28 }}>

          <div>
            <label style={LABEL_STYLE}>Session Type</label>
            <select
              style={SELECT_STYLE}
              value={packageKey}
              onChange={e => setPackageKey(e.target.value as CouplesPackageKey)}
            >
              {(Object.entries(COUPLES_PACKAGES) as [CouplesPackageKey, { label: string; price: number }][]).map(
                ([key, pkg]) => (
                  <option key={key} value={key}>{pkg.label} — {formatCurrency(pkg.price)}</option>
                )
              )}
            </select>
          </div>

          <div>
            <label style={LABEL_STYLE}>Location / Area</label>
            <select
              style={SELECT_STYLE}
              value={location}
              onChange={e => setLocation(e.target.value as CouplesLocationValue)}
            >
              {COUPLES_LOCATIONS.map(loc => (
                <option key={loc.value} value={loc.value}>{loc.label}</option>
              ))}
            </select>
          </div>

        </div>

        {/* ── ADD-ONS ─────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <label style={{ ...LABEL_STYLE, marginBottom: 12 }}>Add-ons</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button style={toggleStyle(extraLocation)}  onClick={() => setExtraLoc(v => !v)}>
              {extraLocation ? "✓ " : ""}Extra location +$125
            </button>
            <button style={toggleStyle(extraOutfit)}    onClick={() => setExtraOutfit(v => !v)}>
              {extraOutfit ? "✓ " : ""}Extra outfit +$75
            </button>
            <button style={toggleStyle(extra30Min)}     onClick={() => setExtra30Min(v => !v)}>
              {extra30Min ? "✓ " : ""}Extra 30 min +$175
            </button>
            <button style={toggleStyle(proofingGallery)} onClick={() => setProofing(v => !v)}>
              {proofingGallery ? "✓ " : ""}Proofing gallery +$75
            </button>
            <button style={toggleStyle(rushPreview)}    onClick={() => setRushPreview(v => !v)}>
              {rushPreview ? "✓ " : ""}Rush preview +$75
            </button>
            <button style={toggleStyle(expedited)}      onClick={() => setExpedited(v => !v)}>
              {expedited ? "✓ " : ""}72-hr delivery +$150
            </button>
          </div>
        </div>

        {/* ── ESTIMATE RESULT ─────────────────────────────────────────────── */}
        <div style={{
          background: "#fff",
          border: `1.5px solid ${C.warmEdge}`,
          borderRadius: 16,
          padding: "28px 28px 24px",
          marginBottom: 10,
        }}>

          {/* Deposit-first hero number */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: C.p1, marginBottom: 6 }}>
              Reserve your date with
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 42, fontWeight: 800, color: "#101412", lineHeight: 1 }}>
                {formatCurrency(estimate.deposit)}
              </span>
              <span style={{ fontSize: 15, color: "#667f79" }}>deposit</span>
            </div>
            <p style={{ fontSize: 13, color: "#667f79", marginTop: 6 }}>
              {formatCurrency(estimate.remainingBalance)} remaining balance due on shoot day
            </p>
          </div>

          {/* Divider */}
          <div style={{ borderTop: `1px solid ${C.warmEdge}`, margin: "20px 0" }} />

          {/* Breakdown */}
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#4b5a55", marginBottom: 12 }}>
            Estimate Breakdown
          </p>
          <BreakdownRow label="Session Fee" value={formatCurrency(estimate.sessionBase)} />
          <BreakdownRow label="Travel Fee"  value={travelDisplay} />
          {estimate.addons > 0 && <BreakdownRow label="Add-ons" value={formatCurrency(estimate.addons)} />}

          {/* Total line */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginTop: 14,
            paddingTop: 14,
            borderTop: `1px solid ${C.warmEdge}`,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#101412" }}>Estimated Total</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#101412" }}>{formatCurrency(estimate.subtotal)}</span>
          </div>
        </div>

        {/* Travel fee note */}
        {showTravelNote && (
          <p style={{ fontSize: 12, color: "#667f79", marginBottom: 20, lineHeight: 1.6 }}>
            {estimate.travelMethod === "tbd"
              ? "Travel fee may apply and will be confirmed after your exact location is reviewed."
              : "Travel fees are included where applicable. Final pricing may vary slightly depending on exact location."}
          </p>
        )}

        {/* Disclaimer */}
        <p style={{ fontSize: 12, color: "#aaa", lineHeight: 1.6, marginBottom: 28 }}>
          Rough estimate only — final quote confirmed after date, time, and location are set.
          Invoice and contract sent once everything is confirmed.
        </p>

        {/* ── CTAs ──────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href={`/contact?${contactParams.toString()}`}
            style={{
              padding: "13px 28px",
              borderRadius: 999,
              background: C.grad12,
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
              letterSpacing: "0.01em",
            }}
          >
            Inquire About This Estimate
          </Link>
          <Link
            href="https://www.soloxsnaps.com/availability"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "13px 28px",
              borderRadius: 999,
              border: `1.5px solid ${C.p1}`,
              color: C.p1,
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
              transition: "all 0.15s ease",
            }}
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
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      fontSize: 14,
      color: "#4b5a55",
      marginBottom: 8,
    }}>
      <span>{label}</span>
      <span style={{ fontWeight: 500, color: "#101412" }}>{value}</span>
    </div>
  )
}
