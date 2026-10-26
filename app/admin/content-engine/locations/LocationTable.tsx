"use client";
// The overview table: search + region / environment / type / status filters
// over every library location. Clicking a row opens its detail.
import { useMemo, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { card, input as inputStyle } from "@/app/admin/content-engine/[id]/ui";
import {
  ENVIRONMENTS, LIBRARY_REGIONS, SESSION_KINDS, regionLabel,
} from "@/lib/locationLibrary/taxonomy";
import type { LocationSummaryDto } from "./locationLibraryApi";
import { HERO_LABEL, STATUS_CHIP, selectStyle } from "./libraryUi";

const ALL = "all";

function matches(l: LocationSummaryDto, q: string, region: string, env: string, kind: string, status: string) {
  if (region !== ALL && l.region !== region) return false;
  if (env !== ALL && !l.environments.includes(env)) return false;
  if (kind !== ALL && !l.kinds.includes(kind)) return false;
  if (status !== ALL && l.status !== status) return false;
  const text = `${l.title} ${l.city} ${l.locationKey ?? ""}`.toLowerCase();
  return !q || text.includes(q.toLowerCase());
}

function Thumb({ url }: { url: string | null }) {
  return (
    <div style={{ width: 52, height: 40, borderRadius: 8, overflow: "hidden", background: T.inset, flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail, already a resized render URL */}
      {url ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
    </div>
  );
}

function Row({ l, onOpen }: { l: LocationSummaryDto; onOpen: () => void }) {
  const status = STATUS_CHIP[l.status];
  return (
    <button type="button" onClick={onOpen} style={{
      display: "grid", gridTemplateColumns: "minmax(0,2.4fr) 1fr 0.6fr 0.6fr 1fr 0.9fr", gap: 10, alignItems: "center",
      width: "100%", textAlign: "left", padding: "10px 12px", border: "none", borderTop: `1px solid ${T.rowBorder}`,
      background: "transparent", color: T.ink, cursor: "pointer", fontSize: 13,
    }} className="loclib-row">
      <span style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
        <Thumb url={l.heroUrl} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</span>
          <span style={{ display: "block", fontSize: 11, color: T.inkFaint }}>{l.city}{l.aiError ? " · AI failed" : ""}</span>
        </span>
      </span>
      <span className="loclib-hide-sm" style={{ color: T.inkSoft }}>{regionLabel(l.region, true)}</span>
      <span className="loclib-hide-sm" style={{ fontFamily: T.mono }}>{l.sessionCount}</span>
      <span className="loclib-hide-sm" style={{ fontFamily: T.mono }}>{l.photoCount}</span>
      <span><span style={status.style}>{status.label}</span></span>
      <span className="loclib-hide-sm" style={{ color: T.inkSoft, fontSize: 12 }}>{l.heroSource ? HERO_LABEL[l.heroSource] : "No photo"}</span>
    </button>
  );
}

function FilterSelect({ value, onChange, all, options }: {
  value: string; onChange: (v: string) => void; all: string; options: readonly { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle} aria-label={all}>
      <option value={ALL}>{all}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

const STATUS_OPTIONS = Object.entries(STATUS_CHIP).map(([value, s]) => ({ value, label: s.label }));

export default function LocationTable({ locations, onOpen }: { locations: LocationSummaryDto[]; onOpen: (id: number) => void }) {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState(ALL);
  const [env, setEnv] = useState(ALL);
  const [kind, setKind] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const shown = useMemo(
    () => locations.filter((l) => matches(l, q, region, env, kind, status)),
    [locations, q, region, env, kind, status],
  );

  return (
    <div style={{ ...card, padding: 0, overflow: "hidden" }}>
      <style>{`
        .loclib-row:hover { background: ${T.panelHover} !important; }
        @media (max-width: 720px) { .loclib-hide-sm { display: none; } .loclib-row { grid-template-columns: minmax(0,1fr) auto !important; } .loclib-head { display: none !important; } }
      `}</style>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 12 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search locations…"
          style={{ ...inputStyle, flex: "1 1 200px", width: "auto" }} aria-label="Search locations" />
        <FilterSelect value={region} onChange={setRegion} all="All regions" options={LIBRARY_REGIONS} />
        <FilterSelect value={env} onChange={setEnv} all="All environments" options={ENVIRONMENTS} />
        <FilterSelect value={kind} onChange={setKind} all="All session types" options={SESSION_KINDS} />
        <FilterSelect value={status} onChange={setStatus} all="Any status" options={STATUS_OPTIONS} />
      </div>
      <div className="loclib-head" style={{
        display: "grid", gridTemplateColumns: "minmax(0,2.4fr) 1fr 0.6fr 0.6fr 1fr 0.9fr", gap: 10, padding: "6px 12px",
        fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: T.inkFaint, fontFamily: T.mono,
      }}>
        <span>Location</span><span>Region</span><span>Sessions</span><span>Photos</span><span>Status</span><span>Featured</span>
      </div>
      {shown.length === 0
        ? <p style={{ padding: 16, margin: 0, color: T.inkFaint, fontSize: 13 }}>No locations match.</p>
        : shown.map((l) => <Row key={l.id} l={l} onOpen={() => onOpen(l.id)} />)}
    </div>
  );
}
