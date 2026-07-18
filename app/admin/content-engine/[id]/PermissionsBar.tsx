"use client";
// Permissions header. Both permissions are always enabled — new sessions are
// created with them on (basis/source 'contract', createSession.ts) and the UI
// offers no revoke: takedown stays per-item in Publication history. The Enable
// button only appears for legacy rows that predate the always-on policy.
import { useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import { card, chip, btn, label, sectionTitle } from "./ui";

interface Props {
  session: Record<string, unknown>;
  sessionId: string;
  onChanged: () => void;
}

export default function PermissionsBar({ session, sessionId, onChanged }: Props) {
  const [notice, setNotice] = useState<string | null>(null);

  const marketingOn = session.marketing_permission === true;
  const aiOn = session.ai_processing_allowed === true;

  const enable = async (body: Record<string, unknown>) => {
    setNotice(null);
    try {
      await engineApi.patchPermissions(sessionId, body);
      onChanged();
    } catch (err) {
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
            <span style={chip(T.green, T.greenBg)}>Enabled</span>
          ) : (
            <button style={btn(true)}
              onClick={() => void enable({ marketingPermission: true, marketingPermissionSource: "contract" })}>
              Enable
            </button>
          )}
        </div>
        <div>
          <span style={label}>AI processing (gates analysis + generation)</span>
          {aiOn ? (
            <span style={chip(T.green, T.greenBg)}>Enabled</span>
          ) : (
            <button style={btn(true)}
              onClick={() => void enable({ aiProcessingAllowed: true, aiProcessingBasis: "contract" })}>
              Enable
            </button>
          )}
        </div>
      </div>
      {notice && <p style={{ color: T.red, fontSize: 13, marginBottom: 0 }}>{notice}</p>}
    </section>
  );
}
