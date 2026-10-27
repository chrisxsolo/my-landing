"use client";
// "Where can this photo appear?" for one photo: each public destination with
// its status (displayed / eligible / awaiting review / not eligible), the
// reason, and a link to the editor that controls it. Loaded on demand and
// read-only (GET /api/admin/photo-distribution).
import { useState } from "react";
import Link from "next/link";
import { T } from "@/app/admin/adminTheme";
import { btn } from "@/app/admin/content-engine/[id]/ui";
import {
  DISTRIBUTION_STATUS_LABELS, type Destination, type DistributionStatus,
} from "@/lib/photoSync/distribution";

const PATH = "/api/admin/photo-distribution";

const TONE: Record<DistributionStatus, { color: string; bg: string }> = {
  displayed: { color: T.green, bg: T.greenBg },
  eligible: { color: T.blue, bg: T.blueBg },
  review: { color: T.amber, bg: T.amberBg },
  "not-eligible": { color: T.inkFaint, bg: T.neutralBg },
};

interface Loaded { destinations: Destination[]; errors: string[] }

function Row({ d }: { d: Destination }) {
  const tone = TONE[d.status];
  return (
    <li style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", fontSize: 12 }}>
      <span style={{ padding: "1px 8px", borderRadius: 999, background: tone.bg, color: tone.color, fontWeight: 700, flexShrink: 0 }}>
        {DISTRIBUTION_STATUS_LABELS[d.status]}
      </span>
      <span style={{ color: T.ink, fontWeight: 700 }}>
        {d.path ? <a href={d.path} target="_blank" rel="noreferrer" style={{ color: T.ink }}>{d.label}</a> : d.label}
      </span>
      <span style={{ color: T.inkSoft, flex: "1 1 200px" }}>{d.reason}</span>
      <Link href={d.editorHref} style={{ color: T.blue, fontWeight: 700, textDecoration: "none" }}>Edit →</Link>
    </li>
  );
}

export default function DistributionPreview({ photoKey }: { photoKey: string }) {
  const [state, setState] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${PATH}?key=${encodeURIComponent(photoKey)}`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : `request failed (${res.status})`);
      setState(body as Loaded);
    } catch (err) {
      console.error("[photo-distribution] load failed", err);
      setError(err instanceof Error ? err.message : "Could not load where this photo can appear");
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return (
      <div style={{ display: "grid", gap: 4 }}>
        <button type="button" style={{ ...btn(false), justifySelf: "start", padding: "3px 10px", fontSize: 12 }} disabled={busy} onClick={() => void load()}>
          {busy ? "Checking…" : "Where can this photo appear?"}
        </button>
        {error && <span style={{ fontSize: 12, color: T.red }}>{error}</span>}
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {state.errors.length > 0 && (
        <span style={{ fontSize: 12, color: T.amber }}>Some data could not be read, so a status may be incomplete: {state.errors.join("; ")}</span>
      )}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
        {state.destinations.map((d) => <Row key={d.id} d={d} />)}
      </ul>
    </div>
  );
}
