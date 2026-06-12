"use client";
// Permissions header (spec §7.3): two SEPARATE controls with source/basis
// dropdowns and auto-stamped confirmations. Revoking marketing permission with
// live published content opens the blocking modal (server 409 acknowledgement
// protocol): Cancel / Disable future publishing only. Takedown stays per-item
// in Publication history.
import { useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { engineApi, EngineApiError } from "@/app/admin/content-engine/engineApi";
import { CONTENT_TYPE_LABELS } from "@/app/admin/content-engine/engineTypes";
import { btn, card, input, label, overlay, sectionTitle } from "./ui";

const MARKETING_SOURCES = ["contract", "email", "testimonial_form", "manual_confirmation", "portfolio_collaboration"];
const AI_BASES = ["contract", "privacy_policy", "portfolio_collaboration", "manual_confirmation", "internal_business_policy"];

interface Props {
  session: Record<string, unknown>;
  sessionId: string;
  onChanged: () => void;
}

export default function PermissionsBar({ session, sessionId, onChanged }: Props) {
  const [marketingSource, setMarketingSource] = useState(MARKETING_SOURCES[3]);
  const [aiBasis, setAiBasis] = useState(AI_BASES[3]);
  const [notice, setNotice] = useState<string | null>(null);
  const [revokeCounts, setRevokeCounts] = useState<Record<string, number> | null>(null);

  const marketingOn = session.marketing_permission === true;
  const aiOn = session.ai_processing_allowed === true;

  const patch = async (body: Record<string, unknown>) => {
    setNotice(null);
    try {
      await engineApi.patchPermissions(sessionId, body);
      onChanged();
    } catch (err) {
      if (err instanceof EngineApiError && err.status === 409
          && err.body.outcome === "requires_acknowledgement") {
        setRevokeCounts(err.body.publishedCounts as Record<string, number>);
        return;
      }
      setNotice(err instanceof Error ? err.message : "update failed");
    }
  };

  return (
    <section style={card}>
      <h2 style={sectionTitle}>Permissions</h2>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div>
          <span style={label}>Marketing permission (gates publication)</span>
          {marketingOn ? (
            <button style={btn(false, true)}
              onClick={() => void patch({ marketingPermission: false })}>
              Enabled — revoke
            </button>
          ) : (
            <span style={{ display: "flex", gap: 6 }}>
              <select style={input} value={marketingSource} onChange={(e) => setMarketingSource(e.target.value)}>
                {MARKETING_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button style={btn(true)}
                onClick={() => void patch({ marketingPermission: true, marketingPermissionSource: marketingSource })}>
                Enable
              </button>
            </span>
          )}
        </div>
        <div>
          <span style={label}>AI processing (gates analysis + generation)</span>
          {aiOn ? (
            <button style={btn(false, true)} onClick={() => void patch({ aiProcessingAllowed: false })}>
              Enabled — disable
            </button>
          ) : (
            <span style={{ display: "flex", gap: 6 }}>
              <select style={input} value={aiBasis} onChange={(e) => setAiBasis(e.target.value)}>
                {AI_BASES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <button style={btn(true)}
                onClick={() => void patch({ aiProcessingAllowed: true, aiProcessingBasis: aiBasis })}>
                Enable
              </button>
            </span>
          )}
        </div>
      </div>
      {notice && <p style={{ color: T.red, fontSize: 13, marginBottom: 0 }}>{notice}</p>}

      {revokeCounts && (
        <div style={overlay} onClick={() => setRevokeCounts(null)}>
          <div style={{ ...card, maxWidth: 480, marginBottom: 0 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Published content exists</h3>
            <p style={{ fontSize: 14 }}>
              {Object.entries(revokeCounts).map(([type, n]) =>
                `${n} ${CONTENT_TYPE_LABELS[type] ?? type}${n === 1 ? "" : "s"}`).join(", ")} are live.
              Disabling stops FUTURE publishing only — use Publication history below to take
              individual placements down.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btn(false)} onClick={() => setRevokeCounts(null)}>Cancel</button>
              <button style={btn(false, true)} onClick={() => {
                setRevokeCounts(null);
                void patch({ marketingPermission: false, acknowledgePublished: true });
              }}>
                Disable future publishing only
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
