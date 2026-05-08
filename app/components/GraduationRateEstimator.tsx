"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { C } from "@/lib/colors"
import {
  SCHOOLS,
  SESSION_LENGTHS,
  calculateGraduationEstimate,
  formatCurrency,
  type SchoolValue,
  type SessionLengthKey,
} from "@/lib/pricing"

const TOGGLE_STYLE = (on: boolean) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 18px",
  borderRadius: 999,
  border: `1.5px solid ${on ? C.p1 : C.warmEdge}`,
  background: on ? C.p1_08 : "transparent",
  color: on ? C.p1 : "#4b5a55",
  fontSize: 14,
  fontWeight: on ? 600 : 400,
  cursor: "pointer",
  transition: "all 0.18s ease",
  userSelect: "none" as const,
})

const SELECT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
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
  fontSize: 13,
  fontWeight: 600,
  color: "#4b5a55",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  marginBottom: 8,
}

export default function GraduationRateEstimator() {
  const [school, setSchool]             = useState<SchoolValue>("uc-berkeley")
  const [people, setPeople]             = useState(1)
  const [sessionLength, setSessionLen]  = useState<SessionLengthKey>("1hr")
  const [extraOutfit, setExtraOutfit]   = useState(false)
  const [secondLocation, setSecondLoc]  = useState(false)
  const [expedited, setExpedited]       = useState(false)
  const [champagne, setChampagne]       = useState(false)

  const estimate = useMemo(
    () => calculateGraduationEstimate({ school, people, sessionLength, extraOutfit, secondLocation, expedited, champagne }),
    [school, people, sessionLength, extraOutfit, secondLocation, expedited, champagne]
  )

  // Build query string for the contact form
  const schoolLabel = SCHOOLS.find(s => s.value === school)?.label ?? school
  const sessionLabelMap: Record<SessionLengthKey, string> = {
    "1hr": "1 hour", "1.5hr": "90 minutes", "2hr": "2 hours"
  }
  const contactParams = new URLSearchParams({
    school: schoolLabel,
    graduates: String(people),
    sessionLength: sessionLabelMap[sessionLength],
    ...(extraOutfit    && { extraOutfit: "yes" }),
    ...(secondLocation && { secondLocation: "yes" }),
    ...(expedited      && { expedited: "yes" }),
    ...(champagne      && { champagne: "yes" }),
    estimatedTotal: String(estimate.subtotal),
  })

  return (
    <section style={{ background: C.surfaceSoft, borderRadius: 20, padding: "48px 40px", maxWidth: 860, margin: "0 auto" }}>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 36, textAlign: "center" }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.p1, marginBottom: 8 }}>
          Graduation Rate Estimator
        </p>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: "#101412", margin: "0 0 10px" }}>
          Get a rough estimate
        </h2>
        <p style={{ fontSize: 15, color: "#4b5a55", maxWidth: 520, margin: "0 auto" }}>
          Select your school, group size, and any add-ons to see a rough session estimate.
          Final quote is confirmed after your date and location are reviewed.
        </p>
      </div>

      {/* ── INPUTS GRID ───────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 20, marginBottom: 28 }}>

        {/* School */}
        <div>
          <label style={LABEL_STYLE}>School / Location</label>
          <select style={SELECT_STYLE} value={school} onChange={e => setSchool(e.target.value as SchoolValue)}>
            {SCHOOLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {/* Number of graduates */}
        <div>
          <label style={LABEL_STYLE}>Number of Graduates</label>
          <select style={SELECT_STYLE} value={people} onChange={e => setPeople(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map(n => (
              <option key={n} value={n}>{n === 5 ? "5+" : n}</option>
            ))}
          </select>
        </div>

        {/* Session length */}
        <div>
          <label style={LABEL_STYLE}>Session Length</label>
          <select style={SELECT_STYLE} value={sessionLength} onChange={e => setSessionLen(e.target.value as SessionLengthKey)}>
            <option value="1hr">1 hour</option>
            <option value="1.5hr">90 minutes</option>
            <option value="2hr">2 hours</option>
          </select>
          {people >= 3 && sessionLength === "1hr" && (
            <p style={{ fontSize: 12, color: C.p2, marginTop: 6 }}>
              Groups of 3+ usually need at least 90 min.
            </p>
          )}
        </div>
      </div>

      {/* ── ADD-ON TOGGLES ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <label style={{ ...LABEL_STYLE, marginBottom: 12 }}>Add-ons</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button style={TOGGLE_STYLE(extraOutfit)}    onClick={() => setExtraOutfit(v => !v)}>
            Extra outfit +$75
          </button>
          <button style={TOGGLE_STYLE(secondLocation)} onClick={() => setSecondLoc(v => !v)}>
            Second location +$125
          </button>
          <button style={TOGGLE_STYLE(expedited)}      onClick={() => setExpedited(v => !v)}>
            72-hr delivery +$75
          </button>
          <button style={TOGGLE_STYLE(champagne)}      onClick={() => setChampagne(v => !v)}>
            Champagne +$15
          </button>
        </div>
      </div>

      {/* ── ESTIMATE CARD ─────────────────────────────────────────────────── */}
      <div style={{
        background: "#fff",
        border: `1.5px solid ${C.warmEdge}`,
        borderRadius: 16,
        padding: "28px 28px 24px",
        marginBottom: 28,
      }}>

        {/* Group note */}
        {estimate.groupNote && (
          <p style={{ fontSize: 13, color: C.p2, fontWeight: 500, marginBottom: 16, padding: "10px 14px", background: C.p2_08, borderRadius: 8 }}>
            {estimate.groupNote}
          </p>
        )}

        {/* Total */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#4b5a55" }}>Estimated Total</span>
          <span style={{ fontSize: 32, fontWeight: 700, color: "#101412" }}>{formatCurrency(estimate.subtotal)}</span>
        </div>

        {/* Deposit / remaining */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div style={{ padding: "14px 16px", background: C.p1_06, borderRadius: 10 }}>
            <p style={{ fontSize: 12, color: C.p1, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>Deposit to Book</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#101412" }}>{formatCurrency(estimate.deposit)}</p>
          </div>
          <div style={{ padding: "14px 16px", background: C.p1_04, borderRadius: 10 }}>
            <p style={{ fontSize: 12, color: "#4b5a55", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>Remaining Balance</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#101412" }}>{formatCurrency(estimate.remainingBalance)}</p>
          </div>
        </div>

        {/* Breakdown */}
        <div style={{ borderTop: `1px solid ${C.warmEdge}`, paddingTop: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#4b5a55", marginBottom: 10 }}>Breakdown</p>
          <Row label="Session" value={formatCurrency(estimate.sessionBase)} />
          <Row
            label="Travel"
            value={
              estimate.travelMethod === "none" ? "Included" :
              estimate.travelMethod === "tbd"  ? "TBD — confirmed after review" :
              formatCurrency(estimate.travelFee as number)
            }
          />
          {estimate.addons > 0 && <Row label="Add-ons" value={formatCurrency(estimate.addons)} />}
        </div>
      </div>

      {/* ── DISCLAIMER ────────────────────────────────────────────────────── */}
      <p style={{ fontSize: 12, color: "#667f79", lineHeight: 1.6, marginBottom: 24 }}>
        This is a rough estimate. Final quote may vary based on exact location, travel, and custom requests.
        Travel fee may be confirmed after reviewing the exact location.
        Invoice and contract are sent after date, time, and price are confirmed.
      </p>

      {/* ── CTA BUTTONS ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link
          href="https://www.soloxsnaps.com/availability"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: "12px 24px",
            borderRadius: 999,
            border: `1.5px solid ${C.p1}`,
            color: C.p1,
            fontWeight: 600,
            fontSize: 14,
            textDecoration: "none",
            transition: "all 0.18s ease",
          }}
        >
          Check Availability
        </Link>
        <Link
          href={`/contact?${contactParams.toString()}`}
          style={{
            padding: "12px 24px",
            borderRadius: 999,
            background: C.grad12,
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Inquire Now
        </Link>
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#4b5a55", marginBottom: 6 }}>
      <span>{label}</span>
      <span style={{ fontWeight: 500, color: "#101412" }}>{value}</span>
    </div>
  )
}
